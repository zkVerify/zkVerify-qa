require('dotenv').config();
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

const proofs = {
   fflonk: { pallet: 'settlementFFlonkPallet' },
   boojum: { pallet: 'settlementZksyncPallet' }
};

const requiredEnvVariables = ['WEBSOCKET', 'PRIVATE_KEY'];
requiredEnvVariables.forEach((envVar) => {
   if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set.`);
   }
});

const proofType = process.argv[2];
const proof = process.argv[3];

if (!proofType || !proof) {
   throw new Error('Please provide both proof type and proof as command line arguments.');
}

if (!proofs[proofType]) {
   throw new Error('Invalid proof type. Valid proof types are: fflonk, boojum.');
}

(async () => {
   let api;
   let provider;
   let interval;
   let startTime = Date.now();

   try {
      provider = new WsProvider(process.env.WEBSOCKET);
      api = await createApi(provider);

      const keyring = new Keyring({ type: 'sr25519' });
      const account = keyring.addFromUri(process.env.PRIVATE_KEY);

      console.log(`Submitting ${proofType} proof...`);
      const submitProof = api.tx[proofs[proofType].pallet].submitProof(proof);

      let proof_leaf = null;
      let attestation_id = null;

      await new Promise((resolve, reject) => {
         submitProof.signAndSend(account, async ({ events, status, dispatchError }) => {
            let elapsed = (Date.now() - startTime) / 1000;

            if (status.isInBlock) {
               console.log(`Transaction included in block (elapsed time: ${elapsed} seconds)`);
               handleEvents(events, (data) => {
                  proof_leaf = data[0].toString();
                  attestation_id = data[1].toString();
                  console.log(`Proof Verified:\n  - Attestation Id: ${attestation_id}\n  - Proof Leaf: ${proof_leaf}`);
               });

               if (dispatchError) {
                  console.error(`Invalid ${proofType} transaction:`, dispatchError.toString());
                  reject(dispatchError);
               } else {
                  resolve();
               }

               interval = setInterval(() => {
                  let elapsed = (Date.now() - startTime) / 1000;
                  console.log(`Waiting for ${proofType} transaction to finalize... (elapsed time: ${elapsed} seconds)`);
               }, 5000);
            }

            if (status.isFinalized) {
               clearInterval(interval);
               console.log(`Block containing ${proofType} proof transaction finalized (elapsed time: ${elapsed} seconds)`);
            }
         });
      });

      await waitForAttestationId(attestation_id);

      console.log(`Waiting for NewAttestation event...`);
      await waitForNewAttestation(api, 360000, attestation_id, startTime);
   } catch (error) {
      handleError(error);
      if (provider) provider.disconnect();
   } finally {
      if (api) await api.disconnect();
   }
})();

async function createApi(provider) {
   const timeout = new Promise((_, reject) =>
           setTimeout(() => reject(new Error('Failed to connect to the WebSocket URL.')), 3000)
   );
   return await Promise.race([ApiPromise.create({ provider }), timeout]);
}

function handleEvents(events, callback) {
   events.forEach(({ event: { data, method, section } }) => {
      if (section === 'poe' && method === 'NewElement') {
         callback(data);
      }
   });
}

async function waitForAttestationId(attestation_id) {
   while (!attestation_id) {
      console.log("Waiting for attestation_id to be set...");
      await new Promise(resolve => setTimeout(resolve, 1000));
   }
}

async function waitForNewAttestation(api, timeoutDuration, attestation_id, startTime) {
   return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
         unsubscribe();
         reject("Timeout expired");
      }, timeoutDuration);

      const interval = setInterval(() => {
         let elapsed = (Date.now() - startTime) / 1000;
         console.log(`Waiting for NewAttestation event... (elapsed time: ${elapsed} seconds)`);
      }, 15000);

      const unsubscribe = await api.query.system.events((events) => {
         events.forEach((record) => {
            const { event } = record;
            const types = event.typeDef;

            if (event.section === "poe" && event.method === "NewAttestation") {
               const currentAttestationId = event.data[0].toString();
               console.log(`Detected NewAttestation event with id: ${currentAttestationId}`);
               if (currentAttestationId === attestation_id) {
                  clearTimeout(timeout);
                  clearInterval(interval);
                  unsubscribe();
                  console.log(`Matched NewAttestation event with ProofVerified event Attestation Id ${attestation_id}:`);
                  event.data.forEach((data, index) => {
                     console.log(`\t${types[index].type}: ${data.toString()}`);
                  });
                  resolve(event.data);
               }
            }
         });
      });
   });
}

function handleError(error) {
   if (error.message.includes('Invalid bip39 mnemonic specified')) {
      console.error('Failed to create account from the provided PRIVATE_KEY. Please check the PRIVATE_KEY environment variable.');
   } else {
      console.error(`An error occurred: ${error.message}`);
   }
}