import { ProofData } from "./types";
import { formatProof, formatScalar, formatVk } from "./utils";
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const nodeCrypto = require("crypto");

/**
 * Generates a unique input for the zk-SNARK proof.
 * This input is created using a combination of a random value and the current timestamp.
 * The inputs are then hashed using SHA-256 and split into two hex strings.
 *
 * @returns { a: string; b: string } - An object containing two unique hex strings.
 */
function generateUniqueInput(): { a: string; b: string } {
    const randomValue = nodeCrypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString();
    const hash = nodeCrypto.createHash('sha256').update(randomValue + timestamp).digest('hex');

    const a = "0x" + hash.slice(0, 32);
    const b = "0x" + hash.slice(32, 64);

    return { a, b };
}

/**
 * Generates and verifies a zk-SNARK proof using the groth16 protocol.
 *
 * @returns {Promise<ProofData>} - A promise that resolves to the generated proof data.
 *
 * @throws Will throw an error if any of the required files are not found,
 * or if the generated proof is invalid.
 */
export async function generateAndVerifyProof(): Promise<ProofData> {
    const circuitWasm = path.join(__dirname, "./circuit/circuit.wasm");
    const provingKey = path.join(__dirname, "./circuit/zkey/circuit_final.zkey");
    const verificationKeyPath = path.join(__dirname, "./circuit/zkey/verification_key.json");
    const witnessFile = path.join(__dirname, "./circuit/witness.wtns");

    if (!fs.existsSync(circuitWasm)) {
        throw new Error(`Circuit WASM file not found at ${circuitWasm}`);
    }
    if (!fs.existsSync(provingKey)) {
        throw new Error(`Proving key file not found at ${provingKey}`);
    }
    if (!fs.existsSync(verificationKeyPath)) {
        throw new Error(`Verification key file not found at ${verificationKeyPath}`);
    }

    const input = generateUniqueInput();
    const inputJson = {
        a: input.a,
        b: input.b,
    };

    fs.writeFileSync(path.join(__dirname, "./circuit/input.json"), JSON.stringify(inputJson, null, 2));

    await snarkjs.wtns.calculate(inputJson, circuitWasm, witnessFile);
    console.log("Witness generated and written to", witnessFile);

    if (!fs.existsSync(witnessFile)) {
        throw new Error(`Witness file not found at ${witnessFile}`);
    }

    const { proof, publicSignals } = await snarkjs.groth16.prove(provingKey, witnessFile);
    const vkJson = JSON.parse(fs.readFileSync(verificationKeyPath, "utf8"));

    const proofData: ProofData = {
        proof: {
            curve: "Bn254",
            proof: formatProof(proof),
        },
        publicSignals: publicSignals.map(formatScalar),
        vk: formatVk(vkJson),
    };

    const isValid = await snarkjs.groth16.verify(vkJson, publicSignals, proof);

    if (isValid) {
        console.log("Generated a valid groth16 proof");
    } else {
        throw new Error("Generated groth16 proof is invalid");
    }

    return proofData;
}
