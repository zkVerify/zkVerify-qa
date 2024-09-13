#!/bin/bash
set -eEuo pipefail

# check required env vars are set
vars_to_check=(
  "SUBQUERY_NODE_CHAIN_ID"
  "SUBQUERY_NODE_STARTING_BLOCK"
)

for var in "${vars_to_check[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "Error: Environment variable ${var} is required. Exiting ..."
    sleep 5
    exit 1
  fi
done

yq -i '.network.chainId = strenv(SUBQUERY_NODE_CHAIN_ID) | .network.chainId style="double"' /app/project.yaml
yq -i '.dataSources[0].startBlock = env(SUBQUERY_NODE_STARTING_BLOCK)' /app/project.yaml

exec /sbin/tini -- /bin/run "$@"
