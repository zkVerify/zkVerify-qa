use multiply_methods::MULTIPLY_ELF;
use risc0_zkvm::{
    default_prover,
    serde::{from_slice, to_vec},
    ExecutorEnv,
  };

fn main() {

    let a: u64 = 17;
    let b: u64 = 23;

    let env = ExecutorEnv::builder()
        .add_input(&to_vec(&a).unwrap())
        .add_input(&to_vec(&b).unwrap())
        .build()
        .unwrap();

    let prover = default_prover();

    let receipt = prover.prove_elf(env, MULTIPLY_ELF).unwrap();

    let c: u64 = from_slice(&receipt.journal).unwrap();

    println!("Hello, world! I know the factors of {}, and I can prove it!", c);

    let serialized = bincode::serialize(&receipt).unwrap();

    let _saved_file = match std::fs::write("./receipt.bin", serialized){
         Ok(()) => println!("Receipt saved and serialized as receipt.bin"),
         Err(_) => println!("Something went wrong !!"),
    };
}