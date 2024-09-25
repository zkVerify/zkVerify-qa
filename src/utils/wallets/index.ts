import { ProofType, Groth16CurveType } from "zkverifyjs";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

const proofTypeSeedMap: Record<ProofType, string | undefined> = {
    [ProofType.ultraplonk]: process.env.SEED_PHRASE_1,
    [ProofType.risc0]: process.env.SEED_PHRASE_2,
    [ProofType.fflonk]: process.env.SEED_PHRASE_3,
    [ProofType.groth16]: process.env.SEED_PHRASE_4,
};

const groth16CurveSeedMap: Record<string, string | undefined> = {
    [Groth16CurveType.bn128]: process.env.SEED_PHRASE_4,
    [Groth16CurveType.bn254]: process.env.SEED_PHRASE_5,
    [Groth16CurveType.bls12381]: process.env.SEED_PHRASE_6,
};

/**
 * Creates and funds local wallets if `LOCAL_NODE` is set to `true`, otherwise assumes the wallets are pre-configured.
 */
export async function createAndFundLocalTestWallets(): Promise<void> {
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

        // Generate 5 new wallets (total Alice + 5 = 6)
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

        let { nonce } = await api.query.system.account(alice.address);

        const transferPromises = wallets.map(async (wallet, index) => {
            const transfer = api.tx.balances.transferAllowDeath(wallet.address, TOKEN_AMOUNT);

            return new Promise((resolve, reject) => {
                transfer.signAndSend(alice, { nonce: nonce.toNumber() + index }, ({ status }) => {
                    if (status.isFinalized) {
                        resolve(true);
                    }
                }).catch((error) => {
                    reject(error);
                });
            });
        });

        await Promise.all(transferPromises);
        await api.disconnect();

    } catch (error) {
        console.error('Error funding wallets:', error);
    }
}

/**
 * Decides whether to create and fund local wallets based on the `LOCAL_NODE` environment variable.
 */
export const setupLocalOrExistingWallets = async (): Promise<void> => {
    if (process.env.LOCAL_NODE === 'true') {
        console.log('Setting up and funding local wallets...');
        await createAndFundLocalTestWallets();
    } else {
        console.log('Using pre-configured wallets from environment variables.');
    }
};

/**
 * Get the seed phrase for a given proof type and optional curve.
 *
 * @param {ProofType} proofType - The proof type.
 * @param {Groth16CurveType} [curve] - The optional curve type (for Groth16).
 * @param {boolean} [runInParallel] - Whether the tests are running in parallel.
 * @returns {string} The seed phrase for the proof type and curve.
 * @throws {Error} If no seed phrase is found.
 */
export const getSeedPhrase = (proofType: ProofType, curve?: Groth16CurveType, runInParallel: boolean = false): string => {
    const seedPhrase = !runInParallel
        ? process.env.SEED_PHRASE_1
        : proofType === ProofType.groth16 && curve
            ? groth16CurveSeedMap[curve]
            : proofTypeSeedMap[proofType];

    if (!seedPhrase) {
        throw new Error(`No seed phrase set for proof type ${proofType}${curve ? ` with curve ${curve}` : ''}`);
    }

    return seedPhrase;
};