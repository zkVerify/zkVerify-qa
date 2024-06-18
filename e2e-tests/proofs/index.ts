export interface Proofs {
    [key: string]: {
        pallet: string;
        validProof: string;
        invalidProof: string;
        params?: any[];
    };
}

const getEnvVariable = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
};

export const proofs: Proofs = {
    fflonk: {
        pallet: 'settlementFFlonkPallet',
        validProof: getEnvVariable('FFLONK_PROOF'),
        invalidProof: getEnvVariable('INVALID_FFLONK_PROOF'),
        params: [null]
    },
    boojum: {
        pallet: 'settlementZksyncPallet',
        validProof: getEnvVariable('BOOJUM_PROOF'),
        invalidProof: getEnvVariable('INVALID_BOOJUM_PROOF')
    },
    risc0: {
        pallet: 'settlementRisc0Pallet',
        validProof: getEnvVariable('RISC0_PROOF'),
        invalidProof: getEnvVariable('INVALID_RISC0_PROOF'),
        params: [
            getEnvVariable('VK_RISC0'),
            getEnvVariable('PUBS_RISC0')
        ]
    },
    groth16: {
        pallet: 'settlementGroth16Pallet',
        validProof: JSON.parse(getEnvVariable('GROTH16_PROOF')),
        invalidProof: JSON.parse(getEnvVariable('INVALID_GROTH16_PROOF')),
        params: [
            JSON.parse(getEnvVariable('VK_GROTH16')),
            JSON.parse(getEnvVariable('INPUTS_GROTH16'))
        ]
    }
};
