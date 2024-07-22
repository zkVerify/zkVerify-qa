#!/bin/bash

# Check for required arguments
if [ $# -ne 1 ]; then
  echo "Usage: $0 <proof-type>"
  echo "proof-type: groth16 or fflonk"
  exit 1
fi

PROOF_TYPE=$1

if [ "$PROOF_TYPE" != "groth16" ] && [ "$PROOF_TYPE" != "fflonk" ]; then
  echo "Invalid proof type: $PROOF_TYPE"
  echo "Usage: $0 <proof-type>"
  exit 1
fi

PROOF_GENERATOR_DIR=$(pwd)
POWERS_OF_TAU_DIR="$PROOF_GENERATOR_DIR/powers-of-tau"
CIRCUIT_DIR="$PROOF_GENERATOR_DIR/$PROOF_TYPE/circuit"
CIRCUIT_JS_DIR="$CIRCUIT_DIR/circuit_js"
ZKEY_DIR="${CIRCUIT_DIR}/zkey"
PROOF_DIR="${CIRCUIT_DIR}/proof"
DATA_DIR="${CIRCUIT_DIR}/data"

# Check if Powers of Tau is already setup
if [ ! -d "$POWERS_OF_TAU_DIR" ]; then
  ./powers_of_tau_setup.sh
else
  read -p "Powers of Tau directory exists. Do you want to regenerate it? (y/n): " confirm
  if [ "$confirm" = "y" ]; then
    rm -rf "$POWERS_OF_TAU_DIR"
    ./powers_of_tau_setup.sh
  fi
fi

# Confirm deletion of existing directories
confirm_deletion() {
  local dir=$1
  if [ -d "$dir" ]; then
    read -p "Directory $dir exists. Do you want to delete it and continue? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
      rm -rf "$dir"
      echo "Deleted $dir."
    else
      echo "Aborted."
      exit 1
    fi
  fi
}

confirm_deletion "$CIRCUIT_DIR"

# Create required directories
mkdir -p "$CIRCUIT_DIR"
mkdir -p "$ZKEY_DIR"
mkdir -p "$PROOF_DIR"
mkdir -p "$DATA_DIR"

# Generate New Circuit
echo "Generating new circuit..."

cd "$CIRCUIT_DIR"

# Create a Multiplier.circom file
cat <<EOT > circuit.circom
template Multiplier(n) {
    signal input a;
    signal input b;
    signal output c;

    signal int[n];

    int[0] <== a*a + b;
    for (var i=1; i<n; i++) {
        int[i] <== int[i-1]*int[i-1] + b;
    }

    c <== int[n-1];
}

component main = Multiplier(1000);
EOT

circom circuit.circom --r1cs --wasm --sym
if [ ! -f circuit.r1cs ]; then
  echo "Error: circuit.r1cs not found!"
  exit 1
fi

# View information about the circuit
snarkjs r1cs info circuit.r1cs

# Print the constraints
snarkjs r1cs print circuit.r1cs circuit.sym

# Generate witness
echo "Generating witness..."

cat <<EOT > input.json
{"a": 2, "b": 3}
EOT

echo "Running: node $CIRCUIT_JS_DIR/generate_witness.js $CIRCUIT_JS_DIR/circuit.wasm $CIRCUIT_DIR/input.json $CIRCUIT_DIR/witness.wtns"
node "$CIRCUIT_JS_DIR/generate_witness.js" "$CIRCUIT_JS_DIR/circuit.wasm" "$CIRCUIT_DIR/input.json" "$CIRCUIT_DIR/witness.wtns"

if [ ! -f "$CIRCUIT_DIR/witness.wtns" ]; then
  echo "Error: witness.wtns not found!"
  exit 1
fi

snarkjs wtns check "$CIRCUIT_DIR/circuit.r1cs" "$CIRCUIT_DIR/witness.wtns"

cd "$PROOF_GENERATOR_DIR"

echo "Circuit generation completed."

# Setup
echo "Starting setup..."

# Debug statements to print current directory and variable values
echo "Current directory: $(pwd)"
echo "CIRCUIT_DIR: $CIRCUIT_DIR"
echo "POWERS_OF_TAU_DIR: $POWERS_OF_TAU_DIR"
echo "ZKEY_DIR: $ZKEY_DIR"

if [ "$PROOF_TYPE" = "groth16" ]; then
  snarkjs groth16 setup "$CIRCUIT_DIR/circuit.r1cs" "$POWERS_OF_TAU_DIR/pot14_final.ptau" "$ZKEY_DIR/circuit_0000.zkey"
elif [ "$PROOF_TYPE" = "fflonk" ]; then
  snarkjs fflonk setup "$CIRCUIT_DIR/circuit.r1cs" "$POWERS_OF_TAU_DIR/pot14_final.ptau" "$ZKEY_DIR/circuit_final.zkey"
fi

if [ ! -f "$ZKEY_DIR/circuit_0000.zkey" ] && [ "$PROOF_TYPE" = "groth16" ]; then
  echo "Error: $ZKEY_DIR/circuit_0000.zkey not found!"
  exit 1
fi

if [ ! -f "$ZKEY_DIR/circuit_final.zkey" ] && [ "$PROOF_TYPE" = "fflonk" ]; then
  echo "Error: $ZKEY_DIR/circuit_final.zkey not found!"
  exit 1
fi

# Contribution phase for Groth16
if [ "$PROOF_TYPE" = "groth16" ]; then
  # First contribution (input 123)
  echo "123" | snarkjs zkey contribute "$ZKEY_DIR/circuit_0000.zkey" "$ZKEY_DIR/circuit_0001.zkey" --name="1st Contributor Name" -v
  if [ ! -f "$ZKEY_DIR/circuit_0001.zkey" ]; then
    echo "Error: $ZKEY_DIR/circuit_0001.zkey not found!"
    exit 1
  fi

  # Second contribution
  snarkjs zkey contribute "$ZKEY_DIR/circuit_0001.zkey" "$ZKEY_DIR/circuit_0002.zkey" --name="Second contribution Name" -v -e="Another random entropy"
  if [ ! -f "$ZKEY_DIR/circuit_0002.zkey" ]; then
    echo "Error: $ZKEY_DIR/circuit_0002.zkey not found!"
    exit 1
  fi

  snarkjs zkey verify "$CIRCUIT_DIR/circuit.r1cs" "$POWERS_OF_TAU_DIR/pot14_final.ptau" "$ZKEY_DIR/circuit_0002.zkey"
  snarkjs zkey beacon "$ZKEY_DIR/circuit_0002.zkey" "$ZKEY_DIR/circuit_final.zkey" 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
  if [ ! -f "$ZKEY_DIR/circuit_final.zkey" ]; then
    echo "Error: $ZKEY_DIR/circuit_final.zkey not found!"
    exit 1
  fi

  snarkjs zkey verify "$CIRCUIT_DIR/circuit.r1cs" "$POWERS_OF_TAU_DIR/pot14_final.ptau" "$ZKEY_DIR/circuit_final.zkey"
fi

# Export the verification key
snarkjs zkey export verificationkey "$ZKEY_DIR/circuit_final.zkey" "$ZKEY_DIR/verification_key.json"

echo "All steps are completed successfully."

# Generate the proof
echo "Generating the $PROOF_TYPE proof..."

snarkjs $PROOF_TYPE prove "$ZKEY_DIR/circuit_final.zkey" "$CIRCUIT_DIR/witness.wtns" "$PROOF_DIR/proof.json" "$PROOF_DIR/public.json"
if [ $? -ne 0 ]; then
  echo "Error: Failed to generate $PROOF_TYPE proof."
  exit 1
fi

# Verify the proof
echo "Verifying the $PROOF_TYPE proof..."

snarkjs $PROOF_TYPE verify "$ZKEY_DIR/verification_key.json" "$PROOF_DIR/public.json" "$PROOF_DIR/proof.json"
if [ $? -ne 0 ]; then
  echo "Error: $PROOF_TYPE Proof verification failed."
  exit 1
fi

echo "$PROOF_TYPE proof generated and verified successfully."
