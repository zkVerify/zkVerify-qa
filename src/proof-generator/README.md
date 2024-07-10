# Proof Generation and Submission Script

Generate unique proofs and submit them to zkVerify.

## Prerequisites

1. Before you begin, ensure you have the following tools installed globally on your system:

- **snarkjs**: This is a JavaScript library for generating and verifying zk-SNARK proofs.
```sh
npm install -g snarkjs
```
- **circom**: This is a circuit compiler for zk-SNARKs.
```sh
npm install -g circom
```

2. Update the .env.generator file values, in particular ensure you added your SEED PHRASE

## Setup

1. Install dependencies:
Run the following command from the top-level directory of the project:
```sh
npm install
```

## Proof Specific Setup

### groth16

*Note* All files are already committed and pregenerated but if you wish to do it again there is a setup.sh you can run:
```sh
cd groth16
./setup.sh
```

## Running the Proof Generation and Submission Script

### Parameters
The script accepts three parameters:

- Interval (in seconds): The time interval between sending proofs.
- Duration (in seconds): The total duration for which proofs will be sent.
- Skip Attestation (optional): If set to true, the script will skip waiting for attestation. Recommended for parallel execution. (default true)

### Example Command
1. Via package.json (1 Proof every 5s for 60s)
```shell
npm run generate:groth16 5 60
```
2. Run the file directly with ts-node
```shell
npx ts-node src/proof-generator/index.ts 5 60 true
```

## Generating and sending a single unique groth16 proof
```shell
npx ts-node src/proof-generator/groth16/send/index.ts
```

## Docker

1. Ensure .env.generator contains a valid wallet seed phrase and websocket
2. Build from the top level zkVerify-qa:
```shell
docker build -t proof-generator -f src/proof-generator/Dockerfile .
```
3. Run the container and pass in the interval and duration (1 proof every INTERVAL for DURATION):
```shell
docker run -e INTERVAL=10 -e DURATION=120 proof-generator
```

## Notes
- Ensure your .env file is set up with the required environment variables:

*WEBSOCKET*: The WebSocket endpoint of your Substrate node.
*PRIVATE_KEY*: The private key of the account used for submitting transactions.

