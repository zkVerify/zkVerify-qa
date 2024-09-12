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
        echo "Contents of /data/contract_data.txt:"
        cat /data/contract_data.txt

        CONTRACT_ADDRESS=$(sed -n '1p' /data/contract_data.txt | cut -d ' ' -f 3)
        PRIVATE_KEY=$(sed -n '2p' /data/contract_data.txt | cut -d ' ' -f 3-)
        if [ ! -z "$CONTRACT_ADDRESS" ] && [ ! -z "$PRIVATE_KEY" ]; then
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

echo "Debug: Contract Address: $CONTRACT_ADDRESS"
echo "Debug: Private Key (first 10 characters): ${PRIVATE_KEY:0:10}..."

# Ensure the private key starts with "0x"
if [[ $PRIVATE_KEY != 0x* ]]; then
    PRIVATE_KEY="0x$PRIVATE_KEY"
fi

# Export environment variables required by the bot
export NH_ATTEST_BOT_NH_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
export NH_ATTEST_BOT_OPERATOR_SECRET_KEY=$PRIVATE_KEY

echo "Debug: Environment variables set:"
echo "NH_ATTEST_BOT_NH_CONTRACT_ADDRESS=$NH_ATTEST_BOT_NH_CONTRACT_ADDRESS"
echo "NH_ATTEST_BOT_OPERATOR_SECRET_KEY=[REDACTED]"

# Start the bot
echo "Starting the bot..."
node src/main.js
