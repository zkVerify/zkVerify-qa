const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  const wsProvider = new WsProvider('wss://testnet-rpc.zkverify.io');
  const api = await ApiPromise.create({ provider: wsProvider });
  const finalizedHead = await api.rpc.chain.getFinalizedHead();
  const finalizedBlock = await api.rpc.chain.getBlock(finalizedHead);
  const latestHead = await api.rpc.chain.getHeader();
  const latestBlock = await api.rpc.chain.getBlock(latestHead.hash);

  console.log(`Latest finalized block number: ${finalizedBlock.block.header.number}`);
  console.log(`Finalized block hash: ${finalizedHead}`);

  console.log(`Latest block number: ${latestBlock.block.header.number}`);
  console.log(`Latest block hash: ${latestHead.hash}`);

  await api.disconnect();
}

main().catch((error) => {
  console.error('Error fetching blocks:', error);
  process.exit(1);
});
