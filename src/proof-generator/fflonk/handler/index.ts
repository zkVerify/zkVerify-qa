import { ProofHandler } from "../../types";
import { FflonkVerificationKey } from "../types";
import { formatProof as formatFflonkProof, formatVk as formatFflonkVk } from "../utils";

class FflonkHandler implements ProofHandler {
    formatProof(proof: any, publicSignals: string[]): string {
        return formatFflonkProof(proof);
    }

    formatVk(vkJson: any): FflonkVerificationKey {
        return formatFflonkVk(vkJson);
    }
}

export default new FflonkHandler();
