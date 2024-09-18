require('dotenv').config();
const Web3 = require('web3').default;
const ETH_PROVIDER_URL = process.env.ANVIL;

if (!process.env.ZKV_CONTRACT) {
    throw new Error('Required environment variable ZKV_CONTRACT is not set.');
}

if (!ETH_PROVIDER_URL) {
    throw new Error('Required environment variable ANVIL is not set.');
}

console.log("Connecting to Ethereum provider:", ETH_PROVIDER_URL);

const provider = new Web3.providers.HttpProvider(ETH_PROVIDER_URL);
const web3 = new Web3(provider);

const contractABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "latestAttestationId",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

const contractAddress = process.env.ZKV_CONTRACT;
const contract = new web3.eth.Contract(contractABI, contractAddress);

async function getLatestAttestationId() {
    try {
        const latestId = await contract.methods.latestAttestationId().call();
        console.log("Latest Attestation ID:", latestId.toString());
    } catch (error) {
        console.error("Error fetching the latest attestation ID:", error);
    }
}

getLatestAttestationId();
