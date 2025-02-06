import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { BN } from "@polkadot/util";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Mutex } from "async-mutex";
import type { AccountInfo } from "@polkadot/types/interfaces";

dotenv.config();

const TOTAL_ACCOUNTS = 10;
const INTERMEDIARY_COUNT = 2;
const FUND_PER_ACCOUNT = 0.1;
const MAX_PARALLEL_TXS = 10;
const ZKVERIFY_NETWORK = process.env.ZKVERIFY_NETWORK;
const FUNDING_SEED_PHRASE = process.env.FUNDING_SEED_PHRASE;
const OUTPUT_DIR = path.join(__dirname, "funded_accounts");

if (!FUNDING_SEED_PHRASE) throw new Error("FUNDING_SEED_PHRASE not set in .env");
if (!ZKVERIFY_NETWORK) throw new Error("ZKVERIFY_NETWORK not set in .env");

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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

async function getNonce(api: ApiPromise, sender: any): Promise<number> {
    return nonceMutex.runExclusive(async () => {
        if (nonceTracker[sender.address] === undefined) {
            const nonceBN = await api.rpc.system.accountNextIndex(sender.address);
            nonceTracker[sender.address] = new BN(nonceBN).toNumber();
        }
        return nonceTracker[sender.address]++;
    });
}

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

        await Promise.allSettled(
            batch.map(async (account) => {
                try {
                    const nonce = await getNonce(api, sender);
                    const tx = api.tx.balances.transferAllowDeath(account.address, amountToSend.toString());

                    await new Promise<void>((resolve, reject) => {
                        tx.signAndSend(sender, { nonce }, ({ status, dispatchError }) => {
                            if (dispatchError) {
                                console.error(`Failed TX: ${account.address} (Nonce: ${nonce}):`, dispatchError.toString());
                                reject(dispatchError);
                            } else if (status.isFinalized) {
                                fundedAccounts.push(account);
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error(`Error funding ${account.address}:`, error);
                }
            })
        );

        console.log(`${senderType} waiting before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

(async () => {
    console.log("Connecting to zkVerify...");
    const api = await ApiPromise.create({ provider: new WsProvider(ZKVERIFY_NETWORK) });

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

    console.log("Checking Funding Account balance...");
    const keyring = new Keyring({ type: "sr25519" });
    const fundingAccount = keyring.addFromUri(FUNDING_SEED_PHRASE);
    const fundingBalance = (await api.query.system.account(fundingAccount.address)) as unknown as AccountInfo;

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
            const batchAccounts = fundedAccountsList.slice(i * accountsPerIntermediary, (i + 1) * accountsPerIntermediary);
            await fundAccounts(api, sender, batchAccounts, FUND_PER_ACCOUNT, `Intermediary ${i + 1}`);
        })
    );

    console.log(`Saving successfully funded accounts...`);
    saveToFile();

    console.log(`Funding complete!`);
    await api.disconnect();
})();
