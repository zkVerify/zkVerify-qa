import { ProofData } from "../types";

export interface FflonkVerificationKey {
    power: number;
    k1: string;
    k2: string;
    w: string;
    w3: string;
    w4: string;
    w8: string;
    wr: string;
    X_2: string[][];
    C0: string[];
}

export interface FflonkProofData extends ProofData<FflonkVerificationKey> {
    pubs: string;
    vkeyHash: string;
    statementHash: string;
}
