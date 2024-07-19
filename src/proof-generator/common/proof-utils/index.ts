import path from 'path';

/**
 * Dynamically loads and returns the proof handler for the specified proof type.
 *
 * @param {string} proofType - The type of the proof for which to load the handler.
 * @returns {Promise<any>} - A promise that resolves to the proof handler.
 * @throws {Error} - Throws an error if the proof handler cannot be loaded.
 */
export async function getProofHandler(proofType: string): Promise<any> {
    try {
        const handlerPath = path.join(__dirname, '../..', proofType, 'handler');
        const handler = await import(handlerPath);
        return handler.default;
    } catch (error) {
        throw new Error(`Failed to load proof handler for type: ${proofType}`);
    }
}
