import { performVerifyTransaction, performVKRegistrationAndVerification, loadProofData } from './common/utils';
import { ProofType, Groth16CurveType } from 'zkverifyjs';

const proofTypeSeedMap: Record<ProofType, string | undefined> = {
    [ProofType.ultraplonk]: process.env.SEED_PHRASE_1,
    [ProofType.risc0]: process.env.SEED_PHRASE_2,
    [ProofType.fflonk]: process.env.SEED_PHRASE_3,
    [ProofType.groth16]: process.env.SEED_PHRASE_4,
};

const groth16CurveSeedMap: Record<string, string | undefined> = {
    [Groth16CurveType.bn128]: process.env.SEED_PHRASE_4,
    [Groth16CurveType.bn254]: process.env.SEED_PHRASE_5,
    [Groth16CurveType.bls12381]: process.env.SEED_PHRASE_6,
};

const proofTypes = Object.keys(ProofType).map(key => ProofType[key as keyof typeof ProofType]);
const curveTypes = Object.keys(Groth16CurveType).map(key => Groth16CurveType[key as keyof typeof Groth16CurveType]);

export const runVerifyTest = async (
    proofType: ProofType,
    withAttestation: boolean = false,
    checkExistence: boolean = false,
    curve?: Groth16CurveType,
    runInParallel: boolean = false
): Promise<void> => {
    const seedPhrase = !runInParallel
        ? process.env.SEED_PHRASE_1
        : proofType === ProofType.groth16 && curve
            ? groth16CurveSeedMap[curve]
            : proofTypeSeedMap[proofType];

    if (!seedPhrase) {
        throw new Error(`No seed phrase set for proof type ${proofType}${curve ? ` with curve ${curve}` : ''}`);
    }
    console.log(`Running ${proofType} test${curve ? ` with curve: ${curve}` : ''}`);

    const { proof, publicSignals, vk } = loadProofData(proofType, curve);

    await performVerifyTransaction(seedPhrase, proofType, proof, publicSignals, vk, withAttestation, checkExistence, curve);
};

export const runVKRegistrationTest = async (
    proofType: ProofType,
    curve?: Groth16CurveType,
    runInParallel: boolean = false
): Promise<void> => {
    const seedPhrase = !runInParallel
        ? process.env.SEED_PHRASE_1
        : proofType === ProofType.groth16 && curve
            ? groth16CurveSeedMap[curve]
            : proofTypeSeedMap[proofType];

    if (!seedPhrase) {
        throw new Error(`No seed phrase set for proof type ${proofType}${curve ? ` with curve ${curve}` : ''}`);
    }

    console.log(`Running VK registration for ${proofType} test${curve ? ` with curve: ${curve}` : ''}`);
    const { proof, publicSignals, vk } = loadProofData(proofType, curve);

    await performVKRegistrationAndVerification(seedPhrase, proofType, proof, publicSignals, vk);
};

export const runProofWithoutAttestation = async (runInParallel: boolean = false): Promise<void> => {
    if (runInParallel) {
        await Promise.allSettled(
            proofTypes.map(proofType => {
                if (proofType === ProofType.groth16) {
                    return Promise.allSettled(
                        curveTypes.map(curve => runVerifyTest(proofType, false, false, curve, runInParallel))
                    );
                } else {
                    return runVerifyTest(proofType, false, false, undefined, runInParallel);
                }
            })
        );
    } else {
        for (const proofType of proofTypes) {
            if (proofType === ProofType.groth16) {
                for (const curve of curveTypes) {
                    await runVerifyTest(proofType, false, false, curve, runInParallel);
                }
            } else {
                await runVerifyTest(proofType, false, false, undefined, runInParallel);
            }
        }
    }
};

export const runProofWithAttestation = async (runInParallel: boolean = false): Promise<void> => {
    if (runInParallel) {
        await Promise.allSettled(
            proofTypes.map(proofType => {
                if (proofType === ProofType.groth16) {
                    return Promise.allSettled(
                        curveTypes.map(curve => runVerifyTest(proofType, true, true, curve, runInParallel))
                    );
                } else {
                    return runVerifyTest(proofType, true, true, undefined, runInParallel);
                }
            })
        );
    } else {
        for (const proofType of proofTypes) {
            if (proofType === ProofType.groth16) {
                for (const curve of curveTypes) {
                    await runVerifyTest(proofType, true, true, curve, runInParallel);
                }
            } else {
                await runVerifyTest(proofType, true, true, undefined, runInParallel);
            }
        }
    }
};

export const runVKRegistrationTests = async (runInParallel: boolean = false): Promise<void> => {
    if (runInParallel) {
        await Promise.allSettled(
            proofTypes.map(proofType => {
                if (proofType === ProofType.groth16) {
                    return Promise.allSettled(
                        curveTypes.map(curve => runVKRegistrationTest(proofType, curve, runInParallel))
                    );
                } else {
                    return runVKRegistrationTest(proofType, undefined, runInParallel);
                }
            })
        );
    } else {
        for (const proofType of proofTypes) {
            if (proofType === ProofType.groth16) {
                for (const curve of curveTypes) {
                    await runVKRegistrationTest(proofType, curve, runInParallel);
                }
            } else {
                await runVKRegistrationTest(proofType, undefined, runInParallel);
            }
        }
    }
};
