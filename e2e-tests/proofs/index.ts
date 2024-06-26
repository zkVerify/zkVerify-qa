import { fflonkProofData } from '../data/fflonk';
import { boojumProofData } from '../data/boojum';
import { risc0ProofData } from '../data/risc0';
import { groth16ProofData } from '../data/groth16';

export interface Proofs {
    [key: string]: {
        pallet: string;
        getParams: (valid: boolean) => any[];
    };
}

export const proofs: Proofs = {
    fflonk: {
        pallet: 'settlementFFlonkPallet',
        getParams: (valid: boolean) => [
            { 'Vk': fflonkProofData.vk },
            valid ? fflonkProofData.proof : fflonkProofData.invalid_proof,
            fflonkProofData.pubs
        ],
    },
    boojum: {
        pallet: 'settlementZksyncPallet',
        getParams: (valid: boolean) => [
            { 'Vk': boojumProofData.vk },
            valid ? boojumProofData.proof : boojumProofData.invalid_proof,
            boojumProofData.pubs
        ]
    },
    risc0: {
        pallet: 'settlementRisc0Pallet',
        getParams: (valid: boolean) => [
            { 'Vk': risc0ProofData.vk },
            valid ? risc0ProofData.proof : risc0ProofData.invalid_proof,
            risc0ProofData.pubs
        ]
    },
    groth16: {
        pallet: 'settlementGroth16Pallet',
        getParams: (valid: boolean) => [
            { 'Vk': groth16ProofData.vk },
            valid ? groth16ProofData.proof : groth16ProofData.invalid_proof,
            groth16ProofData.pubs
        ]
    }
};
