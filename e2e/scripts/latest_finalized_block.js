const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  // Define the WebSocket provider
  const wsProvider = new WsProvider('wss://testnet-rpc.zkverify.io');

  // Create the API instance
  const api = await ApiPromise.create({ provider: wsProvider });

  // Retrieve the latest finalized block hash
  const finalizedHead = await api.rpc.chain.getFinalizedHead();

  // Retrieve the latest finalized block
  const finalizedBlock = await api.rpc.chain.getBlock(finalizedHead);

  // Retrieve the latest block hash (non-finalized)
  const latestHead = await api.rpc.chain.getHeader();

  // Retrieve the latest block (non-finalized)
  const latestBlock = await api.rpc.chain.getBlock(latestHead.hash);

  // Log the finalized block details
  console.log(`Latest finalized block number: ${finalizedBlock.block.header.number}`);
  console.log(`Finalized block hash: ${finalizedHead}`);

  // Log the latest non-finalized block details
  console.log(`Latest block number: ${latestBlock.block.header.number}`);
  console.log(`Latest block hash: ${latestHead.hash}`);

  // Disconnect from the provider
  await api.disconnect();
}

main().catch((error) => {
  console.error('Error fetching blocks:', error);
  process.exit(1);
});
