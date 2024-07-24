#!/bin/bash

PROOF_GENERATOR_DIR=$(pwd)
BOOJUM_REPO_DIR="$PROOF_GENERATOR_DIR/repos/era-boojum"
CIRCUIT_DIR="$PROOF_GENERATOR_DIR/boojum/circuit"
RUST_VERSION="nightly-2024-05-07" # Specific nightly version used in their CI

# Ensure Rust is installed and updated
if ! command -v rustc &> /dev/null; then
  echo "Rust not found, installing..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source $HOME/.cargo/env
else
  echo "Rust is already installed."
fi

# Ensure specific nightly Rust toolchain is installed
if ! rustup toolchain list | grep -q "$RUST_VERSION"; then
  echo "Specific nightly Rust toolchain not found, installing..."
  rustup install "$RUST_VERSION"
fi

# Set the current directory to use specific nightly Rust toolchain
rustup override set "$RUST_VERSION"

# Clone Boojum repository if not already present
if [ ! -d "$BOOJUM_REPO_DIR" ]; then
  git clone https://github.com/matter-labs/era-boojum.git "$BOOJUM_REPO_DIR"
else
  echo "Boojum repository already exists."
  read -p "Do you want to fetch the latest changes from the Boojum repository? (y/n): " update_repo
  if [ "$update_repo" = "y" ]; then
    cd "$BOOJUM_REPO_DIR"
    git pull
    cd "$PROOF_GENERATOR_DIR"
  fi
fi

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

cd "$CIRCUIT_DIR"

# Create a new Rust project for your circuit if not already created
if [ ! -d "src" ]; then
  cargo init --lib
fi

# Add Boojum as a dependency if not already present, with features disabled
if ! grep -q "boojum" Cargo.toml; then
  echo 'boojum = { path = "'"$BOOJUM_REPO_DIR"'", default-features = false }' >> Cargo.toml
fi

# Create the proof...
