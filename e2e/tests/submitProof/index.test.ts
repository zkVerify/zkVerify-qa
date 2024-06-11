import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { proofs } from '../../proofs';
import { createApi, waitForNodeToSync } from '../../helpers';
import { handleTransaction } from '../../transactions';

const requiredEnvVariables: string[] = ['WEBSOCKET', 'PRIVATE_KEY'];

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
        if (timerRefs.interval) clearInterval(timerRefs.interval);
        if (timerRefs.timeout) clearTimeout(timerRefs.timeout);
        if (api) await api.disconnect();
        if (provider) await provider.disconnect();
    });

    beforeEach(() => {
        startTime = Date.now();
    });

    afterEach(() => {
        if (timerRefs.interval) clearInterval(timerRefs.interval);
        if (timerRefs.timeout) clearTimeout(timerRefs.timeout);
    });

    const proofTypes = Object.entries(proofs);

    test.each(proofTypes)(
        'should successfully accept a %s proof, emit a NewAttestation event',
        async (proofType, { pallet, validProof }) => {
            console.log(`Submitting valid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

            const submitProof = api.tx[pallet].submitProof(validProof);
            const result = await handleTransaction(api, submitProof, account, proofType.toString(), startTime, false, timerRefs);
            expect(result).toBe('succeeded');
        },
        300000
    );

    test.each(proofTypes)(
        'should reject invalid %s proof upon finalization',
        async (proofType, { pallet, invalidProof }) => {
            console.log(`Submitting invalid ${proofType} proof...`);
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

            const submitProof = api.tx[pallet].submitProof(invalidProof);
            const result = await handleTransaction(api, submitProof, account, proofType.toString(), startTime, true, timerRefs);
            expect(result).toBe('failed as expected');
        },
        60000
    );
});
