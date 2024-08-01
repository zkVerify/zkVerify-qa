# RISC Zero Rust

## Setup

Run the `./setup.sh risc0` command from within the `proof-generator` directory.

## Create A Proof

```
cargo run --release --bin prove
```

## Verify A Proof (Using risc0)

```
cargo run --release --bin verify
```

## Verify A Proof (Using zkVerify)