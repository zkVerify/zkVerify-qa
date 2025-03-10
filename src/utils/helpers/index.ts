import 'dotenv/config';

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
            throw new Error(`The ${envVar} environment variable has not been set.`);
        }
    });
};
