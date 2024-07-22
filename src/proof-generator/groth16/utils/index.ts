import { Groth16VerificationKey } from "../types";
import { ProofInner } from "../../types";
import { formatG1Point, formatG2Point } from "../../utils";

/**
 * Formats the zk-SNARK proof data for Groth16.
 *
 * @param {any} proof - The raw proof data.
 * @returns {ProofInner} - The formatted proof data.
 */
export const formatProof = (proof: any): ProofInner => {
    return {
        a: formatG1Point(proof.pi_a),
        b: formatG2Point(proof.pi_b),
        c: formatG1Point(proof.pi_c),
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

