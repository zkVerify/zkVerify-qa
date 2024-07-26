import {initializeApi, submitProof, validateEnvVariables, validateProofTypes} from '../utils/helpers';
import { generateAndVerifyProof } from './common/generate-proof';
import { handleTransaction } from '../utils/transactions';
import { Mutex } from 'async-mutex';
import { proofTypeToPallet } from '../config';
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import 'dotenv/config';

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
    validateEnvVariables(['WEBSOCKET', 'SEED_PHRASE']);
    console.log("Environment variables validated.");

    const { api, provider, account, nonce } = await initializeApi();
    console.log("API connected and node synced.");

    const proofTypes = (process.argv[2] || 'groth16').split(',');
    validateProofTypes(proofTypes);

    const interval = (parseInt(process.argv[3], 10) || 5) * 1000;
    const duration = (parseInt(process.argv[4], 10) || 60) * 1000;
    const skipAttestation = process.argv[5] === 'true';

    const proofCounter: { [key: string]: number } = {};
    const errorCounter: { [key: string]: number } = {};
    proofTypes.forEach(proofType => {
        proofCounter[proofType] = 0;
        errorCounter[proofType] = 0;
    });

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
