#!/bin/bash

# Define directories
POWERS_OF_TAU_DIR="powers_of_tau"
CIRCUIT_DIR="circuit"
ZKEY_DIR="${CIRCUIT_DIR}/zkey"
PROOF_DIR="${CIRCUIT_DIR}/proof"

# Function to prompt for confirmation before deleting directories
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

# Confirm deletion of existing directories
confirm_deletion "$POWERS_OF_TAU_DIR"
confirm_deletion "$CIRCUIT_DIR"

# Create required directories
mkdir -p "$POWERS_OF_TAU_DIR"
mkdir -p "$CIRCUIT_DIR"
mkdir -p "$ZKEY_DIR"
mkdir -p "$PROOF_DIR"

# Powers of Tau Ceremony
echo "Starting Powers of Tau Ceremony..."

cd "$POWERS_OF_TAU_DIR"

snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
if [ $? -ne 0 ]; then
  echo "Error: Failed to create new powers of tau file."
  exit 1
fi

# First contribution (input 123)
echo "123" | snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
if [ ! -f pot14_0001.ptau ]; then
  echo "Error: pot14_0001.ptau not found!"
  exit 1
fi

# Second contribution
snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau --name="Second contribution" -v -e="some random text"
if [ ! -f pot14_0002.ptau ]; then
  echo "Error: pot14_0002.ptau not found!"
  exit 1
fi

snarkjs powersoftau verify pot14_0002.ptau
snarkjs powersoftau beacon pot14_0002.ptau pot14_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
if [ ! -f pot14_beacon.ptau ]; then
  echo "Error: pot14_beacon.ptau not found!"
  exit 1
fi

snarkjs powersoftau prepare phase2 pot14_beacon.ptau pot14_final.ptau -v
if [ ! -f pot14_final.ptau ]; then
  echo "Error: pot14_final.ptau not found!"
  exit 1
fi

snarkjs powersoftau verify pot14_final.ptau

cd ..

echo "Powers of Tau Ceremony completed."

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

snarkjs wtns calculate circuit.wasm input.json witness.wtns
snarkjs wtns check circuit.r1cs witness.wtns

cd ..

echo "Circuit generation completed."

# Setup
echo "Starting setup..."

snarkjs groth16 setup "$CIRCUIT_DIR/circuit.r1cs" "$POWERS_OF_TAU_DIR/pot14_final.ptau" "$ZKEY_DIR/circuit_0000.zkey"
if [ ! -f "$ZKEY_DIR/circuit_0000.zkey" ]; then
  echo "Error: $ZKEY_DIR/circuit_0000.zkey not found!"
  exit 1
fi

# First contribution (input 123)
echo "123" | snarkjs zkey contribute "$ZKEY_DIR/circuit_0000.zkey" "$ZKEY_DIR/circuit_0001.zkey" --name="1st Contributor Name" -v
if [ ! -f "$ZKEY_DIR/circuit_0001.zkey" ]; then
  echo "Error: $ZKEY_DIR/circuit_0001.zkey not found!"
  exit 1
fi

# Second contribution
snarkjs zkey contribute "$ZKEY_DIR/circuit_0001.zkey" "$ZKEY_DIR/circuit_0002.zkey" --name="Second contribution Name" -v -e="Another random entropy"
if [ ! -f "$ZKEY_DIR/circuit_0002.zkey"]; then
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

# Export the verification key
snarkjs zkey export verificationkey "$ZKEY_DIR/circuit_final.zkey" "$ZKEY_DIR/verification_key.json"

echo "Setup completed."

echo "All steps are completed successfully."

# Generate the proof
echo "Generating the proof..."

snarkjs groth16 prove "$ZKEY_DIR/circuit_final.zkey" "$CIRCUIT_DIR/witness.wtns" "$PROOF_DIR/proof.json" "$PROOF_DIR/public.json"
if [ $? -ne 0 ]; then
  echo "Error: Failed to generate proof."
  exit 1
fi

# Verify the proof
echo "Verifying the proof..."

snarkjs groth16 verify "$ZKEY_DIR/verification_key.json" "$PROOF_DIR/public.json" "$PROOF_DIR/proof.json"
if [ $? -ne 0 ]; then
  echo "Error: Proof verification failed."
  exit 1
fi

echo "Proof generated and verified successfully."
