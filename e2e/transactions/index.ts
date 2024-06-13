import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { handleEvents, waitForAttestationId, waitForNewAttestation } from '../helpers';

export const clearResources = (timerRefs: { interval: NodeJS.Timeout | null, timeout: NodeJS.Timeout | null }) => {
    if (timerRefs.interval) clearInterval(timerRefs.interval);
    if (timerRefs.timeout) clearTimeout(timerRefs.timeout);
};

const handleInBlock = (
    events: any[],
    proofType: string,
    startTime: number,
    blockHash: string,
    setAttestationId: (id: string) => void
) => {
    console.log(`Valid ${proofType} Transaction included in block ${blockHash} (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
    handleEvents(events, (data) => {
        if (data && data.length > 1) {
            setAttestationId(data[1].toString());
            console.log(`Valid ${proofType} Proof Verified:\n  - Attestation Id: ${data[1].toString()}\n  - Proof Leaf: ${data[0].toString()}`);
        }
    });
};

const handleFinalized = async (
    proofType: string,
    expectsError: boolean,
    attestation_id: string | null,
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
            if (attestation_id) {
                await waitForAttestationId(attestation_id);
                const eventData = await waitForNewAttestation(api, 360000, attestation_id, startTime);
                const [attestationId, proofsAttestation] = eventData;
                if (Number.isInteger(attestationId) && /^0x[a-fA-F0-9]{64}$/.test(proofsAttestation)) {
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

export const handleTransaction = async (
    api: ApiPromise,
    submitProof: SubmittableExtrinsic<"promise">,
    account: KeyringPair,
    proofType: string,
    startTime: number,
    expectsError = false,
    timerRefs: { interval: NodeJS.Timeout | null, timeout: NodeJS.Timeout | null }
): Promise<string> => {
    const validityPrefix = expectsError ? "Invalid" : "Valid";
    let attestation_id: string | null = null;

    const setAttestationId = (id: string) => {
        attestation_id = id;
    };

    return new Promise((resolve, reject) => {
        timerRefs.timeout = setTimeout(() => {
            clearResources(timerRefs);
            reject(new Error(`Test timed out waiting for ${validityPrefix} ${proofType} proof transaction finalization`));
        }, 60000) as NodeJS.Timeout;

        submitProof.signAndSend(account, async ({ events, status, dispatchError }) => {
            try {
                if (status.isInBlock) {
                    handleInBlock(events, proofType, startTime, status.asInBlock.toString(), setAttestationId);

                    timerRefs.interval = setInterval(() => {
                        let elapsed = (Date.now() - startTime) / 1000;
                        console.log(`Waiting for ${validityPrefix} ${proofType} transaction to finalize... (elapsed time: ${elapsed} seconds)`);
                    }, 5000) as NodeJS.Timeout;
                }

                if (status.isFinalized) {
                    clearResources(timerRefs);
                    const result = await handleFinalized(proofType, expectsError, attestation_id, dispatchError, api, startTime);
                    resolve(result);
                }
            } catch (error) {
                clearResources(timerRefs);
                console.error(`${validityPrefix} ${proofType} Transaction submission failed with an error: ${error}`);
                reject(error);
            }
        });
    });
};
