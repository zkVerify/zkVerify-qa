import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { proofs } from '../proofs';
import { createApi, handleEvents, waitForAttestationId, waitForNewAttestation, waitForNodeToSync } from '../utils';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { KeyringPair } from '@polkadot/keyring/types';

const requiredEnvVariables: string[] = ['WEBSOCKET', 'PRIVATE_KEY'];

requiredEnvVariables.forEach((envVar) => {
    if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set.`);
    }
});

describe('Proof Submission and Event Handling', () => {
    let api: ApiPromise;
    let provider: WsProvider;
    let startTime: number;
    let interval: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout | null = null;

    beforeAll(async () => {
        provider = new WsProvider(process.env.WEBSOCKET as string);
        api = await createApi(provider);
        await waitForNodeToSync(api);
    }, 30000);

    afterAll(async () => {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);

        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
    });

    beforeEach(() => {
        startTime = Date.now();
    });

    afterEach(() => {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
    });

    const submitProof = (api: ApiPromise, pallet: string, proofType: string, proof: any) => {
        if (proofType === 'fflonk') {
            return api.tx[pallet].submitProof(proof, null);
        }
        return api.tx[pallet].submitProof(proof);
    };

    const handleTransaction = async (submitProof: SubmittableExtrinsic<"promise">, account: KeyringPair, proofType: string, expectsError = false) => {
        const validityPrefix = expectsError ? "Invalid" : "Valid";
        let attestation_id = null;
        return new Promise((resolve, reject) => {
            let interval: NodeJS.Timeout | undefined;
            const timeout = setTimeout(() => {
                if (interval) clearInterval(interval);
                reject(new Error(`Test timed out waiting for ${validityPrefix} ${proofType} proof transaction finalization`));
            }, 60000);
    
            submitProof.signAndSend(account, async ({ events, status, dispatchError }) => {
                if (status.isInBlock) {
                    console.log(`${validityPrefix} ${proofType} Transaction included in block (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
                    handleEvents(events, (data) => {
                        if (data && data.length > 1) {
                            attestation_id = data[1].toString();
                            console.log(`${validityPrefix} ${proofType} Proof Verified:\n  - Attestation Id: ${attestation_id}\n  - Proof Leaf: ${data[0].toString()}`);
                        }
                    });
    
                    interval = setInterval(() => {
                        let elapsed = (Date.now() - startTime) / 1000;
                        console.log(`Waiting for ${validityPrefix} ${proofType} transaction to finalize... (elapsed time: ${elapsed} seconds)`);
                    }, 5000);
                }
    
                if (status.isFinalized) {
                    if (interval) clearInterval(interval);
                    clearTimeout(timeout);
                    console.log(`${validityPrefix} ${proofType} Transaction finalized (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
                    if (dispatchError) {
                        if (expectsError) {
                            console.log(`${validityPrefix} ${proofType} Transaction failed as expected with error.`);
                            resolve('failed as expected');
                        } else {
                            console.error(`Unexpected error finalizing ${validityPrefix} ${proofType} transaction.`);
                            reject(new Error(`Unexpected error.`));
                        }
                    } else {
                        if (expectsError) {
                            console.error(`Transaction was expected to fail but succeeded.`);
                            reject(new Error('Transaction was expected to fail but succeeded.'));
                        } else {
                            if (attestation_id) {
                                try {
                                    await waitForAttestationId(attestation_id);
                                    const eventData = await waitForNewAttestation(api, 360000, attestation_id, startTime);
                                    const [attestationId, proofsAttestation] = eventData;
                                    expect(Number.isInteger(attestationId)).toBeTruthy();
                                    expect(proofsAttestation).toMatch(/^0x[a-fA-F0-9]{64}$/);
                                    resolve('succeeded');
                                } catch (err) {
                                    console.error('Failed to handle NewAttestation event:', err);
                                    reject(err);
                                }
                            } else {
                                console.error('No attestation ID found.');
                                reject(new Error('No attestation ID found.'));
                            }
                        }
                    }
                }
            }).catch(error => {
                if (interval) clearInterval(interval);
                clearTimeout(timeout);
                console.error(`${validityPrefix} ${proofType} Transaction submission failed with an error: ${error}`);
                reject(error);
            });
        });
    };

    Object.entries(proofs).forEach(([proofType, { pallet, validProof, invalidProof }]) => {
        test(`should successfully accept a ${proofType} proof, emit a NewAttestation event`, async () => {
            console.log(`Submitting valid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

            const transaction = submitProof(api, pallet, proofType.toString(), validProof);
            const result = await handleTransaction(transaction, account, proofType);
            expect(result).toBe('succeeded');
        }, 300000);

        test(`should reject invalid ${proofType} proof upon finalization`, async () => {
            console.log(`Submitting invalid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

            const transaction = submitProof(api, pallet, proofType.toString(), invalidProof);
            const result = await handleTransaction(transaction, account, proofType, true);
            expect(result).toBe('failed as expected');
        }, 120000);
    });
});
