import { Groth16VerificationKey } from "../types";
import {Proof, ProofInner} from "../../types";
import { formatG1Point, formatG2Point, formatScalar } from "../../utils";

/**
 * Formats the zk-SNARK proof data for Groth16.
 *
 * @param {any} proof - The raw proof data. The expected structure is:
 *   {
 *     pi_a: [string, string],
 *     pi_b: [[string, string], [string, string]],
 *     pi_c: [string, string]
 *   }
 * @returns {Proof<ProofInner>} - The formatted proof data including the curve information.
 *   The returned object will be of the structure:
 *   {
 *     curve: "Bn254",
 *     proof: {
 *       a: { x: string, y: string },
 *       b: { x: [string, string], y: [string, string] },
 *       c: { x: string, y: string }
 *     }
 *   }
 */
export const formatProof = (proof: any): Proof<ProofInner> => {
    const formattedProof: ProofInner = {
        a: formatG1Point(proof.pi_a),
        b: formatG2Point(proof.pi_b),
        c: formatG1Point(proof.pi_c),
    };

    return {
        curve: "Bn254",
        proof: formattedProof,
    };
};

/**
 * Formats the verification key for use in the zk-SNARK proof for Groth16.
 *
 * @param {any} vkJson - The raw verification key data.
 * @returns {Groth16VerificationKey} - The formatted verification key.
 */
export const formatVk = (vkJson: any): Groth16VerificationKey => {
    return {
        curve: "Bn254",
        alpha_g1: formatG1Point(vkJson.vk_alpha_1),
        beta_g2: formatG2Point(vkJson.vk_beta_2),
        gamma_g2: formatG2Point(vkJson.vk_gamma_2),
        delta_g2: formatG2Point(vkJson.vk_delta_2),
        gamma_abc_g1: vkJson.IC.map((x: any) => formatG1Point(x)),
    };
};

/**
 * Formats an array of public signals by applying the formatScalar function to each element.
 *
 * @param {string[]} pubs - The array of public signals to format.
 * @returns {string[]} - The formatted array of public signals.
 */
export const formatPubs = (pubs: string[]): string[] => {
    return pubs.map(formatScalar);
}
