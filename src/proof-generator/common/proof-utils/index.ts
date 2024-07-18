import path from 'path';

export async function getProofUtils(proofType: string) {
    const utilsPath = path.join(__dirname, '../..', proofType, 'utils');
    const { formatProof, formatVk } = await import(utilsPath);
    return { formatProof, formatVk };
}
