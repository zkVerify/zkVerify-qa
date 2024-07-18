import { ProofData, ProofInner } from '../types';

export interface Groth16VerificationKey {
    curve: string;
    alpha_g1: string;
    beta_g2: string;
    gamma_g2: string;
    delta_g2: string;
    gamma_abc_g1: string[];
}

export interface Groth16ProofData extends ProofData<ProofInner> {
    vk: Groth16VerificationKey;
}
