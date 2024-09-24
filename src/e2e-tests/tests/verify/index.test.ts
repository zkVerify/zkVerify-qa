import { runProofWithoutAttestation, runProofWithAttestation, runVKRegistrationTests } from '../../../tests';
import { fundLocalE2eTestWallets } from '../../../utils/helpers';

jest.setTimeout(300000);

beforeAll(async () => {
    const fundingSuccess = await fundLocalE2eTestWallets();
    if (!fundingSuccess) {
        throw new Error('Funding failed. Cannot proceed with tests.');
    }
});

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

