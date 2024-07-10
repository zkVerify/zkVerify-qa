import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { createApi, waitForNodeToSync } from '../../../utils/helpers';
import { generateAndVerifyProof } from '../index';
import { handleTransaction } from '../../../utils/transactions';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';
import { SubmittableExtrinsic } from '@polkadot/api/types';

const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
    });
};

const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<'promise'> => {
    return api.tx[pallet].submitProof(...params);
};

const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);

    const provider = new WsProvider(process.env.WEBSOCKET as string);
    const api = await createApi(provider);
    await waitForNodeToSync(api);

    const keyring = new Keyring({ type: 'sr25519' });
    const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

    const initialNonce: BN = await api.rpc.system.accountNextIndex(account.address) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofCounter: { [key: string]: number } = {};
    proofCounter["groth16"] = 0;

    const nonceMutex = new Mutex();

    try {
        console.log("Generating the proof");
        const { proof, publicSignals, vk } = await generateAndVerifyProof();

        const proofParams = [
            { 'Vk': vk },
            proof,
            publicSignals
        ];

        const transaction = submitProof(api, 'settlementGroth16Pallet', proofParams);
        let currentNonce!: number;
        await nonceMutex.runExclusive(() => {
            currentNonce = nonce.value;
            nonce.value += 1;
        });

        const startTime = Date.now();
        const timerRefs = { interval: null as NodeJS.Timeout | null, timeout: null as NodeJS.Timeout | null };

        const result = await handleTransaction(api, transaction, account, "groth16", startTime, false, timerRefs);
        proofCounter["groth16"]++;

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Sent 1 proof, total ${proofCounter["groth16"]} proofs, elapsed time: ${elapsedTime}s, result: ${result.result}, attestationId: ${result.attestationId}`);
    } catch (error) {
        console.error(`Failed to send proof: ${error}`);
    } finally {
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
        process.exit(0);
    }
};

main().catch(console.error);
