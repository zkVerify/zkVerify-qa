import { ProofType, Groth16CurveType } from "zkverifyjs";
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

const localWalletData: { wallets: any[], seedPhrases: string[] } = {
    wallets: [],
    seedPhrases: []
};

const proofTypeIndexMap: Record<ProofType, number> = {
    [ProofType.ultraplonk]: 1,
    [ProofType.risc0]: 2,
    [ProofType.fflonk]: 3,

    [ProofType.proofofsql]: 4,
    // ADD_NEW_PROOF_TYPE - groth16 should be last index here to work with curveIndexMap
    [ProofType.groth16]: 5,
};

const curveIndexMap: Record<Groth16CurveType, number> = {
    [Groth16CurveType.bn128]: proofTypeIndexMap[ProofType.groth16],
    [Groth16CurveType.bn254]: proofTypeIndexMap[ProofType.groth16] + 1,
    [Groth16CurveType.bls12381]: proofTypeIndexMap[ProofType.groth16] + 2,
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
        const newSeedPhrases: string[] = [aliceSeedPhrase];
        const wallets = [alice];
        
        for (let i = 0; i < Object.keys(proofTypeIndexMap).length + Object.keys(curveIndexMap).length - 2; i++) {
            const mnemonic = mnemonicGenerate();
            const newWallet = keyring.addFromUri(mnemonic);
            newSeedPhrases.push(mnemonic);
            wallets.push(newWallet);
        }

        localWalletData.seedPhrases = newSeedPhrases;
        localWalletData.wallets = wallets;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { nonce } = await api.query.system.account(alice.address);
        console.log(`Starting nonce for Alice: ${nonce}`);

        const transferPromises = wallets.slice(1).map((wallet, index) => {
            const currentNonce = nonce.toNumber() + index;
            console.log(`Preparing transaction for wallet ${wallet.address} with nonce ${currentNonce}`);

            const transfer = api.tx.balances.transferAllowDeath(wallet.address, TOKEN_AMOUNT);

            return new Promise<void>((resolve, reject) => {
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
    } catch (error) {
        console.error('Error funding wallets:', error);
        throw error;
    }
}

export function getGlobalWalletData() {
    return localWalletData;
}
// ADD_NEW_PROOF_TYPE
// Update references to max SEED_PHRASE_* as needed
/**
 * Sets up and funds local test wallets if the `LOCAL_NODE` environment variable is set to `true`.
 * Otherwise, it checks for the existence of pre-configured wallets by ensuring that the required seed phrases
 * (SEED_PHRASE_1 to SEED_PHRASE_7) are available in the environment variables.
 *
 * @throws {Error} If `LOCAL_NODE` is not set to `true` and one or more required seed phrases are missing from the environment variables.
 *
 * @returns {Promise<void>} Resolves when local wallets are created and funded or when pre-configured wallets are validated.
 */
export const setupLocalOrExistingWallets = async (): Promise<void> => {
    if (process.env.LOCAL_NODE === 'true') {
        console.log('Setting up and funding local wallets...');
        await createAndFundLocalTestWallets();

        const globalWalletData = getGlobalWalletData();
        if (!globalWalletData.wallets.length || !globalWalletData.seedPhrases.length) {
            throw new Error('Local wallets were not properly created or funded.');
        }
        console.log('Local wallets are successfully set up and funded.');
    } else {
        console.log('Using pre-configured wallets from environment variables.');

        // ADD_NEW_PROOF_TYPE
        // Check if SEED_PHRASE_1 to SEED_PHRASE_7 are set
        const requiredSeedPhrases = [
            'SEED_PHRASE_1',
            'SEED_PHRASE_2',
            'SEED_PHRASE_3',
            'SEED_PHRASE_4',
            'SEED_PHRASE_5',
            'SEED_PHRASE_6',
            'SEED_PHRASE_7',
        ];

        const missingVariables = requiredSeedPhrases.filter((envVar) => !process.env[envVar]);

        if (missingVariables.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
        }

        console.log('Pre-configured wallets are successfully validated.');
    }
};


export const getSeedPhrase = (
    proofType: ProofType,
    curve?: Groth16CurveType,
    isLocalNode: boolean = false,
    runInParallel: boolean = false
): string => {
    const seedPhrase = isLocalNode && runInParallel
        ? getLocalSeedPhrase(proofType, curve)
        : getSeedPhraseFromEnv(proofType, curve, isLocalNode, runInParallel);

    return checkSeedPhrase(seedPhrase, proofType, curve);
};

const getSeedPhraseFromEnv = (
    proofType: ProofType,
    curve?: Groth16CurveType,
    isLocalNode: boolean = false,
    runInParallel: boolean = false
): string | undefined => {
    if (!runInParallel || isLocalNode) {
        return process.env.SEED_PHRASE_1;
    }

    if (proofType === ProofType.groth16 && curve) {
        return process.env[`SEED_PHRASE_${curveIndexMap[curve]}`];
    }

    return process.env[`SEED_PHRASE_${proofTypeIndexMap[proofType]}`];
};

const getLocalSeedPhrase = (proofType: ProofType, curve?: Groth16CurveType): string | undefined => {
    const globalWalletData = getGlobalWalletData();
    const index = proofType === ProofType.groth16 && curve
        ? curveIndexMap[curve] - 1
        : proofTypeIndexMap[proofType] - 1;

    return globalWalletData.seedPhrases[index];
};

const checkSeedPhrase = (seedPhrase: string | undefined, proofType: ProofType, curve?: Groth16CurveType): string => {
    if (!seedPhrase) {
        throw new Error(`No seed phrase set for proof type ${proofType}${curve ? ` with curve ${curve}` : ''}`);
    }
    return seedPhrase;
};