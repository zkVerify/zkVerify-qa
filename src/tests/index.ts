import { performVerifyTransaction, performVKRegistrationAndVerification, loadProofData } from './common/utils';
import { ProofType, Groth16CurveType } from 'zkverifyjs';
import { getSeedPhrase } from "../utils/wallets";

const proofTypes = Object.keys(ProofType).map(key => ProofType[key as keyof typeof ProofType]);
const curveTypes = Object.keys(Groth16CurveType).map(key => Groth16CurveType[key as keyof typeof Groth16CurveType]);

export const runVerifyTest = async (
    proofType: ProofType,
    withAttestation: boolean = false,
    checkExistence: boolean = false,
    curve?: Groth16CurveType,
    runInParallel: boolean = false
): Promise<void> => {
    const seedPhrase = getSeedPhrase(proofType, curve, runInParallel);
    console.log(`Running ${proofType} test${curve ? ` with curve: ${curve}` : ''}`);

    const { proof, publicSignals, vk } = loadProofData(proofType, curve);

    await performVerifyTransaction(seedPhrase, proofType, proof, publicSignals, vk, withAttestation, checkExistence, curve);
};

export const runVKRegistrationTest = async (
    proofType: ProofType,
    curve?: Groth16CurveType,
    runInParallel: boolean = false
): Promise<void> => {
    const seedPhrase = getSeedPhrase(proofType, curve, runInParallel);
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
