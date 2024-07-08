import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { proofs } from '../proofs';
import { createApi, waitForNodeToSync } from '../helpers';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';

/**
 * Validates required environment variables.
 * @param variables - An array of required environment variable names.
 */
const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
    });
};

/**
 * Submits a proof to the blockchain.
 * @param api - The ApiPromise instance.
 * @param pallet - The pallet to which the proof is submitted.
 * @param params - The parameters for the proof submission.
 * @returns The transaction object.
 */
const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<'promise'> => {
    return api.tx[pallet].submitProof(...params);
};

/**
 * Sends a proof to the blockchain.
 * @param api - The ApiPromise instance.
 * @param account - The account used to sign the transaction.
 * @param proofType - The type of the proof.
 * @param pallet - The pallet to which the proof is submitted.
 * @param getParams - Function to get the parameters for the proof submission.
 * @param proofCounter - An object to keep track of the number of proofs sent.
 * @param nonceMutex - A mutex to handle nonce synchronization.
 * @param nonce - An object containing the current nonce value.
 */
const sendProof = async (
    api: ApiPromise,
    account: KeyringPair,
    proofType: string,
    pallet: string,
    getParams: (valid: boolean) => any[],
    proofCounter: { [key: string]: number },
    nonceMutex: Mutex,
    nonce: { value: number }
): Promise<void> => {
    const params = getParams(true);
    const transaction = submitProof(api, pallet, params);
    let currentNonce!: number; // Definite assignment assertion
    await nonceMutex.runExclusive(() => {
        currentNonce = nonce.value;
        nonce.value += 1;
    });
    try {
        await transaction.signAndSend(account, { nonce: currentNonce });
        proofCounter[proofType]++;
    } catch (error) {
        console.error(`Error sending ${proofType} proof:`, error);
        // Handle nonce rollback in case of an error
        await nonceMutex.runExclusive(() => {
            nonce.value -= 1;
        });
    }
};

/**
 * Main function to execute the proof submission.
 */
const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);

    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

    // Retrieve and convert the nonce to a number
    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofTypes: [string, { pallet: string; getParams: (valid: boolean) => any[] }][] = Object.entries(proofs) as [string, { pallet: string; getParams: (valid: boolean) => any[] }][];
    const proofCounter: { [key: string]: number } = {};

    proofTypes.forEach(([proofType, _], index, array) => {
        proofCounter[proofType] = 0;
    });

    // Read interval and duration from command-line arguments or use default values
    const interval = parseInt(process.argv[2], 10) || 1500;
    const duration = parseInt(process.argv[3], 10) || 60000;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const nonceMutex = new Mutex();
    let totalProofsSent = 0;

    const intervalId = setInterval(async () => {
        if (Date.now() > endTime) {
            clearInterval(intervalId);
        } else {
            const proofPromises = proofTypes.map(([proofType, { pallet, getParams }]) =>
                sendProof(api, account, proofType, pallet, getParams, proofCounter, nonceMutex, nonce)
            );
            await Promise.all(proofPromises);
            totalProofsSent += proofTypes.length;
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`Sent ${proofTypes.length} proofs, total ${totalProofsSent} proofs, elapsed time: ${elapsedTime}s`);
        }
    }, interval);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            clearInterval(intervalId);
            resolve();
        }, duration);
    });

    const totalElapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Final counts of proofs sent (total time: ${totalElapsedTime}s):`);
    for (const [proofType, count] of Object.entries(proofCounter)) {
        console.log(`${proofType}: ${count}`);
    }

    if (api) await api.disconnect();
    if (provider) await provider.disconnect();
    process.exit(0);
};

main().catch(console.error);
