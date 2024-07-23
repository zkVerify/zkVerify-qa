import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import BN from 'bn.js';
import {proofTypeToPallet} from "../../config";

/**
 * Creates an ApiPromise instance with a connection timeout.
 * @param provider - The WebSocket provider.
 * @returns A promise that resolves to the ApiPromise instance.
 * @throws An error if the connection times out.
 */
export async function createApi(provider: WsProvider): Promise<ApiPromise> {
    console.log(`Connecting to WebSocket URL: ${process.env.WEBSOCKET}`);
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Failed to connect to the WebSocket URL: ${process.env.WEBSOCKET}`)), 5000)
    );
    try {
        const api = await Promise.race([ApiPromise.create({ provider }), timeout]);
        console.log(`Successfully connected to WebSocket URL: ${process.env.WEBSOCKET}`);
        return api;
    } catch (error) {
        console.error(`Error connecting to WebSocket URL: ${process.env.WEBSOCKET}`, error);
        throw error;
    }
}

/**
 * Handles events emitted by the zkVerify blockchain.
 * @param events - The array of event records.
 * @param callback - The callback function to execute when the event matches criteria.
 */
export function handleEvents(events: EventRecord[], callback: (data: any[]) => void): void {
    events.forEach(({ event: { data, method, section } }) => {
        if (section === 'poe' && method === 'NewElement') {
            callback(data);
        }
    });
}

/**
 * Waits for a specific NewAttestation event.
 * @param api - The ApiPromise instance.
 * @param timeoutDuration - The duration in milliseconds before timing out.
 * @param attestationId - The attestation ID to wait for.
 * @param startTime - The start time of the operation.
 * @returns A promise that resolves to the attestation data.
 * @throws An error if the attestation ID is null or the wait times out.
 */
export async function waitForNewAttestation(api: ApiPromise, timeoutDuration: number, attestationId: string | null, startTime: number): Promise<[number, string]> {
    return new Promise<[number, string]>(async (resolve, reject) => {
        if (!attestationId) {
            return reject(new Error("Attestation ID is null, cannot wait for event."));
        }

        const timeout = setTimeout(() => {
            console.error("Timeout expired while waiting for NewAttestation event.");
            reject(new Error("Timeout expired"));
        }, timeoutDuration);

        const interval = setInterval(() => {
            console.log(`Waiting for NewAttestation event... (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
        }, 15000);

        try {
            const unsubscribe = await api.query.system.events((events: EventRecord[]) => {
                events.forEach((record) => {
                    const { event } = record;
                    const types = event.typeDef;

                    if (event.section === "poe" && event.method === "NewAttestation") {
                        const currentAttestationId = event.data[0].toString();
                        if (currentAttestationId === attestationId) {
                            clearTimeout(timeout);
                            clearInterval(interval);
                            unsubscribe();
                            console.log(`Matched NewAttestation event with attestation ID: ${attestationId}`);
                            event.data.forEach((data, index) => {
                                console.log(`\t${types[index].type}: ${data.toString()}`);
                            });
                            resolve([parseInt(event.data[0].toString()), event.data[1].toString()]);
                        }
                    }
                });
            }) as unknown as () => void;
        } catch (error) {
            console.error("Error subscribing to system events:", error);
            clearTimeout(timeout);
            clearInterval(interval);
            reject(error);
        }
    });
}

/**
 * Waits for the zkVerify node to sync.
 * @param api - The ApiPromise instance.
 * @returns A promise that resolves when the node is synced.
 */
export async function waitForNodeToSync(api: ApiPromise): Promise<void> {
    console.log("Waiting for the node to sync...");
    let isSyncing = true;
    while (isSyncing) {
        const health = await api.rpc.system.health();
        isSyncing = health.isSyncing.isTrue;
        if (isSyncing) {
            console.log("Node is syncing...");
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    console.log("Node has finished syncing.");
}

/**
 * Validate required environment variables.
 *
 * @param {string[]} variables - List of environment variable names to validate.
 * @throws {Error} If any of the required environment variables is not set.
 */
export const validateEnvVariables = (variables: string[]): void => {
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
 * Validates that all provided proof types exist in the proofTypeToPallet mapping.
 *
 * @param {string[]} proofTypes - The array of proof types to validate.
 * @throws {Error} If any provided proof types are not configured in the proofTypeToPallet mapping.
 */
export const validateProofTypes = (proofTypes: string[]): void => {
    const unknownProofTypes: string[] = proofTypes.filter(pt => !proofTypeToPallet.hasOwnProperty(pt));
    if (unknownProofTypes.length > 0) {
        throw new Error(`The following proof types are not configured in proofTypeToPallet mapping: ${unknownProofTypes.join(', ')}. Consider adding them to the proofTypeToPallet mapping in the configuration file.`);
    }
};

/**
 * Create a SubmittableExtrinsic for submitting a proof.
 *
 * @param {ApiPromise} api - The API instance.
 * @param {string} pallet - The pallet name.
 * @param {any[]} params - The parameters to pass to the extrinsic.
 * @returns {SubmittableExtrinsic<'promise'>} The created SubmittableExtrinsic.
 * @throws {Error} - Throws an error with detailed information if proof submission fails.
 */
export const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<'promise'> => {
    try {
        return api.tx[pallet].submitProof(...params);
    } catch (error: any) {
        const errorDetails = `
            Error submitting proof:
            Pallet: ${pallet}
            Params: ${JSON.stringify(params, null, 2)}
            Error: ${error.message}
        `;
        throw new Error(errorDetails);
    }
};

/**
 * Initialize the API, provider, account, and nonce.
 *
 * @returns {Promise<{ api: ApiPromise, provider: WsProvider, account: KeyringPair, nonce: { value: number } }>} The initialized API, provider, account, and nonce.
 */
export const initializeApi = async (): Promise<{ api: ApiPromise, provider: WsProvider, account: KeyringPair, nonce: { value: number } }> => {
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);
    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);
    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    return { api, provider, account, nonce };
};
