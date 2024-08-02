# Proof Generation and Submission Script

Generate unique proofs and submit them to zkVerify.

## Prerequisites

1. Before you begin, ensure you have the following tools installed globally on your system:

- **snarkjs**: This is a JavaScript library for generating and verifying zk-SNARK proofs.
```sh
npm install -g snarkjs
```
- **Rust**: Ensure you have Rust and Cargo installed. If you don't have Rust installed, you can install it using the following command:
```sh
cd
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup self update
rustup update stable
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
```
- **circom**: Install circom on your machine, this is a circuit compiler for zk-SNARKs.
```sh
cd
git clone https://github.com/iden3/circom.git ~/circom
cd ~/circom
cargo build --release
```
Export the path:
```sh
cd
echo 'export PATH="$PATH:$HOME/circom/target/release"' >> ~/.zshrc 
source ~/.zshrc
```
Verify the installation:
```sh
circom --version
```

2. Update the .env.generator file values, in particular ensure you added your SEED PHRASE

## Setup

1. Install dependencies:
Run the following command from the top-level directory of the project:
```sh
npm install
```

## Proof Specific Setup

All files are already committed and pregenerated but if you wish to do it again there is a setup.sh you can run and specify the proof type:
```sh
./setup.sh groth16
```

## Running the Proof Generation and Submission Script

### Configuration

The script uses a `config.json` file to configure proof generation and submission parameters. This approach allows you to specify settings for different types of proofs in a structured format.

### Sample `config.json`

```json
{
  "proofs": [
    {
      "type": "groth16",
      "rate": 1,
      "interval": 5,
      "duration": 60,
      "skipAttestation": true
    },
    {
      "type": "fflonk",
      "rate": 1,
      "interval": 10,
      "duration": 120,
      "skipAttestation": true
    }
  ]
}
```

### Example Command

1. Via package.json
```shell
npm run generate:proofs
```
2. Run the file directly with ts-node
```shell
npx ts-node src/proof-generator/index.ts
```

### Generating and sending a single unique proof

1. Via package.json (requires `proofType` and `skipWaitingForAttestationEventBoolean` args)
```shell
npm run generate:single:proof -- fflonk true
```
2. Run the file directly with ts-node
```shell
npx ts-node src/send-proof/index.ts <proofType> <skipWaitingForAttestationEventBoolean>
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
*SEED_PHRASE*: The seed phrase of the account used for submitting transactions.

