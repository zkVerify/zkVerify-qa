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
 * @param {{ [key: string]: number }} errorCounter - Object to keep track of the number of proofs that failed.
 * @param {Mutex} nonceMutex - Mutex to handle nonce updates.
 * @param {{ value: number }} nonce - The current nonce value.
 * @param {boolean} skipAttestation - Flag to skip waiting for attestation.
 * @param {Promise<void>[]} inProgressTransactions - Array to store in-progress transactions.
 * @returns {Promise<void>} A promise that resolves when the proof is sent.
 */
const sendProof = async (
    api: ApiPromise,
    account: KeyringPair,
    proofType: string,
    getParams: (valid: boolean) => any[],
    proofCounter: { [key: string]: number },
    errorCounter: { [key: string]: number },
    nonceMutex: Mutex,
    nonce: { value: number },
    skipAttestation: boolean,
    inProgressTransactions: Promise<void>[]
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

    proofCounter[proofType]++;
    console.log(`Sent 1 proof of type ${proofType}, total sent: ${proofCounter[proofType]}`);

    const transactionPromise = handleTransaction(api, transaction, account, proofType, startTime, false, timerRefs, currentNonce, skipAttestation)
        .then(result => {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`Proof of type ${proofType} finalized, elapsed time: ${elapsedTime}s`);
        })
        .catch(error => {
            console.error(`Error sending ${proofType} proof:`, error);
            errorCounter[proofType]++;
        });

    inProgressTransactions.push(transactionPromise);
};

/**
 * Main function to orchestrate proof generation and submission.
 *
 * @returns {Promise<void>} A promise that resolves when the main function completes.
 */
const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);
    console.log("Environment variables validated.");

    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);
    console.log("API connected and node synced.");

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);
    console.log(`Using account: ${account.address}`);

    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofTypes = (process.argv[2] || 'groth16').split(',');
    const interval = (parseInt(process.argv[3], 10) || 5) * 1000;
    const duration = (parseInt(process.argv[4], 10) || 60) * 1000;
    const skipAttestation = process.argv[5] === 'true';

    const proofCounter: { [key: string]: number } = {};
    const errorCounter: { [key: string]: number } = {};
    proofTypes.forEach(proofType => {
        proofCounter[proofType] = 0;
        errorCounter[proofType] = 0;
    });

    const unknownProofTypes: string[] = proofTypes.filter(pt => !proofTypeToPallet.hasOwnProperty(pt));
    if (unknownProofTypes.length > 0) {
        console.warn(`The following proof types are not configured in proofTypeToPallet mapping: ${unknownProofTypes.join(', ')}`);
        console.warn('Consider adding them to the proofTypeToPallet mapping in the configuration file.');
    }

    const inProgressTransactions: Promise<void>[] = [];
    try {
        const startTime = Date.now();
        const endTime = startTime + duration;
        const nonceMutex = new Mutex();

        const logSummary = () => {
            console.log(`Proof counts (elapsed time: ${((Date.now() - startTime) / 1000).toFixed(2)}s):`);
            proofTypes.forEach(proofType => {
                console.log(`  ${proofType}: ${proofCounter[proofType]} sent, ${errorCounter[proofType]} failed`);
            });
        };

        const intervalId = setInterval(() => {
            logSummary();
        }, interval);

        while (Date.now() < endTime) {
            for (const proofType of proofTypes) {
                try {
                    const { proof, publicSignals, vk } = await generateAndVerifyProof(proofType);
                    const proofParams = [
                        { 'Vk': vk },
                        proof,
                        publicSignals
                    ];
                    await sendProof(api, account, proofType, () => proofParams, proofCounter, errorCounter, nonceMutex, nonce, skipAttestation, inProgressTransactions);
                } catch (error) {
                    console.error(`Failed to send ${proofType} proof: ${error}`);
                    errorCounter[proofType]++;
                }
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }

        clearInterval(intervalId);
        await Promise.all(inProgressTransactions);

        logSummary();
        console.log("All in-progress transactions have completed.");
        process.exit(0);
    } catch (error) {
        console.error(`Failed to load proof types: ${(error as Error).message}`);
        process.exit(1);
    } finally {
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
    }
};

main().catch(console.error);
