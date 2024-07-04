import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { handleEvents, waitForNewAttestation } from '../helpers';

/**
 * Clears timeout and interval resources.
 * @param timerRefs - An object containing interval and timeout references.
 */
export const clearResources = (timerRefs: { interval: NodeJS.Timeout | null, timeout: NodeJS.Timeout | null }) => {
    if (timerRefs.interval) clearInterval(timerRefs.interval);
    if (timerRefs.timeout) clearTimeout(timerRefs.timeout);
};

/**
 * Handles events when a transaction is included in a block.
 * @param events - The events emitted.
 * @param proofType - The type of the proof.
 * @param startTime - The start time of the transaction.
 * @param blockHash - The hash of the block containing the transaction.
 * @param setAttestationId - Callback to set the attestation ID.
 * @param expectsError - Boolean indicating if an error is expected.
 */
const handleInBlock = (
    events: any[],
    proofType: string,
    startTime: number,
    blockHash: string,
    setAttestationId: (id: string) => void,
    expectsError: boolean
) => {
    const validityPrefix = expectsError ? "Invalid" : "Valid";
    console.log(`${validityPrefix} ${proofType} Transaction included in block ${blockHash} (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
    handleEvents(events, (data) => {
        if (data && data.length > 1) {
            setAttestationId(data[1].toString());
            console.log(`${validityPrefix} ${proofType} Proof Verified:\n  - Attestation Id: ${data[1].toString()}\n  - Proof Leaf: ${data[0].toString()}`);
        }
    });
};

/**
 * Handles the finalization of a transaction.
 * @param proofType - The type of the proof.
 * @param expectsError - Boolean indicating if an error is expected.
 * @param attestationId - The attestation ID.
 * @param dispatchError - Any dispatch error that occurred.
 * @param api - The ApiPromise instance.
 * @param startTime - The start time of the transaction.
 * @returns A promise that resolves to a string indicating the result.
 */
const handleFinalized = async (
    proofType: string,
    expectsError: boolean,
    attestationId: string | null,
    dispatchError: any,
    api: ApiPromise,
    startTime: number
): Promise<string> => {
    const validityPrefix = expectsError ? "Invalid" : "Valid";
    console.log(`${validityPrefix} ${proofType} Transaction finalized (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);

    if (dispatchError) {
        if (expectsError) {
            console.log(`Invalid ${proofType} Transaction failed as expected with error.`);
            return 'failed as expected';
        } else {
            throw new Error(`Unexpected error: ${dispatchError.toString()}`);
        }
    } else {
        if (expectsError) {
            throw new Error('Transaction was expected to fail but succeeded.');
        } else {
            if (attestationId) {
                const eventData = await waitForNewAttestation(api, 360000, attestationId, startTime);
                const [id, proofsAttestation] = eventData;
                if (Number.isInteger(id) && /^0x[a-fA-F0-9]{64}$/.test(proofsAttestation)) {
                    return 'succeeded';
                } else {
                    throw new Error('Invalid attestation data.');
                }
            } else {
                throw new Error('No attestation ID found.');
            }
        }
    }
};

/**
 * Main function to handle transaction submission and finalization.
 * @param api - The ApiPromise instance.
 * @param submitProof - The SubmittableExtrinsic instance representing the proof submission.
 * @param account - The KeyringPair account to use for signing the transaction.
 * @param proofType - The type of the proof.
 * @param startTime - The start time of the transaction.
 * @param expectsError - Boolean indicating if an error is expected.
 * @param timerRefs - An object containing interval and timeout references.
 * @returns A promise that resolves to an object containing the result and attestation ID.
 */
export const handleTransaction = async (
    api: ApiPromise,
    submitProof: SubmittableExtrinsic<"promise">,
    account: KeyringPair,
    proofType: string,
    startTime: number,
    expectsError = false,
    timerRefs: { interval: NodeJS.Timeout | null, timeout: NodeJS.Timeout | null }
): Promise<{ result: string, attestationId: string | null }> => {
    const validityPrefix = expectsError ? "Invalid" : "Valid";
    let attestation_id: string | null = null;

    const setAttestationId = (id: string) => {
        attestation_id = id;
    };

    return new Promise<{ result: string, attestationId: string | null }>((resolve, reject) => {
        let isFinalized = false;

        // Set timeout for transaction finalization
        timerRefs.timeout = setTimeout(() => {
            clearResources(timerRefs);
            reject(new Error(`Test timed out waiting for ${validityPrefix} ${proofType} proof transaction finalization`));
        }, 60000) as NodeJS.Timeout;

        // Sign and send the transaction
        submitProof.signAndSend(account, async ({ events, status, dispatchError }) => {
            try {
                if (status.isInBlock) {
                    handleInBlock(events, proofType, startTime, status.asInBlock.toString(), setAttestationId, expectsError);

                    // Set interval to log waiting status
                    timerRefs.interval = setInterval(() => {
                        if (!isFinalized) {
                            let elapsed = (Date.now() - startTime) / 1000;
                            console.log(`Waiting for ${validityPrefix} ${proofType} transaction to finalize... (elapsed time: ${elapsed} seconds)`);
                        }
                    }, 5000) as NodeJS.Timeout;
                }

                if (status.isFinalized) {
                    isFinalized = true;
                    clearResources(timerRefs);
                    const result = await handleFinalized(proofType, expectsError, attestation_id, dispatchError, api, startTime);
                    resolve({ result, attestationId: attestation_id });
                }
            } catch (error) {
                clearResources(timerRefs);
                console.error(`${validityPrefix} ${proofType} Transaction submission failed with an error: ${error}`);
                reject(error);
            }
        });
    });
};
