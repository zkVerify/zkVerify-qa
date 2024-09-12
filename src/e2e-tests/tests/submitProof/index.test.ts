import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { proofs } from '../../../utils/proofs';
import { createApi, waitForNodeToSync } from '../../../utils/helpers';
import { handleTransaction, clearResources } from '../../../utils/transactions';
import { pollLatestAttestationId } from '../../../utils/ethereum';

const requiredEnvVariables: string[] = ['WEBSOCKET', 'SEED_PHRASE', 'ANVIL', 'ZKV_CONTRACT'];

requiredEnvVariables.forEach(envVar => {
    if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set.`);
    }
});

describe('Proof Submission and Event Handling', () => {
    let api: ApiPromise;
    let provider: WsProvider;
    let startTime: number;
    let timerRefs = { interval: null as NodeJS.Timeout | null, timeout: null as NodeJS.Timeout | null };

    beforeAll(async () => {
        provider = new WsProvider(process.env.WEBSOCKET as string);
        api = await createApi(provider);
        await waitForNodeToSync(api);
    }, 30000);

    afterAll(async () => {
        clearResources(timerRefs);
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
    });

    beforeEach(() => {
        startTime = Date.now();
    });

    afterEach(() => {
        clearResources(timerRefs);
    });

    const proofTypes = Object.entries(proofs);

    const submitProof = (api: ApiPromise, pallet: string, params: any[]) => {
        return api.tx[pallet].submitProof(...params);
    };

    test.each(proofTypes)(
        'should successfully accept a %s proof, emit a NewAttestation event and the attestation posted to ZkVerifyAttestation contract on Ethereum.',
        async (proofType, { pallet, getParams }) => {
            console.log(`Submitting valid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.SEED_PHRASE as string);

            const params = getParams(true);
            const transaction = submitProof(api, pallet, params);
            const { result, attestationId } = await handleTransaction(api, transaction, account, proofType.toString(), startTime, false, timerRefs);
            expect(result).toBe('succeeded');

            // Poll the latestAttestationId on the deployed ZkVerifyAttestation.sol contract
            expect(attestationId).not.toBeNull();
            const expectedId = parseInt(attestationId!, 10);
            const success = await pollLatestAttestationId(expectedId);
            if (!success) {
                console.error(`Attestation ${expectedId} not found on Ethereum contract after timeout`);
                // console.error(`Last known Ethereum block: ${await getLatestBlockNumber()}`);
                // console.error(`zkVerify node latest block: ${await getZkVerifyLatestBlock()}`);
            }
            expect(success).toBe(true);
        },
        300000 // 5 minutes
    );

    test.each(proofTypes)(
        'should reject invalid %s proof upon finalization',
        async (proofType, { pallet, getParams }) => {
            console.log(`Submitting invalid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.SEED_PHRASE as string);

            const params = getParams(false);
            const transaction = submitProof(api, pallet, params);
            const { result } = await handleTransaction(api, transaction, account, proofType.toString(), startTime, true, timerRefs);
            expect(result).toBe('failed as expected');
        },
        120000
    );
});
