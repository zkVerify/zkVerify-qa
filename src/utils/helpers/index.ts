import 'dotenv/config';
import { ProofType } from "zkverifyjs";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

/**
 * Validate required environment variables.
 *
 * @param {string[]} variables - List of environment variable names to validate.
 * @throws {Error} If any of the required environment variables is not set.
 */
export const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
        if (envVar.includes('SEED_PHRASE') && process.env[envVar] === 'INSERT_SEED_PHRASE') {
            throw new Error('The SEED_PHRASE environment variable has not been set.');
        }
    });
};

export const selectVerifyMethod = (session: any, proofType: string): any => {
    switch (proofType) {
        case ProofType.groth16:
            return session.verify().groth16();
        case ProofType.fflonk:
            return session.verify().fflonk();
        case ProofType.risc0:
            return session.verify().risc0();
        case ProofType.ultraplonk:
            return session.verify().ultraplonk();
        default:
            throw new Error('Invalid proof type selected');
    }
};

export async function fundLocalE2eTestWallets(): Promise<boolean> {
    const TOKEN_AMOUNT = '10000000000000000000'; // 10 ZKV Tokens

    try {
        await cryptoWaitReady();

        const wsProvider = new WsProvider(process.env.WEBSOCKET);
        const api = await ApiPromise.create({ provider: wsProvider });

        const keyring = new Keyring({ type: 'sr25519' });
        const aliceSeedPhrase = process.env.SEED_PHRASE_1;
        if (!aliceSeedPhrase) {
            throw new Error("SEED_PHRASE_1 is not set in environment variables.");
        }
        const alice = keyring.addFromUri(aliceSeedPhrase);

        // Generate 5 new wallets
        const newSeedPhrases: string[] = [];
        const wallets = [];
        for (let i = 0; i < 5; i++) {
            const mnemonic = mnemonicGenerate();
            const newWallet = keyring.addFromUri(mnemonic);
            newSeedPhrases.push(mnemonic);
            wallets.push(newWallet);
        }

        newSeedPhrases.forEach((seed, index) => {
            process.env[`SEED_PHRASE_${index + 2}`] = seed;
        });

        // Transfer funds from Alice to the newly created wallets
        let { nonce } = await api.query.system.account(alice.address);

        const transferPromises = wallets.map(async (wallet, index) => {
            const transfer = api.tx.balances.transferAllowDeath(wallet.address, TOKEN_AMOUNT);

            return new Promise((resolve, reject) => {
                transfer.signAndSend(alice, { nonce: nonce.toNumber() + index }, ({ status, events }) => {
                    if (status.isInBlock) {
                        console.log(`Transaction included in block ${status.asInBlock}`);
                    }
                    if (status.isFinalized) {
                        console.log(`Transaction finalized at block ${status.asFinalized}`);
                        resolve(true);
                    }
                }).catch((error) => {
                    console.error(`Failed to send transfer: ${error}`);
                    reject(error);
                });
            });
        });

        await Promise.all(transferPromises);

        // Balance check
        const balanceCheckPromises = wallets.map(async (wallet) => {
            const { data: balance } = await api.query.system.account(wallet.address);
            const freeBalance = balance.free.toBigInt();
            if (freeBalance <= BigInt(0)) {
                console.error(`Wallet ${wallet.address} has insufficient balance.`);
                return false;
            } else {
                return true;
            }
        });

        const balanceResults = await Promise.all(balanceCheckPromises);

        await api.disconnect();

        return balanceResults.every((result) => result);

    } catch (error) {
        console.error('Error funding wallets:', error);
        return false;
    }
}
