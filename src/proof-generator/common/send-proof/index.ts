import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { createApi, waitForNodeToSync } from '../../../utils/helpers';
import { generateAndVerifyProof } from '../generate-proof';
import { handleTransaction } from '../../../utils/transactions';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { validateProofTypes } from '../../utils';
import { proofTypeToPallet } from '../../config';

const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
    });
};

/**
 * Submits a proof to the specified pallet.
 *
 * @param {ApiPromise} api - The Polkadot API instance.
 * @param {string} pallet - The pallet to which the proof will be submitted.
 * @param {any[]} params - The parameters for the proof submission.
 * @returns {SubmittableExtrinsic<'promise'>} - The extrinsic for the proof submission.
 * @throws {Error} - Throws an error with detailed information if proof submission fails.
 */
const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<'promise'> => {
    try {
        return api.tx[pallet].submitProof(...params);
    } catch (error: any) {
        const errorDetails = `
            Error submitting proof:
            Pallet: ${pallet}
            Params: ${JSON.stringify(params, null, 2)}
            Error: ${error.message}
        `;
        console.error(errorDetails);
        throw new Error(errorDetails);
    }
};

const main = async (): Promise<void> => {
    const proofType = process.argv[2];
    if (!proofType) {
        throw new Error('Proof type argument is required. Usage: npm run send-proof <proof-type>');
    }

    validateProofTypes([proofType]);

    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);

    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofCounter: { [key: string]: number } = {};
    proofCounter[proofType] = 0;

    const nonceMutex = new Mutex();

    try {
        console.log(`Generating the proof for ${proofType}`);
        const { proof, publicSignals, vk } = await generateAndVerifyProof(proofType);

        const proofParams = [
            { 'Vk': vk },
            proof,
            publicSignals
        ];

        const transaction = submitProof(api, proofTypeToPallet[proofType], proofParams);

        let currentNonce!: number;
        await nonceMutex.runExclusive(() => {
            currentNonce = nonce.value;
            nonce.value += 1;
        });

        const startTime = Date.now();
        const timerRefs = { interval: null as NodeJS.Timeout | null, timeout: null as NodeJS.Timeout | null };

        const result = await handleTransaction(api, transaction, account, proofType, startTime, false, timerRefs);
        proofCounter[proofType]++;

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Sent 1 proof, total ${proofCounter[proofType]} proofs, elapsed time: ${elapsedTime}s, result: ${result.result}, attestationId: ${result.attestationId}`);
    } catch (error) {
        console.error(`Failed to send proof: ${error}`);
    } finally {
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
        process.exit(0);
    }
};

main().catch(console.error);
