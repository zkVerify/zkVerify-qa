import 'dotenv/config';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { Keyring } from '@polkadot/keyring';
import { proofs } from '../proofs';
import { createApi, waitForNodeToSync } from '../helpers';
import { handleTransaction } from '../transactions';

/**
 * Validates required environment variables.
 * @param variables - An array of required environment variable names.
 */
const validateEnvVariables = (variables: string[]): void => {
   variables.forEach(envVar => {
      if (!process.env[envVar]) {
         throw new Error(`Required environment variable ${envVar} is not set.`);
      }
   });
};

/**
 * Submits a proof to the blockchain.
 * @param api - The ApiPromise instance.
 * @param pallet - The pallet to which the proof is submitted.
 * @param params - The parameters for the proof submission.
 * @returns The transaction object.
 */
const submitProof = (api: ApiPromise, pallet: string, params: any[]): SubmittableExtrinsic<"promise"> => {
   return api.tx[pallet].submitProof(...params);
};

/**
 * Main function to execute the proof submission.
 */
const main = async (): Promise<void> => {
   validateEnvVariables(['WEBSOCKET', 'PRIVATE_KEY']);

   const provider = new WsProvider(process.env.WEBSOCKET as string);
   const api = await createApi(provider);
   await waitForNodeToSync(api);

   const timerRefs = { interval: null as NodeJS.Timeout | null, timeout: null as NodeJS.Timeout | null };
   const keyring = new Keyring({ type: 'sr25519' });
   const account = keyring.addFromUri(process.env.PRIVATE_KEY as string);

   const proofType = process.argv[2];
   if (!proofType || !proofs[proofType]) {
      throw new Error(`Proof type ${proofType} is not valid or not provided.`);
   }

   const { pallet, getParams } = proofs[proofType];
   const params = getParams(true);

   console.log(`Submitting ${proofType} proof...`);
   const transaction = submitProof(api, pallet, params);
   const startTime = Date.now();

   try {
      const { result, attestationId } = await handleTransaction(api, transaction, account, proofType, startTime, false, timerRefs);
      console.log(`Transaction result: ${result}`);
      if (attestationId) {
         console.log(`Attestation ID: ${attestationId}`);
      }
   } catch (error) {
      console.error(`Error sending ${proofType} proof:`, error);
   } finally {
      await api.disconnect();
      await provider.disconnect();
   }
};

main().catch(error => {
   console.error('Unhandled error in main function:', error);
   process.exit(1);
});
