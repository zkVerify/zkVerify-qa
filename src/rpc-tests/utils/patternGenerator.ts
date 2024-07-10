import parseYaml from "../utils/parseYaml";
import { PatternGeneratorParams, RpcDefinition } from "../types";

function getType($ref: string): string {
  const $refDirName = $ref.split("/");
  return $refDirName[$refDirName.length - 1];
}

function getRpcDefinition(rpcDefinitionPath: string, rpcName: string): RpcDefinition | undefined {
  const rpcDefinitions: RpcDefinition[] = parseYaml(rpcDefinitionPath);
  return rpcDefinitions.find((item: RpcDefinition) => item.name === rpcName);
}

function getSchema(): Record<string, any> {
  const baseTypes = parseYaml("../schemas/base-types.yaml");
  const block = parseYaml("../schemas/block.yaml");
  const runtime = parseYaml("../schemas/runtime.yaml");
  const properties = parseYaml("../schemas/properties.yaml");

  return {
    ...baseTypes,
    ...block,
    ...runtime,
    ...properties,
  };
}

function isBaseType(type: string): boolean {
  return Object.keys(parseYaml("../schemas/base-types.yaml")).includes(type);
}

function getPattern(type: string): any {
  const schema = getSchema();
  const schemaType = schema[type];

  if (isBaseType(type) && schemaType) return new RegExp(schemaType.pattern);

  const { properties, items, anyOf } = schemaType;

  if (properties) return iterateObjectProperties(properties);
  if (items) {
    if (Array.isArray(items)) {
      // Tuple: return pattern for each item in the tuple
      return [items.map(item => getPattern(getType(item.$ref)))];
    } else {
      // Regular array handling
      return [getPattern(getType(items.$ref))];
    }
  }

  if (anyOf) {
    return { any: anyOf.map((item: any) => getPattern(getType(item.$ref))) };
  }

  let combinedPattern = {};
  const { allOf, oneOf } = schemaType;
  if (allOf || oneOf) {
    const combinedProperties = allOf || oneOf;
    combinedProperties.forEach((item: any) => {
      if (item.properties) combinedPattern = { ...iterateObjectProperties(item.properties) };
    });
    return combinedPattern;
  }

  return null;
}

function iterateObjectProperties(properties: Record<string, any>): any {
  const pattern: Record<string, any> = {};
  for (const key in properties) {
    const propertyValue = properties[key];
    const { items, anyOf } = propertyValue;

    if (propertyValue.$ref) {
      pattern[key] = getPattern(getType(propertyValue.$ref));
      continue;
    }

    if (items) {
      if (Array.isArray(items)) {
        // Array of tuples: pattern for each item in the tuple
        pattern[key] = items.map(item => getPattern(getType(item.$ref)));
      } else if (items.items) {
        // Array of arrays: each item in the array is another array
        pattern[key] = [[getPattern(getType(items.items.$ref))]];
      } else {
        // Regular array: each item in the array follows the same pattern
        pattern[key] = [getPattern(getType(items.$ref))];
      }
      continue;
    }

    if (anyOf) {
      pattern[key] = { any: [] };
      anyOf.forEach((item: any) => {
        if (item.items) {
          const anyOfItemType = getType(item.items.$ref);
          const anyOfItemTypePattern = getPattern(anyOfItemType);
          if (isBaseType(anyOfItemType) && anyOfItemTypePattern) {
            pattern[key].any.push(anyOfItemTypePattern);
          }

          const schema = getSchema();
          const { oneOf } = schema[anyOfItemType];
          if (oneOf) {
            let oneOfProperties: Record<string, any> = {};
            oneOf.forEach((item: any) => {
              const oneOfItemType = getType(item.$ref);
              oneOfProperties = { ...oneOfProperties, ...getPattern(oneOfItemType) };
            });
            pattern[key].any.push(oneOfProperties);
          }
        }
      });
      continue;
    }
  }

  return pattern;
}

async function buildArrayPattern({ rpcDefinitionPath, rpcName }: PatternGeneratorParams): Promise<any> {
  const rpcDefinition = getRpcDefinition(rpcDefinitionPath, rpcName);
  if (!rpcDefinition || !rpcDefinition.result.schema.items) {
    throw new Error(`RPC definition or schema items not found for ${rpcName}`);
  }
  return [getPattern(getType(rpcDefinition.result.schema.items.$ref))];
}

async function buildObjectPattern({ rpcDefinitionPath, rpcName }: PatternGeneratorParams): Promise<any> {
  const rpcDefinition = getRpcDefinition(rpcDefinitionPath, rpcName);
  if (!rpcDefinition || !rpcDefinition.result.schema.properties) {
    throw new Error(`RPC definition or schema properties not found for ${rpcName}`);
  }
  const { properties } = rpcDefinition.result.schema;
  return iterateObjectProperties(properties);
}

async function buildMainPattern({ rpcDefinitionPath, rpcName }: PatternGeneratorParams): Promise<any> {
  const rpcDefinition = getRpcDefinition(rpcDefinitionPath, rpcName);
  if (!rpcDefinition || !rpcDefinition.result.schema.$ref) {
    throw new Error(`RPC definition or schema $ref not found for ${rpcName}`);
  }
  const { $ref } = rpcDefinition.result.schema;
  return getPattern(getType($ref));
}

async function buildSingleObjectPattern(type: string): Promise<any> {
  return getPattern(getType(type));
}

async function buildStringPattern({ rpcDefinitionPath, rpcName }: PatternGeneratorParams): Promise<{} | { any: any } | null> {
  const rpcDefinition = getRpcDefinition(rpcDefinitionPath, rpcName);
  if (!rpcDefinition || !rpcDefinition.result.schema.$ref) {
    throw new Error(`RPC definition or schema $ref not found for ${rpcName}`);
  }
  return getPattern(getType(rpcDefinition.result.schema.$ref));
}

export default {
  getSchema,
  buildArrayPattern,
  buildMainPattern,
  buildObjectPattern,
  buildStringPattern,
  buildSingleObjectPattern,
};
