const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
    // Define the WebSocket provider
    const provider = new WsProvider('ws://127.0.0.1:9944');

    // Create the API instance
    const api = await ApiPromise.create({ provider });

    // Define Alice's account address
    const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

    // Query the balance
    const { data: { free: freeBalance } } = await api.query.system.account(ALICE);

    // Log Alice's free balance
    console.log(`The free balance of Alice is: ${freeBalance}`);

    // Disconnect the provider
    provider.disconnect();
}

main().catch(console.error);
