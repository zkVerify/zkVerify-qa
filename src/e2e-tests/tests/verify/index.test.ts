import { proofTypes, curveTypes, libraries } from '../../../tests/common/utils';
import { runAllProofTests, runAllVKRegistrationTests } from '../../../tests';

jest.setTimeout(500000);

describe('zkVerify proof user journey tests', () => {
    test('should verify all proof types and respond on finalization without waiting for Attestation event', async () => {
        console.log("Verify Test 1: RUNNING 'should verify all proof types and respond on finalization without waiting for Attestation event'");
        await runAllProofTests(proofTypes, curveTypes, libraries, false);
        console.log("Verify Test 1: COMPLETED");
    });

    test('should verify all proof types, wait for Attestation event, and then check proof of existence', async () => {
        console.log("Verify Test 2: Running 'should verify all proof types, wait for Attestation event, and then check proof of existence");
        await runAllProofTests(proofTypes, curveTypes, libraries,true);
        console.log("Verify Test 2: COMPLETED");
    });

    test.skip('should register VK and verify the proof using the VK hash for all proof types', async () => {
        await runAllVKRegistrationTests(proofTypes, curveTypes, libraries);
    });
});
