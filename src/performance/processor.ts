import { ProofType, zkVerifySession, Library, CurveType } from "zkverifyjs";
import dotenv from "dotenv";
import fs from "fs";
import { Mutex } from "async-mutex";
import { ApiPromise } from "@polkadot/api";
import { BN } from "@polkadot/util";
import type { AccountInfo } from "@polkadot/types/interfaces";

dotenv.config();

module.exports = {
    sendProofTransaction_fflonk,
    sendProofTransaction_groth16,
    sendProofTransaction_risc0,
    sendProofTransaction_ultraplonk,
    sendProofTransaction_proofofsql
};

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
const FUNDED_ACCOUNTS_FILE = requireEnvVar("FUNDED_ACCOUNTS_FILE");

if (!fs.existsSync(FUNDED_ACCOUNTS_FILE)) {
    throw new Error(`❌ Missing funded accounts file: ${FUNDED_ACCOUNTS_FILE}`);
}

const fundedAccounts: { mnemonic: string; address: string }[] = JSON.parse(fs.readFileSync(FUNDED_ACCOUNTS_FILE, "utf-8"));
let availableAccounts = [...fundedAccounts];
const accountMutex = new Mutex();

const nonceTracker: Record<string, number> = {};
const nonceMutex = new Mutex();

async function getNextAccount(): Promise<{ mnemonic: string; address: string }> {
    return accountMutex.runExclusive(() => {
        if (availableAccounts.length === 0) {
            console.log("♻️ All accounts used! Resetting account pool.");
            availableAccounts = [...fundedAccounts];
        }
        return availableAccounts.shift()!;
    });
}

async function getInitialNonce(api: ApiPromise, account: { address: string }): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[account.address] === undefined) {
            const accountInfo = (await api.query.system.account(account.address)) as unknown as AccountInfo;
            nonceTracker[account.address] = new BN(accountInfo.nonce).toNumber();
            console.log(`🔄 Initial nonce for ${account.address}: ${nonceTracker[account.address]}`);
        }
        return nonceTracker[account.address];
    });
}

async function getNextNonce(account: { address: string }): Promise<number> {
    return nonceMutex.runExclusive(() => {
        if (nonceTracker[account.address] === undefined) {
            throw new Error(`❌ Nonce not initialized for ${account.address}`);
        }
        return nonceTracker[account.address]++;
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
    const account = await getNextAccount();

    const proofFilePath = `${DATA_FOLDER}/${proofType}.json`;
    if (!fs.existsSync(proofFilePath)) {
        throw new Error(`❌ Missing proof data file: ${proofFilePath}`);
    }
    const proofData = JSON.parse(fs.readFileSync(proofFilePath, "utf-8"));

    const session = await zkVerifySession.start()
        .Custom(ZKVERIFY_NETWORK)
        .withAccount(account.mnemonic);

    const accountInfo = await session.getAccountInfo();
    const sender = accountInfo[0];
    const api = session.api;

    await getInitialNonce(api, sender);
    const nonce = await getNextNonce(sender);

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

    console.log(`✅ Transaction sent successfully for ${proofType} (Nonce: ${nonce})`);

    await session.close();

    // await transactionResult;
    // console.log(`✅ Transaction executed & finalized for ${proofType} (Nonce: ${nonce})`);
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
