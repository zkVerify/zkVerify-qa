import 'dotenv/config';
import { ProofType } from "zkverifyjs";

/**
 * Validate required environment variables.
 *
 * @param {string[]} variables - List of environment variable names to validate.
 * @throws {Error} If any of the required environment variables is not set.
 */
export const validateEnvVariables = (variables: string[]): void => {
    variables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set.`);
        }
        if (envVar.includes('SEED_PHRASE') && process.env[envVar] === 'INSERT_SEED_PHRASE') {
            throw new Error('The SEED_PHRASE environment variable has not been set.');
        }
    });
};

export const selectVerifyMethod = (session: any, proofType: string): any => {
    switch (proofType) {
        case ProofType.groth16:
            return session.verify().groth16();
        case ProofType.fflonk:
            return session.verify().fflonk();
        case ProofType.risc0:
            return session.verify().risc0();
        case ProofType.ultraplonk:
            return session.verify().ultraplonk();
        default:
            throw new Error('Invalid proof type selected');
    }
};