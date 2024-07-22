import { proofTypeToPallet } from '../config';

/**
 * Converts a bigint value to a little-endian hexadecimal string.
 *
 * @param {bigint} value - The bigint value to convert.
 * @param {number} length - The length of the resulting hexadecimal string in bytes.
 * @returns {string} - The little-endian hexadecimal representation of the value.
 */
export const toLittleEndianHex = (value: bigint, length: number): string => {
    const hex = value.toString(16).padStart(length * 2, '0');
    const bytes = hex.match(/.{1,2}/g)!.reverse().join('');
    return `0x${bytes}`;
};

/**
 * Formats a G1 point for use in the zk-SNARK proof.
 *
 * @param {string[]} point - An array containing the x and y coordinates of the G1 point.
 * @returns {string} - The formatted G1 point as a hexadecimal string.
 */
export const formatG1Point = (point: string[]): string => {
    const x = toLittleEndianHex(BigInt(point[0]), 32);
    const y = toLittleEndianHex(BigInt(point[1]), 32);
    return x + y.slice(2);
};

/**
 * Formats a G2 point for use in the zk-SNARK proof.
 *
 * @param {string[][]} point - A 2D array containing the x and y coordinates of the G2 point.
 * @returns {string} - The formatted G2 point as a hexadecimal string.
 */
export const formatG2Point = (point: string[][]): string => {
    const x1 = toLittleEndianHex(BigInt(point[0][0]), 32);
    const x2 = toLittleEndianHex(BigInt(point[0][1]), 32);
    const y1 = toLittleEndianHex(BigInt(point[1][0]), 32);
    const y2 = toLittleEndianHex(BigInt(point[1][1]), 32);
    return x1 + x2.slice(2) + y1.slice(2) + y2.slice(2);
};

/**
 * Formats a scalar value for use in the zk-SNARK proof.
 *
 * @param {string} scalar - The scalar value to format.
 * @returns {string} - The formatted scalar as a little-endian hexadecimal string.
 */
export const formatScalar = (scalar: string): string => {
    return toLittleEndianHex(BigInt(scalar), 32);
};

/**
 * Validates that all provided proof types exist in the proofTypeToPallet mapping.
 *
 * @param {string[]} proofTypes - The array of proof types to validate.
 * @throws {Error} If any provided proof types are not configured in the proofTypeToPallet mapping.
 */
export const validateProofTypes = (proofTypes: string[]): void => {
    const unknownProofTypes: string[] = proofTypes.filter(pt => !proofTypeToPallet.hasOwnProperty(pt));
    if (unknownProofTypes.length > 0) {
        throw new Error(`The following proof types are not configured in proofTypeToPallet mapping: ${unknownProofTypes.join(', ')}. Consider adding them to the proofTypeToPallet mapping in the configuration file.`);
    }
};