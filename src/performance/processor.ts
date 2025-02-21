import { ProofType, zkVerifySession, Library, CurveType } from "zkverifyjs";
import dotenv from "dotenv";
import fs from "fs";
import { Mutex } from "async-mutex";
import { ApiPromise } from "@polkadot/api";
import { BN } from "@polkadot/util";
import type { AccountInfo } from "@polkadot/types/interfaces";

dotenv.config();

function requireEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

const ZKVERIFY_NETWORK = requireEnvVar("ZKVERIFY_NETWORK");
const DATA_FOLDER = requireEnvVar("DATA_FOLDER");
const FUNDED_ACCOUNTS_FILE = requireEnvVar("FUNDED_ACCOUNTS_FILE");

if (!fs.existsSync(FUNDED_ACCOUNTS_FILE)) {
    throw new Error(`Missing funded accounts file: ${FUNDED_ACCOUNTS_FILE}`);
}

const fundedAccounts: { mnemonic: string; address: string }[] = JSON.parse(fs.readFileSync(FUNDED_ACCOUNTS_FILE, "utf-8"));
let availableAccounts = [...fundedAccounts];
const accountMutex = new Mutex();
const nonceTracker: Record<string, number> = {};
const nonceMutex = new Mutex();

let sessionPromise: Promise<any>;

async function initSession() {
    if (!sessionPromise) {
        console.log("Initializing zkVerify session...");
        const mnemonics = fundedAccounts.map(acc => acc.mnemonic);
        sessionPromise = zkVerifySession.start().Custom(ZKVERIFY_NETWORK).withAccounts(mnemonics);
        await sessionPromise;
        console.log(`zkVerify session initialized with ${fundedAccounts.length} accounts.`);
    }
    return sessionPromise;
}

async function getNextAccount(): Promise<{ mnemonic: string; address: string }> {
    return accountMutex.runExclusive(() => {
        if (availableAccounts.length === 0) {
            console.log("All accounts used! Resetting account pool.");
            availableAccounts = [...fundedAccounts];
        }
        return availableAccounts.shift()!;
    });
}

async function getNextNonce(api: ApiPromise, address: string): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[address] === undefined) {
            const accountInfo = (await api.query.system.account(address)) as unknown as AccountInfo;
            nonceTracker[address] = new BN(accountInfo.nonce).toNumber();
            console.log(`Initial nonce for ${address}: ${nonceTracker[address]}`);
        }
        return nonceTracker[address]++;
    });
}

function selectProofExecution(session: any, address: string, proofType: ProofType, nonce: number) {
    switch (proofType) {
        case ProofType.fflonk:
            return session.verify(address).fflonk().nonce(nonce);
        case ProofType.groth16:
            return session.verify(address).groth16(Library.snarkjs, CurveType.bn254).nonce(nonce);
        case ProofType.risc0:
            return session.verify(address).risc0().nonce(nonce);
        case ProofType.ultraplonk:
            return session.verify(address).ultraplonk().nonce(nonce);
        case ProofType.proofofsql:
            return session.verify(address).proofofsql().nonce(nonce);
        default:
            throw new Error(`Unknown proof type: ${proofType}`);
    }
}

async function sendProofTransaction(proofType: ProofType) {
    console.log(`Sending transaction for proof type: ${proofType}`);

    const session = await initSession();
    const account = await getNextAccount();
    const proofFilePath = `${DATA_FOLDER}/${proofType}.json`;

    if (!fs.existsSync(proofFilePath)) {
        throw new Error(`Missing proof data file: ${proofFilePath}`);
    }
    const proofData = JSON.parse(fs.readFileSync(proofFilePath, "utf-8"));

    const nonce = await getNextNonce(session.api, account.address);
    const proofExecution = selectProofExecution(session, account.address, proofType, nonce);
    const version = proofType === ProofType.risc0 ? "V1_0" : undefined;

    const { transactionResult } = await proofExecution.execute({
        proofData: {
            vk: proofData.vk,
            proof: proofData.proof,
            publicSignals: proofData.publicSignals,
            version: version,
        }
    });

    console.log(`Transaction sent successfully for ${proofType} (Nonce: ${nonce})`);

    // TODO: Not sure if waiting for tx result for thousands of transactions is feasible.
    // await transactionResult
}

async function sendAllProofs() {
    await Promise.allSettled([
        sendProofTransaction(ProofType.fflonk),
        sendProofTransaction(ProofType.groth16),
        sendProofTransaction(ProofType.risc0),
        sendProofTransaction(ProofType.ultraplonk),
        sendProofTransaction(ProofType.proofofsql),
    ]);
}

module.exports = {
    sendProofTransaction_fflonk: () => sendProofTransaction(ProofType.fflonk),
    sendProofTransaction_groth16: () => sendProofTransaction(ProofType.groth16),
    sendProofTransaction_risc0: () => sendProofTransaction(ProofType.risc0),
    sendProofTransaction_ultraplonk: () => sendProofTransaction(ProofType.ultraplonk),
    sendProofTransaction_proofofsql: () => sendProofTransaction(ProofType.proofofsql),
    sendAllProofs: () => sendAllProofs(),
};
