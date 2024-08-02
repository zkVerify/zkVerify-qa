use clap::Parser;
use multiply_methods::{MULTIPLY_ELF, MULTIPLY_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde_json::json;
use std::fs::File;
use bincode;
use hex;

#[derive(Parser)]
#[command(name = "zkVM Prover")]
#[command(about = "A tool to generate a zkSNARK proof using RISC0", long_about = None)]
struct Args {
    #[arg(short, long)]
    a: u64,
    #[arg(short, long)]
    b: u64,
}

fn main() {
    let args = Args::parse();

    let a: u64 = args.a;
    let b: u64 = args.b;

    println!("Sending values to guest: a = {}, b = {}", a, b);

    let env = create_execution_env(a, b);
    let receipt = run_prover(env);
    let serialized_data = extract_serialized_data(&receipt);

    save_to_json("output.json", &serialized_data);
    decode_and_display_output(&receipt);
}

fn create_execution_env(a: u64, b: u64) -> ExecutorEnv<'static> {
    ExecutorEnv::builder()
        .write(&a).unwrap()
        .write(&b).unwrap()
        .build()
        .unwrap()
}

fn run_prover(env: ExecutorEnv) -> risc0_zkvm::Receipt {
    let prover = default_prover();
    println!("Proving...");
    let receipt = prover.prove(env, MULTIPLY_ELF).unwrap().receipt;
    println!("Receipt received...");
    receipt
}

fn extract_serialized_data(receipt: &risc0_zkvm::Receipt) -> serde_json::Value {
    let receipt_inner_bytes_array = bincode::serialize(&receipt.inner).unwrap();
    let receipt_journal_bytes_array = bincode::serialize(&receipt.journal).unwrap();

    let image_id_hex: String = MULTIPLY_ID.iter()
        .map(|&value| format!("{:08x}", value.to_be()))
        .collect();

    json!({
        "proof": format!("0x{}", hex::encode(receipt_inner_bytes_array)),
        "outputs": format!("0x{}", hex::encode(receipt_journal_bytes_array)),
        "image_id": format!("0x{}", image_id_hex)
    })
}

fn save_to_json(filename: &str, data: &serde_json::Value) {
    let mut file = File::create(filename).expect("Failed to create file");
    serde_json::to_writer_pretty(&mut file, data).expect("Failed to serialize data to JSON");
    println!("Data saved to {}", filename);
}

fn decode_and_display_output(receipt: &risc0_zkvm::Receipt) {
    let output: u64 = receipt.journal.decode().unwrap();
    println!(
        "Hello, world! I generated a proof of guest execution! {} is a public output from the journal",
        output
    );
}
