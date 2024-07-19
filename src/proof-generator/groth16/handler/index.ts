import { ProofHandler } from "../../types";
import { ProofInner } from "../../types";
import { formatProof as formatGroth16Proof, formatVk as formatGroth16Vk } from "../utils";

class Groth16Handler implements ProofHandler {
    formatProof(proof: any): ProofInner {
        return formatGroth16Proof(proof);
    }

    formatVk(vkJson: any) {
        return formatGroth16Vk(vkJson);
    }
}

export default new Groth16Handler();
