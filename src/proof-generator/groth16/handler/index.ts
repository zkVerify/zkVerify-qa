import { Proof, ProofHandler } from "../../types";
import { ProofInner } from "../../types";
import { formatProof as formatGroth16Proof, formatVk as formatGroth16Vk, formatPubs as formatGroth16Pubs } from "../utils";

class Groth16Handler implements ProofHandler {
    formatProof(proof: any, publicSignals?: string[]): Proof<ProofInner> {
        return formatGroth16Proof(proof);
    }

    formatVk(vkJson: any) {
        return formatGroth16Vk(vkJson);
    }

    formatPubs(pubs: string[]) {
        return formatGroth16Pubs(pubs);
    }
}

export default new Groth16Handler();
