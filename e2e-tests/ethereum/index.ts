import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

const ETH_PROVIDER_URL = process.env.ANVIL as string;
const CONTRACT_ADDRESS = process.env.ZKV_CONTRACT as string;

const web3 = new Web3(new Web3.providers.HttpProvider(ETH_PROVIDER_URL));

const simpleAbi: AbiItem[] = [
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

const contract = new web3.eth.Contract(simpleAbi, CONTRACT_ADDRESS);

export async function getLatestAttestationId(): Promise<number> {
    const latestAttestationId = await contract.methods.latestAttestationId().call();
    return parseInt(latestAttestationId, 10);
}

export async function pollLatestAttestationId(expectedId: number, timeout: number = 60000, interval: number = 3000): Promise<boolean> {
    const endTime = Date.now() + timeout;

    while (Date.now() < endTime) {
        const latestAttestationId = await getLatestAttestationId();
        if (latestAttestationId === expectedId) {
            console.log(`Expected attestation ID ${expectedId} found on Ethereum zkVerify contract.`);
            return true;
        }
        const elapsed = (timeout - (endTime - Date.now())) / 1000;
        console.log(`Polling Ethereum zkVerify contract for attestation ID... elapsed time: ${elapsed.toFixed(2)} seconds`);
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.log(`Timeout reached while polling Ethereum zkVerify contract for attestation ID ${expectedId}.`);
    return false;
}
