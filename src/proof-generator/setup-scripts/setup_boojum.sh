#!/bin/bash

PROOF_GENERATOR_DIR=$(pwd)
BOOJUM_REPO_DIR="$PROOF_GENERATOR_DIR/repos/era-boojum"
CIRCUIT_DIR="$PROOF_GENERATOR_DIR/boojum"
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

# Create required directories
mkdir -p "$CIRCUIT_DIR/src"

cd "$CIRCUIT_DIR"

# Confirm deletion of existing files except src/main.rs
if [ -d "$CIRCUIT_DIR" ]; then
  echo "The following directory will be cleared, excluding 'src/main.rs':"
  ls -R "$CIRCUIT_DIR"

  read -p "Do you want to proceed with the deletion? (y/n): " confirm_delete
  if [ "$confirm_delete" != "y" ]; then
    echo "Aborting deletion."
    exit 0
  fi

  # Delete all files and directories except src/main.rs
  find "$CIRCUIT_DIR" -mindepth 1 -maxdepth 1 ! -name 'src' -exec rm -rf {} +
  find "$CIRCUIT_DIR/src" -mindepth 1 ! -name 'main.rs' -exec rm -rf {} +
fi

# Create a new Rust project for your circuit if not already created
if [ ! -f "Cargo.toml" ]; then
  cargo init --bin
fi

# Update Cargo.toml with correct dependencies
echo "Updating Cargo.toml..."

# Overwrite Cargo.toml with correct dependencies
cat <<EOL > Cargo.toml
[package]
name = "boojum"
version = "0.1.0"
edition = "2021"

[dependencies]
boojum = { path = "../repos/era-boojum", default-features = false }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
hex = "0.4"
chrono = "0.4"
EOL

# Build the Rust project
echo "Building the Rust project..."
cargo build --release

if [ $? -ne 0 ]; then
  echo "Build failed. Please check the errors and try again."
  exit 1
fi

# Run the Rust project with default inputs 1 2
echo "Running the Rust project..."
cargo run --release -- 1 2

if [ $? -ne 0 ]; then
  echo "Execution failed. Please check the output for details."
  exit 1
fi

echo "Proof and public inputs have been generated and saved."
