import { validateEnvVariables } from '../utils/helpers';
import { generateAndNativelyVerifyProof } from './common/generate-proof';
import { ProofConfig } from './types';
import { Mutex } from 'async-mutex';
import { proofTypeToPallet } from '../config';
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import 'dotenv/config';
import * as fs from 'fs';
import * as readline from 'readline';
import path from "path";
const clc = require('cli-color');
//TODO: This needs additional work to use zkverifyjs!!
/**
 * Send a proof to the blockchain.
 *
 * @param {ApiPromise} api - The API instance.
 * @param {KeyringPair} account - The account to use for sending the transaction.
 * @param {string} proofType - The type of the proof.
 * @param {(valid: boolean) => any[]} getParams - Function to get the parameters for the transaction.
 * @param {Mutex} nonceMutex - Mutex to handle nonce updates.
 * @param {{ value: number }} nonce - The current nonce value.
 * @param {boolean} waitForPublishedAttestation - Flag to skip waiting for attestation.
 * @param {Mutex} countMutex - Mutex to handle proof count updates.
 * @param {number} proofCount - Reference to the proof count for logging
 * @param {number} completedCount - Reference to the completed proof count for logging
 * @returns {Promise<void>} A promise that resolves when the proof is sent.
 */
const sendProof = async (
    api: ApiPromise,
    account: KeyringPair,
    proofType: string,
    getParams: (valid: boolean) => any[],
    nonceMutex: Mutex,
    nonce: { value: number },
    waitForPublishedAttestation: boolean,
    countMutex: Mutex,
    proofCount: { [key: string]: number },
    completedCount: { [key: string]: number }
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

    await countMutex.runExclusive(() => {
        proofCount[proofType] += 1;
        console.log(clc.green(`Sending 1 proof of type ${proofType} (Total sent: ${proofCount[proofType]})`));
    });

    try {
        const result = await handleTransaction(api, transaction, account, proofType, startTime, false, timerRefs, currentNonce, waitForPublishedAttestation);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        await countMutex.runExclusive(() => {
            completedCount[proofType] += 1;
            console.log(clc.blue(`Proof of type ${proofType} finalized, elapsed time: ${elapsedTime}s, result: ${result.result}, attestationId: ${result.attestationId}`));
        });
    } catch (error) {
        console.error(clc.red(`Error sending ${proofType} proof:`, error));
    }
};

/**
 * Prompts the user for confirmation.
 *
 * @param {string} message - The message to display for confirmation.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, otherwise false.
 */
const promptConfirmation = (message: string): Promise<boolean> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
};

/**
 * Main function to orchestrate proof generation and submission.
 *
 * @returns {Promise<void>} A promise that resolves when the main function completes.
 */
const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'SEED_PHRASE_1']);
    console.log("Environment variables validated.");

    const configPath = path.join(__dirname, 'config.json');
    const config: { proofs: ProofConfig[] } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const proofsConfig = config.proofs;

    validateProofTypes(proofsConfig.map((proof: ProofConfig) => proof.type));

    console.log("\n=== Proof Generation Configuration ===");
    proofsConfig.forEach((proof: ProofConfig, index: number) => {
        console.log(`\n--- Proof ${index + 1} ---`);
        console.log(`  Proof Type        : ${proof.type}`);
        console.log(`  Rate              : ${proof.rate} proofs per interval`);
        console.log(`  Interval          : ${proof.interval} seconds`);
        console.log(`  Duration          : ${proof.duration} seconds`);
        console.log(`  Wait For Published Attestation  : ${proof.waitForPublishedAttestation}`);
        console.log(`--------------------------`);
    });

    const confirmed = await promptConfirmation("Do you want to start the test with the above settings?");
    if (!confirmed) {
        console.log("Test aborted.");
        process.exit(0);
    }

    const { api, provider, account, nonce } = await initializeApi();
    console.log("API connected and node synced.");

    try {
        const nonceMutex = new Mutex();
        const countMutex = new Mutex();

        const proofCount: { [key: string]: number } = {};
        const completedCount: { [key: string]: number } = {};

        const proofPromises = proofsConfig.map(proofConfig => {
            const { type, rate, interval, duration, waitForPublishedAttestation } = proofConfig;
            proofCount[type] = 0;
            completedCount[type] = 0;
            const endTime = Date.now() + duration * 1000;

            const sendProofs = async () => {
                for (let i = 0; i < rate; i++) {
                    try {
                        const { proof, publicSignals, vk } = await generateAndNativelyVerifyProof(type);
                        const proofParams = [
                            { 'Vk': vk },
                            proof,
                            publicSignals
                        ];
                        await sendProof(api, account, type, () => proofParams, nonceMutex, nonce, waitForPublishedAttestation, countMutex, proofCount, completedCount);
                    } catch (error) {
                        console.error(clc.red(`Failed to send ${type} proof: ${error}`));
                    }
                }
            };

            return new Promise<void>(resolve => {
                const intervalId = setInterval(async () => {
                    if (Date.now() >= endTime) {
                        clearInterval(intervalId);
                        resolve();
                    } else {
                        await sendProofs();
                    }
                }, interval * 1000);
            });
        });

        await Promise.all(proofPromises);

        console.log("\n=== Proof Sending Summary ===");
        for (const type of Object.keys(proofCount)) {
            console.log(clc.cyan(`Total ${type} proofs sent: ${proofCount[type]}`));
            console.log(clc.cyan(`Total ${type} proofs completed: ${completedCount[type]}`));
        }

        console.log("All in-progress transactions have completed.");
    } catch (error) {
        console.error(clc.red(`Failed to process proofs: ${(error as Error).message}`));
    } finally {
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
    }
};

main().catch(console.error);
