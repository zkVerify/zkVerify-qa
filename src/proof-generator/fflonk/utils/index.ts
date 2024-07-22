import { FflonkVerificationKey } from "../types";

/**
 * Formats the FFLONK verification key.
 *
 * @param {any} vkJson - The raw verification key data.
 * @returns {FflonkVerificationKey} - The formatted verification key.
 */
export const formatVk = (vkJson: any): FflonkVerificationKey => {
    const vkObject = typeof vkJson === 'string' ? JSON.parse(vkJson) : vkJson;

    return {
        ...vkObject,
        get x2() { return this.X_2; },
        get c0() { return this.C0; },
    };
};

/**
 * Formats the FFLONK proof data.
 *
 * @param {any} proof - The raw proof data.
 * @param {string[]} publicSignals - The public signals.
 * @returns {string} - The formatted proof data.
 */
export const formatProof = (proof: any): string => {
    const to32ByteHex = (numStr: string): string => {
        const hexStr = BigInt(numStr).toString(16);
        return hexStr.padStart(64, '0'); // 64 hex chars = 32 bytes
    };

    const formatG1 = (g1: string[]): string[] => g1.slice(0, 2).map(to32ByteHex);

    const formattedPolynomials = [
        ...formatG1(proof.polynomials.C1),
        ...formatG1(proof.polynomials.C2),
        ...formatG1(proof.polynomials.W1),
        ...formatG1(proof.polynomials.W2),
    ];

    const formattedEvaluations = [
        proof.evaluations.ql, proof.evaluations.qr, proof.evaluations.qm, proof.evaluations.qo, proof.evaluations.qc,
        proof.evaluations.s1, proof.evaluations.s2, proof.evaluations.s3,
        proof.evaluations.a, proof.evaluations.b, proof.evaluations.c,
        proof.evaluations.z, proof.evaluations.zw, proof.evaluations.t1w, proof.evaluations.t2w, proof.evaluations.inv
    ].map(to32ByteHex);


    let combined = [...formattedPolynomials, ...formattedEvaluations];
    if (combined.length !== 24) {
        throw new Error(`Formatted proof length mismatch. Expected 24 elements, got ${combined.length}`);
    }

    const proofHex = combined.join('');
    if (proofHex.length !== 1536) {
        throw new Error(`Formatted proof length mismatch. Expected 1536 hex characters, got ${proofHex.length}`);
    }

    return '0x' + proofHex;
};