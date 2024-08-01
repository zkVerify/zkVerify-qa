use multiply_methods::MULTIPLY_ELF;
use risc0_zkvm::{
    default_prover,
    serde::{from_slice, to_vec},
    ExecutorEnv,
};

fn main() {
    let a: u64 = 17;
    let b: u64 = 23;

    println!("Sending values to guest: a = {}, b = {}", a, b);

    let env = ExecutorEnv::builder()
        .write(&a).unwrap()
        .write(&b).unwrap()
        .build()
        .unwrap();

    let prover = default_prover();

    println!("Proving...");
    let receipt = prover.prove(env, MULTIPLY_ELF).unwrap().receipt;
    println!("Receipt received...");
    let output: u64 = receipt.journal.decode().unwrap();

    println!("Hello, world! I generated a proof of guest execution! {} is a public output from journal ", output);
}
