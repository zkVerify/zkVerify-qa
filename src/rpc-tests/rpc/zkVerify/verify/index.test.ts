import { runProofWithoutAttestation, runProofWithAttestation, runVKRegistrationTests } from '../../../../tests';
import { setupLocalOrExistingWallets } from "../../../../utils/wallets";

jest.setTimeout(300000);

let isParallel: boolean;
let isLocalNode: boolean

beforeAll(async () => {
    await setupLocalOrExistingWallets();

    isParallel = process.env.PARALLEL?.toLowerCase() === 'true';
    isLocalNode = process.env.LOCAL_NODE?.toLowerCase() === 'true';
});

describe('zkVerify proof journey tests', () => {
    test('should verify all proofs without waiting for a published attestation', async () => {
        await runProofWithoutAttestation(isLocalNode, isParallel);
    });

    test('should verify all proofs, called poe pallet and wait for published attestation', async () => {
        await runProofWithAttestation(isLocalNode, isParallel);
    });

    test('should register VK and verify a proof using the VK hash', async () => {
        await runVKRegistrationTests(isLocalNode, isParallel);
    });
});
