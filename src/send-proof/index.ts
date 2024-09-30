import { validateEnvVariables } from '../utils/helpers';
import { generateAndNativelyVerifyProof } from '../proof-generator/common/generate-proof';
import { selectVerifyMethod } from '../utils/helpers';
import { zkVerifySession, ZkVerifyEvents } from 'zkverifyjs';

const main = async (): Promise<void> => {
    const proofType = process.argv[2];
    const waitForPublishedAttestationArg = process.argv[3];
    const waitForPublishedAttestation = waitForPublishedAttestationArg === 'true';
    let session = undefined;

    if (!proofType) {
        throw new Error('Proof type argument is required. Usage: npm run generate:single:proof <proof-type> <waitForPublishedAttestation>');
    }

    validateEnvVariables(['WEBSOCKET', 'SEED_PHRASE_1']);

    try {
        console.log(`Generating the proof for ${proofType}`);
        const { proof, publicSignals, vk } = await generateAndNativelyVerifyProof(proofType);
        console.log(proof);
        console.log(publicSignals);
        console.log(vk);
        console.log(`${proofType} Proof generated and natively verified.`);

        console.log(`Connecting to zkVerify network for verification...`);

        session = await zkVerifySession.start().Custom(process.env.WEBSOCKET).withAccount(process.env.SEED_PHRASE_1!);
        const verifyMethod = selectVerifyMethod(session, proofType);

        let verificationCall = verifyMethod;
        if (waitForPublishedAttestation) {
            verificationCall = verifyMethod.waitForPublishedAttestation();
        }

        console.log(`Sending ${proofType} proof to zkVerify for verification...`);
        const { events, transactionResult } = await verificationCall.execute(proof, publicSignals, vk);

        let verifyStartTime = Date.now();
        events.on(ZkVerifyEvents.Broadcast, () => {
            console.log(`Proof broadcast for verification at ${verifyStartTime}`);
        });

        events.on(ZkVerifyEvents.ErrorEvent, (eventData: any) => {
            console.error(`Error in proof verification: ${JSON.stringify(eventData)}`);
        });

        events.on(ZkVerifyEvents.IncludedInBlock, (eventData: any) => {
            console.log(`Proof included in block: ${eventData.blockHash}`);
        });

        events.on(ZkVerifyEvents.Finalized, () => {
            console.log(`Proof verified and finalized.`);
        });

        const transactionDetails = await transactionResult;
        console.log(`Transaction details: ${JSON.stringify(transactionDetails)}`);


    } catch (error) {
        console.error(`Failed to send proof: ${error}`);
    } finally {
        if(session) {
            session.close()
        }
        process.exit(0);
    }
};

main().catch(console.error);
