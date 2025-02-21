import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { BN } from "@polkadot/util";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Mutex } from "async-mutex";
import type { AccountInfo } from "@polkadot/types/interfaces";
import { cryptoWaitReady } from "@polkadot/util-crypto";

dotenv.config();

const TOTAL_ACCOUNTS = 10000;
const INTERMEDIARY_COUNT = 100;
const FUND_PER_ACCOUNT = 10;
const MAX_PARALLEL_TXS = 10;
const ZKVERIFY_NETWORK = process.env.ZKVERIFY_NETWORK;
const FUNDING_SEED_PHRASE = process.env.FUNDING_SEED_PHRASE;
const OUTPUT_DIR = path.join(__dirname, "funded_accounts");

if (!FUNDING_SEED_PHRASE) throw new Error("FUNDING_SEED_PHRASE not set in .env");
if (!ZKVERIFY_NETWORK) throw new Error("ZKVERIFY_NETWORK not set in .env");

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function connectToApi(retries = 5, delay = 5000): Promise<ApiPromise> {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connecting to zkVerify network (attempt ${i + 1}/${retries})...`);

            const provider = new WsProvider(ZKVERIFY_NETWORK, 100);
            const api = await ApiPromise.create({ provider });

            await api.isReady;

            console.log("Successfully connected to zkVerify network!");
            return api;
        } catch (error) {
            const err = error as Error;
            console.error(`API connection failed: ${err.message}`);

            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw new Error(`Failed to connect after ${retries} attempts.`);
            }
        }
    }
    throw new Error("Unexpected connection failure.");
}

function getCurrentDate(): string {
    return new Date().toISOString().split("T")[0];
}

function getUniqueFilename(): string {
    const basePath = path.join(OUTPUT_DIR, `funded_accounts_${getCurrentDate()}.json`);
    let counter = 1;
    let uniquePath = basePath;

    while (fs.existsSync(uniquePath)) {
        uniquePath = path.join(OUTPUT_DIR, `funded_accounts_${getCurrentDate()}-${String(counter).padStart(3, "0")}.json`);
        counter++;
    }

    return uniquePath;
}

const OUTPUT_FILE = getUniqueFilename();
console.log(`Using file: ${OUTPUT_FILE} for saving results`);

const fundedAccounts: { mnemonic: string; address: string }[] = [];

function saveToFile() {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fundedAccounts, null, 2));
    console.log(`Accounts saved to ${OUTPUT_FILE}`);
}

function convertToPlanck(amount: number): bigint {
    return BigInt(Math.floor(amount * 10 ** 18));
}

const nonceMutex = new Mutex();
const nonceTracker: Record<string, number> = {};

/**
 * Fetch and track the nonce manually instead of relying on `accountNextIndex`
 */
async function getNonce(api: ApiPromise, sender: any): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[sender.address] === undefined) {
            const accountInfo = (await api.query.system.account(sender.address)) as unknown as AccountInfo;
            nonceTracker[sender.address] = new BN(accountInfo.nonce).toNumber();
        }
        return nonceTracker[sender.address]++;
    });
}

/**
 * Sends transactions in parallel using batch transactions and manually handles nonces.
 */
async function fundAccounts(
    api: ApiPromise,
    sender: any,
    recipients: { mnemonic: string; address: string }[],
    amount: number,
    senderType: string
) {
    const amountToSend = convertToPlanck(amount);
    console.log(`${senderType} funding ${recipients.length} accounts with ${amount} tokens each.`);

    for (let i = 0; i < recipients.length; i += MAX_PARALLEL_TXS) {
        const batch = recipients.slice(i, i + MAX_PARALLEL_TXS);
        console.log(`${senderType} processing batch ${Math.floor(i / MAX_PARALLEL_TXS) + 1}/${Math.ceil(recipients.length / MAX_PARALLEL_TXS)}`);

        try {
            const nonce = await getNonce(api, sender);

            const txs = batch.map(account =>
                api.tx.balances.transferAllowDeath(account.address, amountToSend.toString())
            );

            const batchTx = api.tx.utility.batch(txs);

            await new Promise<void>((resolve, reject) => {
                batchTx.signAndSend(sender, { nonce }, ({ status, dispatchError }) => {
                    if (dispatchError) {
                        console.error(`Failed batch TX (Nonce: ${nonce}):`, dispatchError.toString());
                        reject(dispatchError);
                    } else if (status.isFinalized) {
                        fundedAccounts.push(...batch);
                        resolve();
                    }
                });
            });

        } catch (error) {
            console.error(`Error funding batch:`, error);
        }

        console.log(`${senderType} waiting before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

(async () => {
    await cryptoWaitReady();

    console.log(`Generating ${TOTAL_ACCOUNTS} accounts...`);
    const allAccounts = Array.from({ length: TOTAL_ACCOUNTS }, () => {
        const mnemonic = mnemonicGenerate();
        const keyring = new Keyring({ type: "sr25519" });
        const pair = keyring.addFromUri(mnemonic);
        return { mnemonic, address: pair.address };
    });

    const intermediaries = allAccounts.slice(0, INTERMEDIARY_COUNT);
    const fundedAccountsList = allAccounts.slice(INTERMEDIARY_COUNT);

    console.log(`Writing initial generated accounts to file`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allAccounts, null, 2));

    console.log("Connecting to zkVerify...");
    const api = await connectToApi();
    console.log("Checking Funding Account balance...");
    const keyring = new Keyring({ type: "sr25519" });
    const fundingAccount = keyring.addFromUri(FUNDING_SEED_PHRASE);
    const fundingBalance = (await api.query.system.account(fundingAccount.address)) as unknown as AccountInfo;

    nonceTracker[fundingAccount.address] = new BN(fundingBalance.nonce).toNumber();

    const accountsPerIntermediary = Math.ceil(fundedAccountsList.length / INTERMEDIARY_COUNT);
    const fundingPerIntermediary = FUND_PER_ACCOUNT * (accountsPerIntermediary + 1);

    console.log(`Each intermediary will receive ${fundingPerIntermediary} tokens`);

    const totalRequired = fundingPerIntermediary * INTERMEDIARY_COUNT;
    if (BigInt(fundingBalance.data.free.toString()) < convertToPlanck(totalRequired)) {
        console.error(`Insufficient balance! Required: ${totalRequired}, Available: ${fundingBalance.data.free.toString()}`);
        process.exit(1);
    }

    console.log(`Funding Account funding ${INTERMEDIARY_COUNT} intermediaries...`);
    await fundAccounts(api, fundingAccount, intermediaries, fundingPerIntermediary, "Funding Account");

    console.log(`Waiting before intermediaries begin funding...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`Intermediaries funding final accounts in batches...`);
    await Promise.all(
        intermediaries.map(async (intermediary, i) => {
            const sender = keyring.addFromUri(intermediary.mnemonic);
            nonceTracker[sender.address] = 0;
            const batchAccounts = fundedAccountsList.slice(i * accountsPerIntermediary, (i + 1) * accountsPerIntermediary);
            await fundAccounts(api, sender, batchAccounts, FUND_PER_ACCOUNT, `Intermediary ${i + 1}`);
        })
    );

    console.log(`Saving successfully funded accounts...`);
    saveToFile();

    console.log(`Funding complete!`);
    await api.disconnect();
})();
