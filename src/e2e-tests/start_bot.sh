#!/bin/sh
set -eou pipefail

MAX_WAIT_TIME=300
wait_time=0

if ! command -v curl > /dev/null 2>&1; then
    echo "Installing curl..."
    apk add --no-cache curl
fi

if [ -f /data/contract_data.txt ]; then
    echo "Clearing old contract data..."
    rm /data/contract_data.txt
fi

echo "Checking if Substrate node is up..."
while ! curl -m 10 -s http://local_node:9944/ > /dev/null; do
    echo "Waiting for Substrate node to be ready..."
    sleep 5
done
echo "Substrate node is ready."

echo "Checking if Anvil node is up..."
while ! curl -m 10 -s http://anvil-node:8545/ > /dev/null; do
    echo "Waiting for Anvil node to be ready..."
    sleep 5
done
echo "Anvil node is ready."

echo "Waiting for contract data to be ready..."
while true; do
    if [ -f /data/contract_data.txt ]; then
        CONTRACT_ADDRESS=$(sed -n '1p' /data/contract_data.txt | cut -d ' ' -f 3)
        SEED_PHRASE=$(sed -n '2p' /data/contract_data.txt | cut -d ' ' -f 3)
        if [ ! -z "$CONTRACT_ADDRESS" ] && [ ! -z "$SEED_PHRASE" ]; then
            echo "Contract data is ready."
            break
        fi
    fi
    if [ "$wait_time" -ge "$MAX_WAIT_TIME" ]; then
        echo "Timeout reached: contract data file is not ready."
        exit 1
    fi
    echo "Waiting for contract data file to be ready..."
    sleep 2
    wait_time=$((wait_time + 2))
done

echo "Contract Address: $CONTRACT_ADDRESS"
echo "Private Key: $SEED_PHRASE"

# Export environment variables required by the bot
export NH_ATTEST_BOT_NH_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
export NH_ATTEST_BOT_OPERATOR_SECRET_KEY=$SEED_PHRASE

# Start the bot
node src/main.js
