module.exports = {
    sendProofTransaction_fflonk,
    sendProofTransaction_groth16,
    sendProofTransaction_risc0,
    sendProofTransaction_ultraplonk,
    sendProofTransaction_proofofsql
};

import { ProofType, zkVerifySession, Library, CurveType } from "zkverifyjs";
import dotenv from "dotenv";
import fs from "fs";
import { Mutex } from "async-mutex";

dotenv.config();

function requireEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`❌ Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

const ZKVERIFY_NETWORK = requireEnvVar("ZKVERIFY_NETWORK");
const DATA_FOLDER = requireEnvVar("DATA_FOLDER");
const PROOF_ACCOUNTS: Record<ProofType, string> = {
    [ProofType.fflonk]: requireEnvVar("SEED_PHRASE_FFLONK"),
    [ProofType.groth16]: requireEnvVar("SEED_PHRASE_GROTH16"),
    [ProofType.risc0]: requireEnvVar("SEED_PHRASE_RISC0"),
    [ProofType.ultraplonk]: requireEnvVar("SEED_PHRASE_ULTRAPLONK"),
    [ProofType.proofofsql]: requireEnvVar("SEED_PHRASE_PROOFOFSQL"),
};

const nonceTracker: Record<string, number> = {};
const nonceMutex = new Mutex();

async function getInitialNonce(session: any, account: any, proofType: ProofType): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[proofType] === undefined) {
            const initialNonce = await session.api.rpc.system.accountNextIndex(account.address);
            nonceTracker[proofType] = initialNonce.toNumber();
            console.log(`🔄 Fetched initial nonce for ${proofType}: ${nonceTracker[proofType]}`);
        }
        return nonceTracker[proofType];
    });
}

async function getNextNonce(proofType: ProofType): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[proofType] === undefined) {
            throw new Error(`❌ Nonce not initialized for ${proofType}`);
        }
        const currentNonce = nonceTracker[proofType];
        nonceTracker[proofType] += 1;
        return currentNonce;
    });
}

function selectProofExecution(session: any, proofType: ProofType, nonce: number) {
    switch (proofType) {
        case ProofType.fflonk:
            return session.verify().fflonk().nonce(nonce);
        case ProofType.groth16:
            return session.verify().groth16(Library.snarkjs, CurveType.bn254).nonce(nonce);
        case ProofType.risc0:
            return session.verify().risc0().nonce(nonce);
        case ProofType.ultraplonk:
            return session.verify().ultraplonk().nonce(nonce);
        case ProofType.proofofsql:
            return session.verify().proofofsql().nonce(nonce);
        default:
            throw new Error(`❌ Unknown proof type: ${proofType}`);
    }
}

async function sendProofTransaction(proofType: ProofType) {
    console.log(`🚀 Sending transaction for proof type: ${proofType}`);
    const seedPhrase = PROOF_ACCOUNTS[proofType];

    if (!seedPhrase) {
        throw new Error(`❌ Missing seed phrase for ${proofType}`);
    }

    const proofFilePath = `${DATA_FOLDER}/${proofType}.json`;
    if (!fs.existsSync(proofFilePath)) {
        throw new Error(`❌ Missing proof data file: ${proofFilePath}`);
    }
    const proofData = JSON.parse(fs.readFileSync(proofFilePath, "utf-8"));

    const session = await zkVerifySession.start()
        .Custom(ZKVERIFY_NETWORK)
        .withAccount(seedPhrase);

    const sender = session.account!;

    await getInitialNonce(session, sender, proofType);
    const nonce = await getNextNonce(proofType);

    const proofExecution = selectProofExecution(session, proofType, nonce);
    const version = proofType === ProofType.risc0 ? "V1_0" : undefined;

    const { transactionResult } = await proofExecution.execute({
        proofData: {
            vk: proofData.vk,
            proof: proofData.proof,
            publicSignals: proofData.publicSignals,
            version: version,
        }
    });

    await transactionResult;
    console.log(`✅ Transaction executed successfully for ${proofType} (Nonce: ${nonce})`);
}

async function sendProofTransaction_fflonk() {
    await sendProofTransaction(ProofType.fflonk);
}

async function sendProofTransaction_groth16() {
    await sendProofTransaction(ProofType.groth16);
}

async function sendProofTransaction_risc0() {
    await sendProofTransaction(ProofType.risc0);
}

async function sendProofTransaction_ultraplonk() {
    await sendProofTransaction(ProofType.ultraplonk);
}

async function sendProofTransaction_proofofsql() {
    await sendProofTransaction(ProofType.proofofsql);
}
