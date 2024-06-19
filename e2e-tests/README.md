# Project Setup Guide

## Pre-requisites

1. Run the setup script in the parent directory to pull down other repositories and build the `nh-core` image. Use `--fetch-latest` to pull down the latest code from the repo and use the `--rebuild` flag to force a rebuild of an already existing image:

    ```bash
    ./setup.sh --fetch-latest --rebuild
    ```

2. Install necessary Node.js dependencies:

    ```bash
    npm install
    ```

## Docker

### Starting the System

To start `Anvil` & `nh-core` nodes along with the `nh-attestation-bot`, run the following commands:

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Retrieving Contract Deployed to Anvil

```bash
docker ps -a
docker logs -f <container_id>
```

Locate "Deployed Contract" and copy the value.

### Environment Setup

1. Set the .env NH_CONTRACT value to the Deployed Contract address obtained from the Anvil node.
2. Set the .env FFLONK_PROOF value.

### Running Tests

```bash
npm test
```

### Submit a proof

```bash
node ./scripts/submit_proof.js
```

## Anvil Standalone Setup

To build and run the Anvil node standalone, use the following commands:

```bash
docker build -t anvil-node .
docker run -d --name anvil-node -p 8545:8545 anvil-node
```