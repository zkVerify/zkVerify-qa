export interface PatternGeneratorParams {
    rpcDefinitionPath: string;
    rpcName: string;
}

export interface RpcDefinition {
    name: string;
    result: {
        schema: {
            $ref?: string;
            items?: {
                $ref: string;
            };
            properties?: Record<string, any>;
            anyOf?: Array<{ $ref: string; items?: { $ref: string } }>;
            allOf?: Array<{ properties: Record<string, any> }>;
            oneOf?: Array<{ properties: Record<string, any> }>;
        };
    };
}

export interface JSONRPC {
    jsonrpc: string;
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export interface Options {
    id: number;
    jsonrpc: string;
    method: string;
    params?: any[];
}