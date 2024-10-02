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
- `--zkverify-version <branch | commit | tag>`: Specify zkVerify repository branch, commit, or tag (default: main).
- `--nh-attestation-bot-branch <branch>`: Specify nh-attestation-bot repository branch (default: main).
- `--zkv-attestation-contracts-branch <branch>`: Specify zkv-attestation-contracts repository branch (default: main).
- `--docker-image-tag <tag>`: Specify zkVerify Docker image tag (default: latest).

### Example
-  ```bash
    ./setup.sh --fetch-latest --zkverify-version develop --docker-image-tag 0.5.0
      ```
      This will first check if a Docker image `horizenlabs/zkverify:0.5.0` exists locally.

      If not, it will check Docker Hub for the Docker image `horizenlabs/zkverify:0.5.0`.
      
      If not, it will build a Docker image from the develop branch.


- ```bash
    ./setup.sh --fetch-latest --rebuild --zkverify-version develop --docker-image-tag 0.5.0
   ```
   
   The `--rebuild` tag will rebuild the Docker image, regardless whether `horizenlab/zkverify:0.5.0` exists locally or on Docker hub.

## Docker Setup

1. Start the system:

   ```bash
   docker compose down -v
   ZKVERIFY_IMAGE_TAG=<tag_name> docker compose up --build
   ```

   This command will start the following services in order:

   - anvil-node (Ethereum node)
   - local_node, node_alice, node_bob (zkVerify nodes)
   - subquery-postgres (PostgreSQL database)
   - subquery-node (SubQuery indexer)
   - graphql-engine (GraphQL API)
   - attestation-bot (Attestation service)

2. Retrieve the deployed contract address:

   ```bash
   docker ps -a
   docker logs -f <anvil-node-container-id>
   ```

   Look for "Contract Deployed:" in the logs and copy the address.

3. Update environment
   Set `ZKV_CONTRACT` in the `.env` file to the deployed contract address.

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

## Notes: GitHub Actions

- When running in GitHub Actions, Docker image handling is skipped as the workflow manages it.
- Ensure all required environment variables are set before running tests or scripts.
