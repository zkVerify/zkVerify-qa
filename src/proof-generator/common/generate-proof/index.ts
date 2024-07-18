import { ProofData } from "../../types";
import { formatScalar } from "../../utils";
import { getProofUtils } from "../proof-utils";
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

async function generateWitness(input: { a: string; b: string }, circuitWasm: string, witnessFile: string): Promise<void> {
    await snarkjs.wtns.calculate(input, circuitWasm, witnessFile);
    console.log("Witness generated and written to", witnessFile);

    if (!fs.existsSync(witnessFile)) {
        throw new Error(`Witness file not found at ${witnessFile}`);
    }
}

async function proveAndVerify(
    proofType: string,
    provingKey: string,
    witnessFile: string,
    verificationKeyPath: string,
    formatProof: (proof: any) => any,
    formatVk: (vkJson: any) => any
): Promise<ProofData<any>> {
    const { proof, publicSignals } = await snarkjs[proofType].prove(provingKey, witnessFile);
    const vkJson = JSON.parse(fs.readFileSync(verificationKeyPath, "utf8"));

    const proofData: ProofData<any> = {
        proof: {
            curve: "Bn254",
            proof: formatProof(proof),
        },
        publicSignals: publicSignals.map(formatScalar),
        vk: formatVk(vkJson),
    };

    const isValid = await snarkjs[proofType].verify(vkJson, publicSignals, proof);

    if (isValid) {
        console.log(`Generated a valid ${proofType} proof`);
    } else {
        throw new Error(`Generated ${proofType} proof is invalid`);
    }

    return proofData;
}

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

    fs.writeFileSync(path.join(__dirname, `../../${proofType}/circuit/input.json`), JSON.stringify(inputJson, null, 2));

    await generateWitness(inputJson, circuitWasm, witnessFile);

    const { formatProof, formatVk } = await getProofUtils(proofType);

    return proveAndVerify(proofType, provingKey, witnessFile, verificationKeyPath, formatProof, formatVk);
}
