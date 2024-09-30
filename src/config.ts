export enum SupportedProofType {
    fflonk = 'fflonk',
    risc0 = 'risc0',
    ultraplonk = 'ultraplonk',
    groth16 = 'groth16',
}

export const proofTypeToPallet: Record<string, string> = {
    groth16: "settlementGroth16Pallet",
    fflonk: "settlementFFlonkPallet",
    zksync: "settlementZksyncPallet",
    risc0: "settlementRisc0Pallet",
};
