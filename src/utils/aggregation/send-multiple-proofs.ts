import { generateAndNativelyVerifyProof } from '../../proof-generator/common/generate-proof';
import { selectVerifyMethod } from '../helpers';
import { zkVerifySession, ZkVerifyEvents } from 'zkverifyjs';

export const generateAndVerifyProofs = async (wsProviderUrl: string, signingUser: string, proofType: string, numProofs: number, domainId: number): Promise<void> => {
    if (!proofType || isNaN(numProofs) || numProofs <= 0) {
        throw new Error('Invalid input: proofType must be a string and numProofs must be a positive number.');
    }

    let session

    try {
        console.log(`Generating ${numProofs} proofs for ${proofType}`);

        for (let i = 0; i < numProofs; i++) {

            session = await zkVerifySession.start()
                .Custom(wsProviderUrl)
                .withAccount(signingUser);

            const verifyMethod = selectVerifyMethod(session, proofType);

            console.log(`Generating proof ${i + 1}/${numProofs}...`);
            const { proof, publicSignals, vk } = await generateAndNativelyVerifyProof(proofType);
            console.log(`${proofType} Proof ${i + 1} generated and verified.`);

            console.log(`Sending proof ${i + 1} to zkVerify for verification...`);
            const { events, transactionResult } = await verifyMethod.execute({
                proofData: { proof, publicSignals, vk },
                domainId: domainId
            });

            events.on(ZkVerifyEvents.Broadcast, () => {
                console.log(`Proof ${i + 1} broadcast for verification.`);
            });

            events.on(ZkVerifyEvents.ErrorEvent, (eventData: any) => {
                console.error(`Error in proof ${i + 1} verification: ${JSON.stringify(eventData)}`);
            });

            events.on(ZkVerifyEvents.IncludedInBlock, (eventData: any) => {
                console.log(`Proof ${i + 1} included in block: ${eventData.blockHash}`);
            });

            events.on(ZkVerifyEvents.Finalized, () => {
                console.log(`Proof ${i + 1} verified and finalized.`);
            });

            const transactionDetails = await transactionResult;
            console.log(`Transaction details for proof ${i + 1}: ${JSON.stringify(transactionDetails)}`);
        }
    } catch (error) {
        console.error(`Failed to send proofs: ${error}`);
    } finally {
        if (session) {
            session.close();
        }
    }
};
