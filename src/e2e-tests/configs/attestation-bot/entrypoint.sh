#!/bin/bash
set -eEuo pipefail

# -----------------------------
# Configuration Variables
# -----------------------------

BLOCKCHAIN_NODE_WS_URL="ws://local_node:9944"
# JSON-RPC request to fetch the genesis hash (chainId)
CHAIN_ID_REQUEST='{"id":1,"jsonrpc":"2.0","method":"chain_getBlockHash","params":[0]}'
# Number of retries and interval between retries
MAX_RETRIES=5
RETRY_INTERVAL=2  # in seconds

# Install websocat to /tmp if it doesn't exist already
install_websocat() {
  if ! command -v /tmp/websocat &> /dev/null; then
    echo "websocat not found. Installing to /tmp..."

    ARCH=$(uname -m)
    case "${ARCH}" in
      x86_64)
        WEBSOCAT_URL="https://github.com/vi/websocat/releases/download/v1.13.0/websocat.x86_64-unknown-linux-musl"
        ;;
      aarch64)
        WEBSOCAT_URL="https://github.com/vi/websocat/releases/download/v1.13.0/websocat.aarch64-unknown-linux-musl"
        ;;
      *)
        echo "Unsupported architecture: ${ARCH}"
        exit 1
        ;;
    esac

    wget -qO- "${WEBSOCAT_URL}" > /tmp/websocat
    chmod +x /tmp/websocat
  fi
}

fetch_chain_id() {
  echo "Fetching Chain ID from ${BLOCKCHAIN_NODE_WS_URL}..."

  for attempt in $(seq 1 "${MAX_RETRIES}"); do
    echo "Attempt ${attempt} of ${MAX_RETRIES}..."

    # Send the JSON-RPC request using netcat and capture the response
    RESPONSE=$(echo "${CHAIN_ID_REQUEST}" | /tmp/websocat "${BLOCKCHAIN_NODE_WS_URL}" 2>/dev/null || true)

    # Check if RESPONSE is not empty
    if [[ -n "${RESPONSE}" ]] && echo "${RESPONSE}" | yq e -o=json > /dev/null 2>&1; then
      # Extract the 'result' field using yq
      CHAIN_ID=$(echo "${RESPONSE}" | yq e '.result' -)

      # Validate the CHAIN_ID
      if [[ "${CHAIN_ID}" != "null" ]] && [[ -n "${CHAIN_ID}" ]]; then
        echo "Successfully retrieved Chain ID: ${CHAIN_ID}"
        export SUBQUERY_NODE_CHAIN_ID="${CHAIN_ID}"
        return 0
      fi
    fi

    echo "Failed to retrieve Chain ID. Retrying in ${RETRY_INTERVAL} seconds..."
    echo "Response: ${RESPONSE}"
    sleep "${RETRY_INTERVAL}"
  done

  echo "Error: Unable to retrieve Chain ID after ${MAX_RETRIES} attempts."
  exit 1
}

# Install websocat if necessary
install_websocat

# Attempting to fetch the chainId from the blockchain node
fetch_chain_id


# List of required environment variables
required_env_vars=(
  "SUBQUERY_NODE_CHAIN_ID"
  "SUBQUERY_NODE_STARTING_BLOCK"
)

# Validate that all required environment variables are set
for var in "${required_env_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "Error: Environment variable ${var} is required. Exiting..."
    sleep 5
    exit 1
  fi
done

yq -i '.network.chainId = strenv(SUBQUERY_NODE_CHAIN_ID) | .network.chainId style="double"' /app/project.yaml
yq -i '.dataSources[0].startBlock = env(SUBQUERY_NODE_STARTING_BLOCK)' /app/project.yaml

exec /sbin/tini -- /bin/run "$@"
