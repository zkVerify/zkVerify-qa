import { ProofHandler } from "../../types";
import { FflonkVerificationKey } from "../types";
import { formatProof as formatFflonkProof, formatVk as formatFflonkVk, formatPubs as formatFflonkPubs } from "../utils";

class FflonkHandler implements ProofHandler {
    formatProof(proof: any, publicSignals: string[]): string {
        return formatFflonkProof(proof);
    }

    formatVk(vkJson: any): FflonkVerificationKey {
        return formatFflonkVk(vkJson);
    }

    formatPubs(pubs: string[]): string {
        return formatFflonkPubs(pubs);
    }
}

export default new FflonkHandler();
