import path from 'path';
import fs from 'fs';
import { ProofType, zkVerifySession, VerifyTransactionInfo, VKRegistrationTransactionInfo, TransactionInfo, TransactionStatus } from 'zkverifyjs';
import { EventResults, handleCommonEvents, handleEventsWithAttestation } from './eventHandlers';

export interface ProofData {
    proof: any;
    publicSignals: any;
    vk: string;
}

export const loadProofData = (proofType: ProofType, curve?: string): ProofData => {
    const fileName = curve ? `${proofType}_${curve}` : proofType;
    const dataPath = path.join(__dirname, 'data', `${fileName}.json`);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    let vk: string;
    if (proofType === ProofType.ultraplonk) {
        const vkPath = path.join(__dirname, 'data', 'ultraplonk_vk.bin');
        vk = fs.readFileSync(vkPath).toString('hex');
    } else {
        vk = data.vk;
    }

    return {
        proof: data.proof,
        publicSignals: data.publicSignals,
        vk,
    };
};

export const validateEventResults = (eventResults: EventResults, expectAttestation: boolean): void => {
    expect(eventResults.broadcastEmitted).toBe(true);
    expect(eventResults.includedInBlockEmitted).toBe(true);
    expect(eventResults.finalizedEmitted).toBe(true);
    expect(eventResults.errorEventEmitted).toBe(false);

    if (expectAttestation) {
        expect(eventResults.attestationConfirmedEmitted).toBe(true);
    } else {
        expect(eventResults.attestationConfirmedEmitted).toBe(false);
    }
    expect(eventResults.attestationBeforeExpectedEmitted).toBe(false);
    expect(eventResults.attestationMissedEmitted).toBe(false);
};

export const validateTransactionInfo = (
    transactionInfo: TransactionInfo,
    expectedProofType: string
): void => {
    expect(transactionInfo).toBeDefined();
    expect(transactionInfo.blockHash).not.toBeNull();
    expect(transactionInfo.proofType).toBe(expectedProofType);
    expect(transactionInfo.status).toBe(TransactionStatus.Finalized);
    expect(transactionInfo.txHash).toBeDefined();
    expect(transactionInfo.extrinsicIndex).toBeDefined();
    expect(transactionInfo.feeInfo).toBeDefined();
    expect(transactionInfo.weightInfo).toBeDefined();
    expect(transactionInfo.txClass).toBeDefined();
};

export const validateVerifyTransactionInfo = (
    transactionInfo: VerifyTransactionInfo,
    proofType: ProofType,
    expectAttestation: boolean
): void => {
    validateTransactionInfo(transactionInfo, proofType);

    expect(transactionInfo.attestationId).not.toBeNull();
    expect(transactionInfo.leafDigest).not.toBeNull();

    if (expectAttestation) {
        expect(transactionInfo.attestationConfirmed).toBeTruthy();
        expect(transactionInfo.attestationEvent).toBeDefined();
        expect(transactionInfo.attestationEvent!.id).toBeDefined();
        expect(transactionInfo.attestationEvent!.attestation).toBeDefined();
    } else {
        expect(transactionInfo.attestationConfirmed).toBeFalsy();
        expect(transactionInfo.attestationEvent).not.toBeDefined();
    }
};

export const validateVKRegistrationTransactionInfo = (
    transactionInfo: VKRegistrationTransactionInfo,
    proofType: ProofType
): void => {
    validateTransactionInfo(transactionInfo, proofType);
    expect(transactionInfo.statementHash).toBeDefined();
};

export const validatePoE = async (
    session: zkVerifySession,
    attestationId: number,
    leafDigest: string
): Promise<void> => {
    const proofDetails = await session.poe(attestationId, leafDigest);

    expect(proofDetails).toBeDefined();
    expect(proofDetails.root).toBeDefined();
    expect(proofDetails.leafIndex).toBeGreaterThanOrEqual(0);
    expect(proofDetails.numberOfLeaves).toBeGreaterThanOrEqual(0);
    expect(proofDetails.leaf).toBeDefined();
};

export const performVerifyTransaction = async (
    seedPhrase: string,
    proofType: ProofType,
    proof: any,
    publicSignals: any,
    vk: string,
    withAttestation: boolean,
    validatePoe: boolean = false,
    curve?: string
): Promise<{ eventResults: EventResults, transactionInfo: VerifyTransactionInfo }> => {
    let session;
    try {
        session = await zkVerifySession.start().Custom(process.env.WEBSOCKET).withAccount(seedPhrase);
    } catch (error) {
        console.error(`Failed to start session for ${proofType}${curve ? `:${curve}` : ''}:`, error);
        throw error;
    }

    const verifier = session.verify()[proofType]();
    const verify = withAttestation ? verifier.waitForPublishedAttestation() : verifier;

    let transactionInfo: VerifyTransactionInfo;
    let eventResults: EventResults;

    try {
        console.log(`${proofType}${curve ? `:${curve}` : ''} Executing transaction...`);
        const { events, transactionResult } = await verify.execute({ proofData: {
            proof: proof,
            publicSignals: publicSignals,
            vk: vk
            }
        });

        eventResults = withAttestation
            ? handleEventsWithAttestation(events, proofType, 'verify')
            : handleCommonEvents(events, proofType, 'verify');

        transactionInfo = await transactionResult;

        console.log(`${proofType}${curve ? `:${curve}` : ''} Transaction result received. Validating result data...`);
        await validateVerifyTransactionInfo(transactionInfo, proofType, withAttestation);
        await validateEventResults(eventResults, withAttestation);

        if (validatePoe) {
            await validatePoE(session, transactionInfo.attestationId!, transactionInfo.leafDigest!);
        }

        console.log(`${proofType}${curve ? `:${curve}` : ''} Validation Checks Completed.`);
    } catch (error) {
        console.error(`${proofType}${curve ? `:${curve}` : ''} Validation failed:`, error);
        throw error;
    } finally {
        await session.close();
    }

    return { eventResults, transactionInfo };
};

export const performVKRegistrationAndVerification = async (
    seedPhrase: string,
    proofType: ProofType,
    proof: any,
    publicSignals: any,
    vk: string
): Promise<void> => {
    const session = await zkVerifySession.start().Custom(process.env.WEBSOCKET).withAccount(seedPhrase);

    console.log(`${proofType} Executing VK registration...`);
    const { events: registerEvents, transactionResult: registerTransactionResult } = await session.registerVerificationKey()[proofType]().execute(vk);

    const registerResults = handleCommonEvents(registerEvents, proofType, 'vkRegistration');

    const vkTransactionInfo: VKRegistrationTransactionInfo = await registerTransactionResult;
    console.log(`${proofType} VK Registration result received. Validating result data...`);
    await validateVKRegistrationTransactionInfo(vkTransactionInfo, proofType);
    await validateEventResults(registerResults, false);
    console.log(`${proofType} VK Registration Validation Checks Completed.`);

    console.log(`${proofType} Executing verification using registered VK...`);
    const { events: verifyEvents, transactionResult: verifyTransactionResult } = await session.verify()[proofType]().withRegisteredVk().execute({
        proofData: {
            proof: proof,
            publicSignals: publicSignals,
            vk: vkTransactionInfo.statementHash!
        }
    });
    const verifyResults = handleCommonEvents(verifyEvents, proofType, 'verify');

    const verifyTransactionInfo: VerifyTransactionInfo = await verifyTransactionResult;
    console.log(`${proofType} Verify with Registered VK result received. Validating result data...`);
    await validateVerifyTransactionInfo(verifyTransactionInfo, proofType, false);
    await validateEventResults(verifyResults, false);
    console.log(`${proofType} Verify Using Registered VK Validation Checks Completed.`);
    await session.close();
};
