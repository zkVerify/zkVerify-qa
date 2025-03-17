import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { walletPool } from "../../../../utils/wallets/walletPool";
import type { SubmittableResult } from '@polkadot/api';
import type { EventRecord } from '@polkadot/types/interfaces';

require("dotenv").config();

jest.setTimeout(60000);

describe('Transfer tokens from one account to another and confirm balance change', () => {
    let api: ApiPromise;
    let keyring: Keyring;
    let senderPair: any;
    let receiverPair: any;
    let senderEnv: string;
    let receiverEnv: string;

    beforeAll(async () => {
        api = await ApiPromise.create({ provider: new WsProvider(process.env.WEBSOCKET) });
        await cryptoWaitReady();
        keyring = new Keyring({ type: 'sr25519' });

        [senderEnv, senderPair] = await walletPool.acquireWallet();
        [receiverEnv, receiverPair] = await walletPool.acquireWallet();

        if (!senderPair || senderPair.includes("INSERT_SEED_PHRASE")) {
            throw new Error("Invalid sender seed phrase!");
        }
        if (!receiverPair || receiverPair.includes("INSERT_SEED_PHRASE")) {
            throw new Error("Invalid receiver seed phrase!");
        }
    });

    afterAll(async () => {
        await api.disconnect();
        await walletPool.releaseWallet(senderEnv);
        await walletPool.releaseWallet(receiverEnv);
    });

    test('should transfer tokens using transferKeepAlive', async () => {
        const senderKeyring = keyring.addFromUri(senderPair);
        const senderAddress = senderKeyring.address;
        const receiverAddress = keyring.addFromUri(receiverPair).address;

        const { data: senderBalanceBefore } = await api.query.system.account(senderAddress);
        const { data: receiverBalanceBefore } = await api.query.system.account(receiverAddress);

        const transferAmount = api.createType('Balance', 10000000000);
        const transfer = api.tx.balances.transferKeepAlive(receiverAddress, transferAmount);

        const unsub = await transfer.signAndSend(senderKeyring, ({ status, events }: SubmittableResult) => {
            if (status.isFinalized) {
                events.forEach(({ event }: EventRecord) => {
                    console.log(`\t${event.section}.${event.method}`);
                });
                unsub();
            }
        });

        await new Promise((resolve) => setTimeout(resolve, 10000));

        const { data: senderBalanceAfter } = await api.query.system.account(senderAddress);
        const { data: receiverBalanceAfter } = await api.query.system.account(receiverAddress);

        expect(senderBalanceAfter.free.toBigInt()).toBeLessThanOrEqual(senderBalanceBefore.free.toBigInt() - transferAmount.toBigInt());
        expect(receiverBalanceAfter.free.toBigInt()).toBe(receiverBalanceBefore.free.toBigInt() + transferAmount.toBigInt());
    });
});
