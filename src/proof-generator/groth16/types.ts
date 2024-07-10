export interface ProofInner {
    a: string;
    b: string;
    c: string;
}

export interface Proof {
    curve: string;
    proof: ProofInner;
}

export interface VerificationKey {
    curve: string;
    alpha_g1: string;
    beta_g2: string;
    gamma_g2: string;
    delta_g2: string;
    gamma_abc_g1: string[];
}

export interface ProofData {
    proof: Proof;
    publicSignals: string[];
    vk: VerificationKey;
}
