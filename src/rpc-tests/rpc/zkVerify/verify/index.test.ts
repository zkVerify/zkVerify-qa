import { runProofWithoutAttestation, runProofWithAttestation, runVKRegistrationTests } from '../../../../tests';

jest.setTimeout(300000);

describe('zkVerify proof journey tests', () => {
    test('should verify all proofs without waiting for a published attestation', async () => {
        await runProofWithoutAttestation(process.env.PARALLEL === 'true');
    });

    test('should verify all proofs, called poe pallet and wait for published attestation', async () => {
        await runProofWithAttestation(process.env.PARALLEL === 'true');
    });

    test('should register VK and verify a proof using the VK hash', async () => {
        await runVKRegistrationTests(process.env.PARALLEL === 'true');
    });
});
