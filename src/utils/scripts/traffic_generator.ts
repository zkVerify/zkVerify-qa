import 'dotenv/config';
import { Mutex } from 'async-mutex';
import BN from 'bn.js';
import {zkVerifySession, Groth16CurveType, ProofType} from 'zkverifyjs';
import { loadProofData } from '../../tests/common/utils';
import { SupportedProofType } from '../../config';

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
 * Sends a proof to the blockchain using zkVerifySession.
 * @param session - The zkVerifySession instance.
 * @param proofType - The type of the proof (e.g., fflonk, groth16).
 * @param proof - The proof data.
 * @param publicSignals - The public signals for the proof.
 * @param vk - The verification key.
 * @param proofCounter - An object to keep track of the number of proofs sent.
 * @param nonceMutex - A mutex to handle nonce synchronization.
 * @param nonce - An object containing the current nonce value.
 */
const sendProof = async (
    session: zkVerifySession,
    proofType: string,
    proof: any,
    publicSignals: any,
    vk: string,
    proofCounter: { [key: string]: number },
    nonceMutex: Mutex,
    nonce: { value: number }
): Promise<void> => {
    let currentNonce!: number;

    await nonceMutex.runExclusive(() => {
        currentNonce = nonce.value;
        nonce.value += 1;
    });

    try {
        const { events, transactionResult } = await session
            [proofType]()
            .nonce(currentNonce)
            .execute(proof, publicSignals, vk);

        console.log(`Proof ${proofType} sent with nonce ${currentNonce}`);
        proofCounter[proofType]++;
    } catch (error) {
        console.error(`Error sending ${proofType} proof:`, error);
        await nonceMutex.runExclusive(() => {
            nonce.value -= 1;
        });
    }
};

/**
 * Main function to execute the proof submission.
 */
const main = async (): Promise<void> => {
    validateEnvVariables(['WEBSOCKET', 'SEED_PHRASE_1']);

    const session = await zkVerifySession.start().Custom(process.env.WEBSOCKET!).withAccount(process.env.SEED_PHRASE_1!);

    const initialNonce: BN = await session.api.rpc.system.accountNextIndex(session.account?.address!) as unknown as BN;
    const nonce = { value: initialNonce.toNumber() };

    const proofTypes: [string, { proof: any, publicSignals: any, vk: string, curve?: Groth16CurveType }][] = [];

    Object.values(SupportedProofType).forEach((proofType) => {
        if (proofType === SupportedProofType.groth16) {
            Object.values(Groth16CurveType).forEach((curve: Groth16CurveType) => {
                const { proof, publicSignals, vk } = loadProofData(proofType as ProofType, curve);
                proofTypes.push([`${proofType}_${curve}`, { proof, publicSignals, vk, curve }]);
            });
        } else {
            const { proof, publicSignals, vk } = loadProofData(proofType as ProofType);
            proofTypes.push([proofType, { proof, publicSignals, vk }]);
        }
    });

    const proofCounter: { [key: string]: number } = {};

    proofTypes.forEach(([proofType, _]) => {
        proofCounter[proofType] = 0;
    });

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
            const proofPromises = proofTypes.map(([proofType, { proof, publicSignals, vk }]) =>
                sendProof(session, proofType, proof, publicSignals, vk, proofCounter, nonceMutex, nonce)
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

    if (session) {
        await session.close();
    }
    process.exit(0);
};

main().catch(console.error);
