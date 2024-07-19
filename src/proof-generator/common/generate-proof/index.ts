import { ProofData, ProofHandler } from "../../types";
import { formatScalar } from "../../utils";
import { getProofHandler } from "../proof-utils";
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const nodeCrypto = require("crypto");

/**
 * Generates a unique input for the zk-SNARK proof.
 * This input is created using a combination of a random value and the current timestamp.
 *
 * @returns {{ a: string; b: string }} An object containing two unique hex strings.
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
 * Writes the input JSON file to a unique filename with a timestamp in the data folder.
 *
 * @param {string} proofType - The type of proof.
 * @param {object} inputJson - The input JSON object.
 * @returns {string} The unique filename created.
 */
function writeInputJsonFile(proofType: string, inputJson: object): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataDir = path.join(__dirname, `../../${proofType}/circuit/data`);

    fs.mkdirSync(dataDir, { recursive: true });

    const uniqueFilename = path.join(dataDir, `input-${timestamp}.json`);
    fs.writeFileSync(uniqueFilename, JSON.stringify(inputJson, null, 2));

    return uniqueFilename;
}

/**
 * Generates a witness file for the zk-SNARK proof.
 *
 * @param {{ a: string; b: string }} input - The unique input for the zk-SNARK proof.
 * @param {string} circuitWasm - The path to the circuit WASM file.
 * @param {string} witnessFile - The path to the witness file to be generated.
 * @returns {Promise<void>} A promise that resolves when the witness file is generated.
 * @throws {Error} If the witness file is not found after generation.
 */
async function generateWitness(input: { a: string; b: string }, circuitWasm: string, witnessFile: string): Promise<void> {
    await snarkjs.wtns.calculate(input, circuitWasm, witnessFile);
    console.log("Witness generated and written to", witnessFile);

    if (!fs.existsSync(witnessFile)) {
        throw new Error(`Witness file not found at ${witnessFile}`);
    }
}

/**
 * Generates and verifies a zk-SNARK proof.
 *
 * @param {string} proofType - The type of proof to generate.
 * @param {string} provingKey - The path to the proving key file.
 * @param {string} witnessFile - The path to the witness file.
 * @param {string} verificationKeyPath - The path to the verification key file.
 * @param {ProofHandler} proofHandler - The handler to format proof and verification key.
 * @returns {Promise<ProofData<any>>} A promise that resolves to the generated proof data.
 * @throws {Error} If the generated proof is invalid.
 */
async function proveAndVerify(
    proofType: string,
    provingKey: string,
    witnessFile: string,
    verificationKeyPath: string,
    proofHandler: ProofHandler
): Promise<ProofData<any>> {
    const { proof, publicSignals } = await snarkjs[proofType].prove(provingKey, witnessFile);
    const vkJson = JSON.parse(fs.readFileSync(verificationKeyPath, "utf8"));

    const formattedProof = proofHandler.formatProof(proof, publicSignals);

    const proofData: ProofData<any> = {
        proof: {
            curve: "Bn254",
            proof: formattedProof,
        },
        publicSignals: publicSignals.map(formatScalar),
        vk: proofHandler.formatVk(vkJson),
    };

    const isValid = await snarkjs[proofType].verify(vkJson, publicSignals, proof);

    if (isValid) {
        console.log(`Generated a valid ${proofType} proof`);
    } else {
        throw new Error(`Generated ${proofType} proof is invalid`);
    }

    return proofData;
}

/**
 * Main function to generate and verify a zk-SNARK proof.
 *
 * @param {string} proofType - The type of proof to generate.
 * @returns {Promise<ProofData<any>>} A promise that resolves to the generated proof data.
 * @throws {Error} If any required file is not found.
 */
export async function generateAndVerifyProof(proofType: string): Promise<ProofData<any>> {
    const circuitWasm = path.join(__dirname, `../../${proofType}/circuit/circuit.wasm`);
    const provingKey = path.join(__dirname, `../../${proofType}/circuit/zkey/circuit_final.zkey`);
    const verificationKeyPath = path.join(__dirname, `../../${proofType}/circuit/zkey/verification_key.json`);
    const witnessFile = path.join(__dirname, `../../${proofType}/circuit/witness.wtns`);

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

    writeInputJsonFile(proofType, inputJson);

    await generateWitness(inputJson, circuitWasm, witnessFile);

    const proofHandler = await getProofHandler(proofType);

    return proveAndVerify(proofType, provingKey, witnessFile, verificationKeyPath, proofHandler);
}
