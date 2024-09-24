# E2E Tests for zkVerify Project

This directory contains end-to-end tests for the zkVerify project, including setup scripts and Docker configurations.

## Prerequisites

- Node.js (latest LTS version recommended)
- Docker and Docker Compose
- Git

## Setup

Install necessary Node.js dependencies in the top-level directory:

```bash
npm install
```

## Running the setup script

The `setup.sh` script clones necessary repositories and manages Docker images for local development.

### Usage

```bash
./setup.sh [options]
```

### Options

- `--fetch-latest`: Update local repositories to the latest code.
- `--rebuild`: Force rebuild of the zkVerify Docker image.
- `--zkverify-branch <branch>`: Specify zkVerify repository branch (default: main).
- `--nh-attestation-bot-branch <branch>`: Specify nh-attestation-bot repository branch (default: main).
- `--zkv-attestation-contracts-branch <branch>`: Specify zkv-attestation-contracts repository branch (default: main).
- `--docker-image-tag <tag>`: Specify zkVerify Docker image tag (default: latest).

### Example

```bash
./setup.sh --fetch-latest --zkverify-branch develop --docker-image-tag 0.5.0
```

## Docker Setup (Local)

### PRE-REQUISITE: Docker Login

Subquery node requires a user to log their device into docker hub:

```shell
docker login
```
- Follow the steps using an account authorised to access the image, once completed you can continue with steps below

### Run locally

1. Start the system:

   ```bash
   docker compose down -v
   docker compose up --build
   ```

   This command will start the following services in order:

   - anvil-node (Ethereum node)
   - local_node, node_alice, node_bob (zkVerify nodes)
   - subquery-postgres (PostgreSQL database)
   - subquery-node (SubQuery indexer)
   - graphql-engine (GraphQL API)
   - attestation-bot (Attestation service)

- You can optionally set the zkVerify docker image tag to use, otherwise it will use `latest`

```bash
ZKVERIFY_IMAGE_TAG=<tag_name> docker compose up --build
```

2. Retrieve the deployed contract address:

   ```bash
   docker ps -a
   docker logs -f <anvil-node-container-id>
   ```

   Look for "Contract Deployed:" in the logs and copy the address.

3. Update environment
   Set `ZKV_CONTRACT` in the `.env` file to the deployed contract address.

Note: This is automatically polled and set in the GitHub Actions workflow, but for running locally must be set.

4. Update the `SUBQUERY_NODE_CHAIN_ID` env variable in `src/e2e-tests/.env`, if you try start with the wrong one the console will error and show you the value to use.

## Running Tests

Execute the E2E tests:

```bash
npm --prefix ../../ run test:e2e
```

### Submit a proof

To submit a proof using data from the `/data` directory:

```bash
npx ts-node ../utils/scripts/submit_proof.ts fflonk
```

## Anvil Standalone Setup

To build and run the Anvil node standalone, use the following commands from within the "services" directory:

```bash
docker build --platform linux/amd64 -t anvil-node -f anvil/Dockerfile .
docker stop anvil-node
docker rm anvil-node
docker run -d \
  --name anvil-node \
  --platform linux/amd64 \
  -p 8545:8545 \
  -v contract-data:/data \
  anvil-node
```

## Troubleshooting

- If the `local_node` service is not initializing, check that we are not using the remote image since that one was build for amd64 architectures. We need to build the image locally to properly run the services locally.

  ```bash
  ./setup.sh --rebuild
  ```
  
- If errors about lack of storage space consider clearing the cargo cache and pruning docker

```shell
cargo clean
docker system prune -a 
```

## Notes: GitHub Actions

- When running in GitHub Actions, Docker image handling is skipped as the workflow manages it.
- Ensure all required environment variables are set before running tests or scripts.
