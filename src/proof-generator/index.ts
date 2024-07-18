import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { createApi, waitForNodeToSync } from '../utils/helpers';
import { handleTransaction } from '../utils/transactions';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { generateAndVerifyProof } from './common/generate-proof';
import { proofTypeToPallet } from './config';

/**
 * Validate required environment variables.
 *
 * @param {string[]} variables - List of environment variable names to validate.
 * @throws {Error} If any of the required environment variables is not set.
 */
const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
        if (envVar === 'PRIVATE_KEY' && process.env[envVar] === 'INSERT_SEED_PHRASE') {
            throw new Error('The PRIVATE_KEY environment variable has not been set.');
        }
    });
};

/**
 * Create a SubmittableExtrinsic for submitting a proof.
 *
 * @param {ApiPromise} api - The API instance.
 * @param {string} pallet - The pallet name.
 * @param {any[]} params - The parameters to pass to the extrinsic.
 * @returns {SubmittableExtrinsic<'promise'>} The created SubmittableExtrinsic.
 */
const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<'promise'> => {
    return api.tx[pallet].submitProof(...params);
};

/**
 * Send a proof to the blockchain.
 *
 * @param {ApiPromise} api - The API instance.
 * @param {KeyringPair} account - The account to use for sending the transaction.
 * @param {string} proofType - The type of the proof.
 * @param {(valid: boolean) => any[]} getParams - Function to get the parameters for the transaction.
 * @param {{ [key: string]: number }} proofCounter - Object to keep track of the number of proofs sent.
 * @param {Mutex} nonceMutex - Mutex to handle nonce updates.
 * @param {{ value: number }} nonce - The current nonce value.
 * @param {boolean} skipAttestation - Flag to skip waiting for attestation.
 * @returns {Promise<void>} A promise that resolves when the proof is sent.
 */
const sendProof = async (
    api: ApiPromise,
    account: KeyringPair,
    proofType: string,
    getParams: (valid: boolean) => any[],
    proofCounter: { [key: string]: number },
    nonceMutex: Mutex,
    nonce: { value: number },
    skipAttestation: boolean
): Promise<void> => {
    const params = getParams(true);
    const pallet = proofTypeToPallet[proofType];
    if (!pallet) {
        throw new Error(`Pallet name not found for proof type: ${proofType}`);
    }

    const transaction = submitProof(api, pallet, params);
    let currentNonce!: number;
    await nonceMutex.runExclusive(() => {
        currentNonce = nonce.value;
        nonce.value += 1;
    });

    const startTime = Date.now();
    const timerRefs = { interval: null as NodeJS.Timeout | null, timeout: null as NodeJS.Timeout | null };

    try {
        const result = await handleTransaction(api, transaction, account, proofType, startTime, false, timerRefs, currentNonce, skipAttestation);
        proofCounter[proofType]++;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Sent 1 proof, total ${proofCounter[proofType]} proofs, elapsed time: ${elapsedTime}s, result: ${result.result}, attestationId: ${result.attestationId}`);
    } catch (error) {
        console.error(`Error sending ${proofType} proof:`, error);
        await nonceMutex.runExclusive(() => {
            nonce.value -= 1;
        });
    }
};

/**
 * Main function to orchestrate proof generation and submission.
 *
 * @returns {Promise<void>} A promise that resolves when the main function completes.
 */
const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);

    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofTypes = (process.argv[4] || 'groth16').split(',');
    const proofCounter: { [key: string]: number } = {};
    proofTypes.forEach(proofType => {
        proofCounter[proofType] = 0;
    });

    const unknownProofTypes: string[] = proofTypes.filter(pt => !proofTypeToPallet.hasOwnProperty(pt));
    if (unknownProofTypes.length > 0) {
        console.warn(`The following proof types are not configured in proofTypeToPallet mapping: ${unknownProofTypes.join(', ')}`);
        console.warn('Consider adding them to the proofTypeToPallet mapping in the configuration file.');
    }

    const interval = (parseInt(process.argv[2], 10) || 5) * 1000;
    const duration = (parseInt(process.argv[3], 10) || 60) * 1000;
    const skipAttestation = process.argv[5] === 'true';

    try {
        const startTime = Date.now();
        const endTime = startTime + duration;

        const nonceMutex = new Mutex();

        const intervalId = setInterval(async () => {
            if (Date.now() > endTime) {
                clearInterval(intervalId);
                console.log(`Final counts of proofs sent (total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s):`);
                proofTypes.forEach(proofType => {
                    console.log(`${proofType}: ${proofCounter[proofType]}`);
                });
                if (api) await api.disconnect();
                if (provider) await provider.disconnect();
                process.exit(0);
            } else {
                for (const proofType of proofTypes) {
                    try {
                        console.log(`Generating the ${proofType} proof`);
                        const { proof, publicSignals, vk } = await generateAndVerifyProof(proofType);
                        const proofParams = [
                            { 'Vk': vk },
                            proof,
                            publicSignals
                        ];

                        console.log(`Sending the ${proofType} proof`);
                        await sendProof(api, account, proofType, () => proofParams, proofCounter, nonceMutex, nonce, skipAttestation);
                    } catch (error) {
                        console.error(`Failed to send ${proofType} proof: ${error}`);
                    }
                }
            }
        }, interval);

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                clearInterval(intervalId);
                resolve();
            }, duration);
        });
    } catch (error) {
        console.error(`Failed to load proof types: ${(error as Error).message}`);
        process.exit(1);
    }
};

main().catch(console.error);
