import {initializeApi, submitProof, validateEnvVariables} from '../utils/helpers';
import { generateAndVerifyProof } from '../proof-generator/common/generate-proof';
import { handleTransaction } from '../utils/transactions';
import { Mutex } from 'async-mutex';
import { proofTypeToPallet } from '../config';
import { validateProofTypes } from '../utils/helpers';

const main = async (): Promise<void> => {
    const proofType = process.argv[2];
    if (!proofType) {
        throw new Error('Proof type argument is required. Usage: npm run send-proof <proof-type>');
    }
    validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);
    validateProofTypes([proofType]);

    const { api, provider, account, nonce } = await initializeApi();

    const proofCounter: { [key: string]: number } = { [proofType]: 0 };
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
