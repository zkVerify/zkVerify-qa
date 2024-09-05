# Project Setup Guide

## Pre-requisites

1. Install necessary Node.js dependencies in top level directory:

    ```bash
    npm install
    ```

## Running the setup script

The `setup.sh` script is used to clone necessary repositories and manage Docker images for local development. You can customize its behavior using the following command-line options:

### Command-Line Options

- `--fetch-latest`: This option updates the local repositories to the latest code from the specified branches. It is useful when you want to ensure your local setup is in sync with the latest commits.

  **Example Usage**:
  ```bash
  ./setup.sh --fetch-latest
  ```
- `--rebuild`: Forces a rebuild of the Docker image for zkVerify, even if it already exists locally. Use this option when you want to ensure that you are using the latest version of the Docker image or after making changes that require a fresh build.

  **Example Usage**:
  ```bash
  ./setup.sh --rebuild
  ```
- `--zkverify-branch <branch_name>`: Specifies the branch to use for the zkVerify repository. Defaults to main if not specified.

  **Example Usage**:
  ```bash
  ./setup.sh --zkverify-branch develop
  ```
- `--nh-attestation-bot-branch <branch_name>`: Specifies the branch to use for the nh-attestation-bot repository. Defaults to main if not specified.

  **Example Usage**:
  ```bash
  ./setup.sh --nh-attestation-bot-branch feature-branch
  ```
- `--zkv-attestation-contracts-branch <branch_name>`: Specifies the branch to use for the zkv-attestation-contracts repository. Defaults to main if not specified.

  **Example Usage**:
  ```bash
  ./setup.sh --zkv-attestation-contracts-branch release
  ```
- `--docker-image-tag <tag>`: Specifies the Docker image tag to use for zkVerify. Defaults to latest. Use this option if you want to test against a specific version of the Docker image.

  **Example Usage**:
  ```bash
  ./setup.sh --docker-image-tag 0.5.0
  ``` 
  
### Example Combined Usage

To fetch the latest code from all repositories, build the zkVerify Docker image with a specific tag, and use specific branches for each repository, you could use a command like:

```bash
./setup.sh --fetch-latest --zkverify-branch develop --nh-attestation-bot-branch feature-branch --zkv-attestation-contracts-branch release --docker-image-tag develop
```

### Notes: GitHub Actions

When this script runs in a GitHub Actions environment, Docker image handling is skipped because the workflow itself manages the Docker image.

## Docker

### Starting the System

To start `Anvil` & `zkVerify` nodes along with the `nh-attestation-bot`, run the following commands:

```bash
docker-compose down -v
ZKVERIFY_IMAGE_TAG=<tag_name> docker-compose up --build
ZKVERIFY_IMAGE_TAG=<tag_name> docker-compose build --no-cache
ZKVERIFY_IMAGE_TAG=<tag_name> docker-compose up -d
```

### Retrieving Contract Deployed to Anvil

```bash
docker ps -a
docker logs -f <container_id>
```

Locate "Deployed Contract" and copy the value.

### Environment Setup

1. Set the .env `ZKV_CONTRACT` value to the Deployed Contract address obtained from the Anvil node.
2. Add `ZKVERIFY_IMAGE_TAG` and value to the .env file.

## Running Tests

```bash
npm --prefix ../../ run test:e2e
```

### Submit a proof

Uses proof data from `/data` directory

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