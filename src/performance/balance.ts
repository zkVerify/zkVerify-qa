import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import dotenv from "dotenv";

dotenv.config();

const ZKVERIFY_NETWORK = "";
const SEED_PHRASE = "";

async function getBalance(seed: string) {
    const api = await ApiPromise.create({ provider: new WsProvider(ZKVERIFY_NETWORK) });
    const keyring = new Keyring({ type: "sr25519" });
    const account = keyring.addFromUri(seed);

    const accountInfo = await api.query.system.account(account.address);
    const freeBalance = new BN((accountInfo as any).data.free.toString());

    console.log(`🔍 Address: ${account.address}`);
    console.log(`💰 Balance: ${freeBalance.div(new BN(10).pow(new BN(18))).toString()} tokens`);

    await api.disconnect();
}

getBalance(SEED_PHRASE).catch(console.error);
