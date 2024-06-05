require('dotenv').config();
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

const proofs = {
    fflonk: {
        pallet: 'settlementFFlonkPallet',
        validProof: process.env.FFLONK_PROOF,
        invalidProof: process.env.INVALID_FFLONK_PROOF
    },
    boojum: {
        pallet: 'settlementZksyncPallet',
        validProof: process.env.BOOJUM_PROOF,
        invalidProof: process.env.INVALID_BOOJUM_PROOF
    }
};

const requiredEnvVariables = ['WEBSOCKET', 'PRIVATE_KEY'];
requiredEnvVariables.forEach((envVar) => {
    if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set.`);
    }
});

describe('Proof Submission and Event Handling', () => {
    let api;
    let provider;
    let startTime;

    beforeAll(async () => {
        provider = new WsProvider(process.env.WEBSOCKET);
        api = await createApi(provider);
        await waitForNodeToSync(api);
    });

    afterAll(async () => {
        await provider.disconnect();
    });

    Object.entries(proofs).forEach(([proofType, { pallet, validProof, invalidProof }]) => {
        test(`should successfully accept a ${proofType} proof, emit a NewAttestation event`, async () => {
            startTime = Date.now();
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY);
            
            const submitProof = api.tx[pallet].submitProof(validProof);

            let proof_leaf = null;
            let attestation_id = null;

            await new Promise((resolve, reject) => {
                submitProof.signAndSend(account, async ({ events, status, dispatchError }) => {
                    if (status.isInBlock) {
                        console.log(`Transaction included in block (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
                        handleEvents(events, (data) => {
                            proof_leaf = data[0].toString();
                            attestation_id = data[1].toString();
                            console.log(`Proof Verified:\n  - Attestation Id: ${attestation_id}\n  - Proof Leaf: ${proof_leaf}`);
                        });

                        if (dispatchError) {
                            console.error(`Invalid ${proofType} transaction:`, dispatchError.toString());
                            reject(dispatchError);
                        } else {
                            resolve();
                        }
                    }

                    if (status.isFinalized) {
                        console.log(`Block containing ${proofType} proof transaction finalized (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
                    }
                });
            });

            await waitForAttestationId(attestation_id);

            console.log(`Waiting for NewAttestation event...`);
            const eventData = await waitForNewAttestation(api, 360000, attestation_id, startTime);
            const [attestationId, proofsAttestation] = eventData;
            expect(Number.isInteger(attestationId.toNumber())).toBeTruthy();
            expect(proofsAttestation.toString()).toMatch(/^0x[a-fA-F0-9]{64}$/);
        }, 300000);

        test(`should reject invalid ${proofType} proof upon finalization`, async () => {
            const keyring = new Keyring({ type: 'sr25519' });
            const account = keyring.addFromUri(process.env.PRIVATE_KEY);

            const submitProof = api.tx[pallet].submitProof(invalidProof);

            const result = await new Promise((resolve, reject) => {
                submitProof.signAndSend(account, ({ status, dispatchError }) => {
                    if (status.isInBlock) {
                        console.log(`${proofType} Transaction included at blockHash ${status.asInBlock.toString()}`);
                    }
                    if (status.isFinalized) {
                        if (dispatchError) {
                            console.error('Transaction failed as expected due to an error.');
                            resolve(true);
                        } else {
                            console.error('Transaction finalized without error, test failed.');
                            reject(new Error('Transaction was expected to fail but did not.'));
                        }
                    }
                }).catch(error => {
                    console.error(`Transaction submission failed with an error: ${error}`);
                    reject(error);
                });
            });

            expect(result).toBeTruthy();
        }, 300000);
    });
});

async function createApi(provider) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Failed to connect to the WebSocket URL.')), 3000)
    );
    return await Promise.race([ApiPromise.create({ provider }), timeout]);
}

function handleEvents(events, callback) {
    events.forEach(({ event: { data, method, section } }) => {
        if (section === 'poe' && method === 'NewElement') {
            callback(data);
        }
    });
}

async function waitForAttestationId(attestation_id) {
    while (!attestation_id) {
        console.log("Waiting for attestation_id to be set...");
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function waitForNewAttestation(api, timeoutDuration, attestation_id, startTime) {
    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            unsubscribe();
            reject("Timeout expired");
        }, timeoutDuration);

        const interval = setInterval(() => {
            console.log(`Waiting for NewAttestation event... (elapsed time: ${(Date.now() - startTime) / 1000} seconds)`);
        }, 15000);

        const unsubscribe = await api.query.system.events((events) => {
            events.forEach((record) => {
                const { event } = record;
                const types = event.typeDef;

                if (event.section === "poe" && event.method === "NewAttestation") {
                    const currentAttestationId = event.data[0].toString();
                    console.log(`Detected NewAttestation event with id: ${currentAttestationId}`);
                    if (currentAttestationId === attestation_id) {
                        clearTimeout(timeout);
                        clearInterval(interval);
                        unsubscribe();
                        console.log(`Matched NewAttestation event with ProofVerified event Attestation Id ${attestation_id}:`);
                        event.data.forEach((data, index) => {
                            console.log(`\t${types[index].type}: ${data.toString()}`);
                        });
                        resolve(event.data);
                    }
                }
            });
        });
    });
}

function handleError(error) {
    if (error.message.includes('Invalid bip39 mnemonic specified')) {
        console.error('Failed to create account from the provided PRIVATE_KEY. Please check the PRIVATE_KEY environment variable.');
    } else {
        console.error(`An error occurred: ${error.message}`);
    }
}

async function waitForNodeToSync(api) {
    let isSyncing = true;
    while (isSyncing) {
        const { isSyncing: currentSyncing } = await api.rpc.system.health();
        isSyncing = currentSyncing.isTrue;
        if (isSyncing) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}
