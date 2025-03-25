const axios = require('axios');
const { spawn } = require('child_process');
require('dotenv').config();

jest.setTimeout(60000);

const WALLET_SERVER_URL = 'http://localhost:3001';
let walletServerProcess;

beforeAll(async () => {
    console.log("Starting wallet server...");
    walletServerProcess = spawn('node', ['walletServer.js'], { stdio: 'inherit' });

    await new Promise(resolve => setTimeout(resolve, 3000));
});

afterAll(() => {
    console.log("Stopping wallet server...");
    if (walletServerProcess) {
        walletServerProcess.kill();
    }
});

async function requestWallet() {
    try {
        let response = await axios.get(`${WALLET_SERVER_URL}/wallet`);
        while (!response.data.available) {
            await new Promise(resolve => setTimeout(resolve, 500));
            response = await axios.get(`${WALLET_SERVER_URL}/wallet`);
        }
        console.log(`Acquired wallet: ${response.data.key}`);
        return response.data.key;
    } catch (error) {
        console.error("Failed to acquire wallet:", error.response?.data || error.message);
        return null;
    }
}

async function releaseWallet(key) {
    try {
        await axios.post(`${WALLET_SERVER_URL}/release`, { key });
        console.log(`Released wallet: ${key}`);
    } catch (error) {
        console.error("Failed to release wallet:", error.response?.data || error.message);
    }
}

test.skip('Wallet server correctly queues requests and resumes them after releases', async () => {
    console.log("Initiating 13 parallel wallet requests...");

    let completedRequests = [];

    const requestPromises = Array.from({ length: 13 }, async (_, i) => {
        const walletKey = await requestWallet();

        if (walletKey) {
            console.log(`Wallet ${walletKey} acquired. Simulating work...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`Releasing wallet ${walletKey} after work`);
            await releaseWallet(walletKey);
            completedRequests.push(walletKey);
        }
    });

    await Promise.allSettled(requestPromises);

    console.log("Waiting for queued requests to be served after releases...");
    await new Promise(resolve => setTimeout(resolve, 6000));

    expect(completedRequests.length).toBe(13);
});