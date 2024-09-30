# Test suite for the NH-Core node RPC interface

## Installation

Issue the following commands from the top level directory:
```sh
npm install;
cp .env.testnet.rpc .env
```

### Running the tests

To run the tests, ensure environment variables have been set (.env.local.rpc or .env.testnet.rpc) then execute one of:
```sh
npm run test:rpc:local
npm run test:rpc:testnet
```

### Running with Docker

Build:
```sh
docker-compose build
```
Local Run:
```sh
docker-compose run -e TEST_ENV=local -e RPC_URL=http://local-rpc-url -e WEBSOCKET=ws://local-websocket -e SEED_PHRASE=<local-private-key rpc-tests>
```
Testnet:
```sh
docker-compose run rpc-tests -e SEED_PHRASE=<testnet-private-key rpc-tests>
```

### Running test for a specific namespace

You can run tests for a specific RPC namespace such as `rpc/chain` by issuing the following command:
```sh
npm run test:rpc:testnet rpc/chain;
```
### Running test for a specific RPC method

You can run tests for a specific RPC method such as `rpc/chain/getBlock` by issuing the following command:
```sh
npm run test:rpc:testnet rpc/chain/getBlock/index.test.ts
```

Have a look at the `rpc/` directory for the list of supported RPC methods that can be tested.

### Modifying the test parameters

You can modify the test parameters and use your own values by changing the .env values.
