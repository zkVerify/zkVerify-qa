//TODO:  replace this and use directly from zkverifyjs when latest version >0.7.0 is published.
import { ProofType } from "zkverifyjs";

export const proofConfigurations: Record<ProofType, { supportedVersions: string[]; requiresLibrary: boolean; requiresCurve: boolean }> = {
    [ProofType.fflonk]: {
        supportedVersions: [],
        requiresLibrary: false,
        requiresCurve: false,
    },
    [ProofType.groth16]: {
        supportedVersions: [],
        requiresLibrary: true,
        requiresCurve: true,
    },
    [ProofType.risc0]: {
        supportedVersions: ["V1_0", "V1_1", "V1_2"],
        requiresLibrary: false,
        requiresCurve: false,
    },
    [ProofType.ultraplonk]: {
        supportedVersions: [],
        requiresLibrary: false,
        requiresCurve: false,
    },
    [ProofType.proofofsql]: {
        supportedVersions: [],
        requiresLibrary: false,
        requiresCurve: false,
    },
};
