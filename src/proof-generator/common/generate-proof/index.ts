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
 * @param {string} timestamp - The timestamp to use for the filename.
 * @returns {string} The unique filename created.
 */
function writeInputJsonFile(proofType: string, inputJson: object, timestamp: string): string {
    const dataDir = path.join(__dirname, `../../${proofType}/circuit/data`);

    fs.mkdirSync(dataDir, { recursive: true });

    const uniqueFilename = path.join(dataDir, `input-${timestamp}.json`);
    fs.writeFileSync(uniqueFilename, JSON.stringify(inputJson, null, 2));

    return uniqueFilename;
}

/**
 * Generates a witness file for the zk-SNARK proof using the custom generate_witness.js script.
 *
 * @param {string} circuitWasm - The path to the circuit WASM file.
 * @param {string} inputFilePath - The path to the input JSON file.
 * @param {string} witnessFilePath - The path to the witness file to be generated.
 * @returns {Promise<void>} A promise that resolves when the witness file is generated.
 * @throws {Error} If the witness file is not found after generation.
 */
async function generateWitness(circuitWasm: string, inputFilePath: string, witnessFilePath: string): Promise<void> {
    const generateWitnessScript = path.join(path.dirname(circuitWasm), 'generate_witness.js');
    const cmd = `node ${generateWitnessScript} ${circuitWasm} ${inputFilePath} ${witnessFilePath}`;

    const { exec } = require('child_process');
    return new Promise<void>((resolve, reject) => {
        exec(cmd, (error: any, stdout: string, stderr: string) => {
            if (error) {
                console.error("Error generating witness:", stderr);
                reject(`Error generating witness: ${stderr}`);
                return;
            }

            if (!fs.existsSync(witnessFilePath)) {
                reject(`Witness file not found at ${witnessFilePath}`);
                return;
            }
            resolve();
        });
    });
}

/**
 * Generates and verifies a zk-SNARK proof.
 *
 * @param {string} proofType - The type of proof to generate.
 * @param {string} provingKey - The path to the proving key file.
 * @param {string} witnessFilePath - The path to the witness file.
 * @param {string} verificationKeyPath - The path to the verification key file.
 * @param {ProofHandler} proofHandler - The handler to format proof and verification key.
 * @returns {Promise<ProofData<any>>} A promise that resolves to the generated proof data.
 * @throws {Error} If the generated proof is invalid.
 */
async function proveAndVerify(
    proofType: string,
    provingKey: string,
    witnessFilePath: string,
    verificationKeyPath: string,
    proofHandler: ProofHandler
): Promise<ProofData<any>> {
    const { proof, publicSignals } = await snarkjs[proofType].prove(provingKey, witnessFilePath);
    const vkJson = JSON.parse(fs.readFileSync(verificationKeyPath, "utf8"));
    console.log(`pubs: ${publicSignals}`)
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
    const circuitWasm = path.join(__dirname, `../../${proofType}/circuit/circuit_js/circuit.wasm`);
    const provingKey = path.join(__dirname, `../../${proofType}/circuit/zkey/circuit_final.zkey`);
    const verificationKeyPath = path.join(__dirname, `../../${proofType}/circuit/zkey/verification_key.json`);

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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const inputFilePath = writeInputJsonFile(proofType, inputJson, timestamp);

    const witnessFilePath = path.join(__dirname, `../../${proofType}/circuit/data`, `witness-${timestamp}.wtns`);

    await generateWitness(circuitWasm, inputFilePath, witnessFilePath);

    const proofHandler = await getProofHandler(proofType);

    return proveAndVerify(proofType, provingKey, witnessFilePath, verificationKeyPath, proofHandler);
}
