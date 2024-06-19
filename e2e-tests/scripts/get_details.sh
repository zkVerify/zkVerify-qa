#!/bin/bash

jsonrpc_call() {
  local method=$1
  local params=$2
  curl -s -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"${method}\",\"params\":${params},\"id\":1}" https://testnet-rpc.zkverify.io
}

hex_to_int() {
  local hex_value=$1
  echo $((16#${hex_value}))
}

FINALIZED_HEAD=$(jsonrpc_call "chain_getFinalizedHead" "[]" | jq -r .result)
echo "Finalized head hash: $FINALIZED_HEAD"

FINALIZED_BLOCK=$(jsonrpc_call "chain_getBlock" "[\"${FINALIZED_HEAD}\"]")
FINALIZED_BLOCK_NUMBER_HEX=$(echo $FINALIZED_BLOCK | jq -r .result.block.header.number)
FINALIZED_BLOCK_NUMBER_HEX_STRIPPED=$(echo $FINALIZED_BLOCK_NUMBER_HEX | sed 's/^0x//')
FINALIZED_BLOCK_NUMBER_INT=$(hex_to_int "$FINALIZED_BLOCK_NUMBER_HEX_STRIPPED")
echo "Finalized block hash: $FINALIZED_HEAD"
echo "Finalized block number (hex): $FINALIZED_BLOCK_NUMBER_HEX"
echo "Finalized block number (int): $FINALIZED_BLOCK_NUMBER_INT"

LATEST_HEADER_RESPONSE=$(jsonrpc_call "chain_getHeader" "[]")
LATEST_HEAD=$(echo $LATEST_HEADER_RESPONSE | jq -r .result)
LATEST_BLOCK_NUMBER_HEX=$(echo $LATEST_HEAD | jq -r .number)
LATEST_BLOCK_NUMBER_HEX_STRIPPED=$(echo $LATEST_BLOCK_NUMBER_HEX | sed 's/^0x//')
LATEST_BLOCK_NUMBER_INT=$(hex_to_int "$LATEST_BLOCK_NUMBER_HEX_STRIPPED")
LATEST_PARENT_HASH=$(echo $LATEST_HEAD | jq -r .parentHash)
echo "Latest header response: $LATEST_HEADER_RESPONSE"
echo "Latest block number (hex): $LATEST_BLOCK_NUMBER_HEX"
echo "Latest block number (int): $LATEST_BLOCK_NUMBER_INT"
echo "Latest parent hash: $LATEST_PARENT_HASH"

LATEST_HEAD_HASH=$(jsonrpc_call "chain_getBlockHash" "[\"${LATEST_BLOCK_NUMBER_HEX}\"]" | jq -r .result)
echo "Latest head hash: $LATEST_HEAD_HASH"
