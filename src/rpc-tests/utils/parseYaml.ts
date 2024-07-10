import { readFileSync } from "fs";
import path from "path";
import yaml from "yaml";
import { RpcDefinition } from "../types";

function parseYaml(file: string): RpcDefinition[] {
  try {
    const contents = readFileSync(
        path.resolve(__dirname, file),
        "utf8"
    );
    return yaml.parse(contents);
  } catch (error) {
    throw new Error(`Error: ${JSON.stringify(error, null, 2)}`);
  }
}

export default parseYaml;
