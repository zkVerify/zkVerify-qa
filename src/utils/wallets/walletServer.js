const Fastify = require('fastify');
const { Mutex } = require('async-mutex');
const { createAndFundLocalTestWallets, localWalletData } = require('./localWallets');
require('dotenv').config();

const fastify = Fastify();
const availableWallets = new Map();
const inUseWallets = new Map();
const requestQueue = [];
const mutex = new Mutex();

async function initializeWallets() {
    try {
        if (process.env.LOCAL_NODE === 'true') {
            await createAndFundLocalTestWallets();
            localWalletData.seedPhrases.forEach((seed, index) => {
                const key = `SEED_PHRASE_${index + 1}`;
                availableWallets.set(key, seed);
            });
        } else {
            Object.entries(process.env)
                .filter(([key]) => key.startsWith('SEED_PHRASE'))
                .forEach(([key, seed]) => availableWallets.set(key, seed));
        }
    } catch (error) {
        console.error("Failed to initialize wallets:", error);
        process.exit(1);
    }
}

fastify.get('/wallet', async (request, reply) => {
    return mutex.runExclusive(async () => {
        if (availableWallets.size > 0) {
            const [key, wallet] = availableWallets.entries().next().value;
            availableWallets.delete(key);
            inUseWallets.set(key, wallet);
            return { key, wallet, available: true };
        }
        requestQueue.push(request.id);
        return { available: false, queuePosition: requestQueue.indexOf(request.id) };
    }).then(result => reply.send(result));
});

fastify.post('/release', async (request, reply) => {
    const { key } = request.body;
    if (!key || !inUseWallets.has(key)) {
        return reply.code(400).send({ error: "Invalid request or wallet not in use" });
    }

    await mutex.runExclusive(async () => {
        const wallet = inUseWallets.get(key);
        inUseWallets.delete(key);

        function addWallet(){
            availableWallets.set(key, wallet);
            if(requestQueue.length > 0){
                requestQueue.shift();
            }
        }
        setTimeout(addWallet, 0);

        reply.send({ success: true });
    });
});

initializeWallets().then(() => {
    fastify.listen({ port: 3001 }, () => {});
}).catch((error) => {
    console.error("Failed to initialize wallets:", error);
    process.exit(1);
});