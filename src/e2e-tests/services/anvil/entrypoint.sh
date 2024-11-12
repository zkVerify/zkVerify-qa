#!/bin/sh
set -eou pipefail

# Start Anvil
anvil --host 0.0.0.0 --block-time 5 --slots-in-an-epoch 1 > /data/anvil_output.txt 2>&1 &

# Wait for Anvil to be ready
echo "Waiting for Anvil to be ready..."
while ! curl -s http://localhost:8545 > /dev/null; do
    sleep 1
done

# Display Anvil output
echo "Anvil started..."
cat /data/anvil_output.txt

# Extract first account and private key
FIRST_ACCOUNT=$(grep -A 11 "Available Accounts" /data/anvil_output.txt | awk '/\(0\)/ {print $2}')
FIRST_PRIVATE_KEY=$(grep -A 11 "Private Keys" /data/anvil_output.txt | awk '/\(0\)/ {print $2}')

echo "Using account: $FIRST_ACCOUNT"
echo "Using private key: $FIRST_PRIVATE_KEY"

# Initialize Foundry project
echo "Initializing Foundry project..."
forge init --force --no-commit

# Ensure the directory is a Git repository
echo "Ensuring the directory is a Git repository..."
if [ ! -d ".git" ]; then
    git init
    git config user.email "dev@horizenlabs.io"
    git config user.name "Horizen Labs"
fi

# Install Solidity dependencies
echo "Installing Solidity dependencies..."
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit

# Copy contracts to the src directory
echo "Copying contracts to the src directory..."
cp -a /anvil/contracts/* /anvil/src/
echo "Contracts copied successfully."

# Build contracts
echo "Building contracts..."
forge build

# Compile and deploy contract
echo "Compiling and deploying contract..."
ADDRESS=$(forge create ZkVerifyAttestation --rpc-url http://localhost:8545 --private-key $FIRST_PRIVATE_KEY --constructor-args $FIRST_ACCOUNT --json | jq -r '.deployedTo')

# Check if deployment was successful
if [ -z "$ADDRESS" ]; then
    echo "Deployment failed."
    exit 1
fi

echo "Contract Deployed: $ADDRESS"

echo "Contract Address: $ADDRESS" >> /data/contract_data.txt
echo "Private Key: $FIRST_PRIVATE_KEY" >> /data/contract_data.txt

echo "Script completed."

# Keep script running to avoid container exit
wait
