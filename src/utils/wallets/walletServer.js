const Fastify = require('fastify');
const { Mutex } = require('async-mutex');
const { createAndFundLocalTestWallets, localWalletData } = require('./localWallets');

const fastify = Fastify();
const wallets = new Map();
const requestQueue = [];
const mutex = new Mutex();

async function initializeWallets() {
    if (process.env.LOCAL_NODE === 'true') {
        console.log("Generating and funding local test wallets...");
        await createAndFundLocalTestWallets();
        console.log("Local wallets created successfully:", localWalletData.seedPhrases);

        localWalletData.seedPhrases.forEach((seed, index) => {
            const key = `SEED_PHRASE_${index + 1}`;
            wallets.set(key, seed);
        });
    } else {
        console.log("Loading wallets from environment variables...");
        Object.entries(process.env)
            .filter(([key]) => key.startsWith('SEED_PHRASE'))
            .forEach(([key, seed]) => wallets.set(key, seed));
    }
}

fastify.get('/wallet', async (request, reply) => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const index = requestQueue.indexOf(resolve);
            if (index !== -1) requestQueue.splice(index, 1);
            reply.code(408).send({ error: "Wallet request timed out" });
            reject(new Error("Wallet request timed out"));
        }, 120000);

        mutex.runExclusive(async () => {
            if (wallets.size > 0) {
                const [key, wallet] = wallets.entries().next().value;
                wallets.delete(key);
                clearTimeout(timeout);
                return resolve(reply.send({ key, wallet }));
            } else {
                requestQueue.push(resolve);
            }
        });
    });
});

fastify.post('/release', async (request, reply) => {
    const { key } = request.body;
    if (!key) {
        return reply.code(400).send({ error: "Invalid request, missing key" });
    }

    await mutex.runExclusive(() => {
        if (requestQueue.length > 0) {
            const resolve = requestQueue.shift();
            if (resolve) {
                return resolve({ key, wallet: wallets.get(key) });
            }
        }
        wallets.set(key, process.env[key] || localWalletData.seedPhrases[parseInt(key.replace("SEED_PHRASE_", ""), 10) - 1]);
    });

    reply.send({ success: true });
});

initializeWallets().then(() => {
    fastify.listen({ port: 3001 }, () => console.log("Wallet API running on port 3001"));
}).catch((error) => {
    console.error("Failed to initialize wallets:", error);
    process.exit(1);
});
