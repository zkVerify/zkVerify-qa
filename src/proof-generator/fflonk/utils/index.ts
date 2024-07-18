import { FflonkVerificationKey } from "../types";

/**
 * Converts a 256-bit big-endian unsigned integer to a hexadecimal string.
 *
 * @param {bigint} value - The value to convert.
 * @returns {string} - The hexadecimal string representation of the value.
 */
export const toBigEndianHex = (value: bigint): string => {
    return '0x' + value.toString(16).padStart(64, '0');
};

/**
 * Formats the FFLONK verification key.
 *
 * @param {any} vkJson - The raw verification key data.
 * @returns {FflonkVerificationKey} - The formatted verification key.
 */
export const formatVk = (vkJson: any): FflonkVerificationKey => {
    return {
        power: vkJson.power,
        k1: toBigEndianHex(BigInt(vkJson.k1)),
        k2: toBigEndianHex(BigInt(vkJson.k2)),
        w: toBigEndianHex(BigInt(vkJson.w)),
        w3: toBigEndianHex(BigInt(vkJson.w3)),
        w4: toBigEndianHex(BigInt(vkJson.w4)),
        w8: toBigEndianHex(BigInt(vkJson.w8)),
        wr: toBigEndianHex(BigInt(vkJson.wr)),
        X_2: vkJson.X_2.map((coord: string[]) => coord.map((val: string) => toBigEndianHex(BigInt(val)))),
        C0: vkJson.C0.map((val: string) => toBigEndianHex(BigInt(val))),
    };
};
