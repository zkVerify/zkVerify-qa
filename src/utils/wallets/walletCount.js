const { ProofType, Library, CurveType, Risc0Version } = require("zkverifyjs");

/**
 * Determines the number of wallets required based on zkverifyjs proof configurations.
 * @returns {number} Number of wallets needed.
 */
function calculateWalletCountFromProofConfigurations() {
    let walletCount = 0;

    const proofTypes = Object.values(ProofType);
    walletCount += proofTypes.length;

    console.log(`Base wallets (one per proof type): ${proofTypes.length}`);

    let extraGroth16Wallets = 0;
    let extraRisc0Wallets = 0;

    if (ProofType.groth16) {
        const availableLibraries = Object.values(Library);
        const availableCurves = Object.values(CurveType);
        const totalCombinations = availableLibraries.length * availableCurves.length;
        extraGroth16Wallets = Math.max(0, totalCombinations - 1);
        walletCount += extraGroth16Wallets;
        console.log(`Extra wallets for Groth16: ${extraGroth16Wallets} (${totalCombinations} total - 1 base)`);
    }

    if (ProofType.risc0) {
        const availableVersions = Object.values(Risc0Version);
        extraRisc0Wallets = Math.max(0, availableVersions.length - 1);
        walletCount += extraRisc0Wallets;
        console.log(`Extra wallets for Risc0: ${extraRisc0Wallets} (${availableVersions.length} total - 1 base)`);
    }

    console.log(`Total calculated wallets: ${walletCount}`);
    return walletCount;
}

module.exports = { calculateWalletCountFromProofConfigurations };
