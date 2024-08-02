import { ProofHandler } from "../../types";

class Risc0Handler implements ProofHandler {
    formatProof(proof: any): string {
        return JSON.stringify(proof);
    }

    formatVk(vkJson: any): any {
        return vkJson;
    }

    formatPubs(pubs: any[]): string {
        return JSON.stringify(pubs);
    }

    async generateProof(inputs: any): Promise<{ proof: any; publicSignals: any }> {
        const proof = {};
        const publicSignals = [];
        return { proof, publicSignals };
    }

    async verifyProof(proof: any, publicSignals: any, vk: any): Promise<boolean> {
        return true;
    }

    generateUniqueInput(): any {
    }
}

export default new Risc0Handler();
