import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';

async function getNonce(api: ApiPromise, sender: { address: any }) {
    return await api.rpc.system.accountNextIndex(sender.address);
}

/**
 * Executes the `registerDomain` transaction n times sequentially, waiting for each to finalize.
 * 
 * @param aggregationSize - aggregationSize for registerDomain
 * @param queueSize - queueSize for registerDomain
 * @param times - Number of times to execute the register domain
 */
export const executeRegisterDomain = async (
    wsProviderUrl: string, 
    signingUser: string,
    aggregationSize: any,
    queueSize: any,
    times: number
): Promise<void> => {
    const wsProvider = new WsProvider(wsProviderUrl);
    const api = await ApiPromise.create({ provider: wsProvider });

    const keyring = new Keyring({ type: 'sr25519' });
    const user = keyring.addFromUri(signingUser);

    console.log(`Executing registerDomain transaction ${times} times sequentially...`);

    for (let i = 0; i < times; i++) {
        try {
            console.log(`Transaction ${i + 1}/${times}: Sending registerDomain(${aggregationSize}, ${queueSize})...`);

            let nonce = await getNonce(api, user);
            const tx = api.tx.aggregate.registerDomain(aggregationSize, queueSize);

            await new Promise<void>((resolve, reject) => {
                tx.signAndSend(user, { nonce }, ({ status, events }) => {
                    if (status.isInBlock) {
                        console.log(`Transaction ${i + 1} included in block: ${status.asInBlock}`);
                        events.forEach(({ event: { data, method, section } }) => {
                            console.log(`Event: ${section}.${method} :: ${data}`);
                        });
                    } else if (status.isFinalized) {
                        console.log(`🎉 Transaction ${i + 1} finalized in block: ${status.asFinalized}`);
                        resolve(); // Move to the next transaction
                    }
                }).catch(reject);
            });

        } catch (error) {
            console.error(`Error executing transaction ${i + 1}:`, error);
            break; // Stop further execution if an error occurs
        }
    }

    console.log('All registerDomain transactions executed sequentially.');
};
