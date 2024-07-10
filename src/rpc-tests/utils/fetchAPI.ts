import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { JSONRPC, Options } from "./types";
require("dotenv").config();

function requiresAuth(method: string): boolean {
    return method.startsWith('debug_');
}

async function fetchAPI({
                            httpMethod = "post",
                            options,
                            url = process.env.RPC_URL,
                        }: {
    httpMethod?: "post" | "get";
    options: Options;
    url?: string;
}): Promise<JSONRPC> {

    const config: AxiosRequestConfig = {};

    if (requiresAuth(options.method)) {
        config.auth = {
            username: process.env.RPC_USERNAME || '',
            password: process.env.RPC_PASSWORD || ''
        };
    }

    try {
        let response: AxiosResponse;
        if (httpMethod === "post") {
            response = await axios.post(url!, options, config);
        } else if (httpMethod === "get") {
            response = await axios.get(url!, config);
        } else {
            throw new Error(`Unsupported HTTP method: ${httpMethod}`);
        }
        return response.data as JSONRPC;
    } catch (error) {
        throw new Error(error as string);
    }
}

export default fetchAPI;
