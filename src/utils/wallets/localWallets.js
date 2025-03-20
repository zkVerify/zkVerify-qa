const { calculateWalletCountFromProofConfigurations } = require ( "./walletCount");
const { ApiPromise, Keyring, WsProvider } = require('@polkadot/api');
const { cryptoWaitReady, mnemonicGenerate } = require('@polkadot/util-crypto');

const localWalletData = { seedPhrases: [], wallets: [] };

/**
 * Creates and funds local wallets if `LOCAL_NODE` is set to `true`, otherwise assumes the wallets are pre-configured.
 */
async function createAndFundLocalTestWallets() {
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
        localWalletData.seedPhrases.push(aliceSeedPhrase);
        localWalletData.wallets.push(alice);

        const numWallets = calculateWalletCountFromProofConfigurations();

        for (let i = 0; i < numWallets; i++) {
            const mnemonic = mnemonicGenerate();
            const newWallet = keyring.addFromUri(mnemonic);
            localWalletData.seedPhrases.push(mnemonic);
            localWalletData.wallets.push(newWallet);
        }

        const { nonce } = await api.query.system.account(alice.address);
        console.log(`Starting nonce for Alice: ${nonce}`);

        const transferPromises = localWalletData.wallets.slice(1).map((wallet, index) => {
            const currentNonce = nonce.toNumber() + index;
            console.log(`Preparing transaction for wallet ${wallet.address} with nonce ${currentNonce}`);

            const transfer = api.tx.balances.transferAllowDeath(wallet.address, TOKEN_AMOUNT);

            return new Promise((resolve, reject) => {
                transfer.signAndSend(alice, { nonce: currentNonce }, ({ status, dispatchError }) => {
                    console.log(`Transaction status for wallet ${wallet.address}: ${status.type}`);

                    if (status.isInBlock) {
                        console.log(`Transaction for wallet ${wallet.address} is in block.`);
                        resolve();
                    }

                    if (dispatchError) {
                        console.error(`Dispatch error for wallet ${wallet.address}:`, dispatchError.toString());

                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(dispatchError.asModule);
                            const { name, section } = decoded;
                            reject(new Error(`${section}.${name}: ${dispatchError.asModule.error || 'Unknown error occurred'}`));
                        } else {
                            reject(new Error(dispatchError.toString()));
                        }
                    }
                }).catch((error) => {
                    console.error(`Error while sending transaction to wallet ${wallet.address}:`, error);
                    reject(error);
                });
            });
        });

        await Promise.all(transferPromises);
        await api.disconnect();

        return localWalletData;
    } catch (error) {
        console.error('Error funding wallets:', error);
        throw error;
    }
}

module.exports = { createAndFundLocalTestWallets, localWalletData };
