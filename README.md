# zkVerify-qa

### Supported Proofs

The list of supported proofs can be found in `src/config.ts`, add new proof types here if needed.

### Send Proof

Send a newly generated proof of a specific type by running:

```shell
npx ts-node src/send-proof/index.ts <proofType> <skipWaitingForAttestationEventBoolean>
```

Example:
```shell
npx ts-node src/send-proof/index.ts groth16 true
```

### rpc-tests

RPC schema and valid/invalid proof submission tests.

Further details in rpc-tests README

```shell
npm run test:rpc:testnet
```

### e2e

Spins up 3 zkVerify nodes, attestation bot & an Anvil ethereum node locally using latest code from the repos. 

Submits proofs and checks attestation is collected and posted to Ethereum.

Further details in e2e-tests README.


```shell
npm run test:e2e
```

## GitHub Actions Workflow with Act

Act allows you to test GitHub workflow changes locally.

### Prerequisites

- Docker Desktop installed and running on your Mac.

### Mac Installation and Setup

1. **Install Act**:
    ```sh
    brew install act
    ```

2. **Configure Act**:
    ```sh
    echo '--container-architecture linux/arm64' > ~/.actrc
    echo '--container-daemon-socket /var/run/docker.sock' >> ~/.actrc
    ```

3. **Docker Settings**:
    - Open Docker Desktop.
    - Navigate to **Preferences** > **Advanced**.
    - Tick the option **"Allow the default Docker socket to be used (requires password)"**.

4. **Set Up Docker Socket**:
    ```sh
    sudo ln -s ~/Library/Containers/com.docker.docker/Data/docker.raw.sock /var/run/docker.sock
    sudo chown $USER /var/run/docker.sock
    ```

5. **Start Docker**:
    ```sh
    open /Applications/Docker.app
    ```
6. **Update Secrets File**:
    Update the .secrets file with the require environment variables

### Running Act

Run the following command from the parent directory to test your GitHub Actions workflow locally:
```sh
act pull_request -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```
