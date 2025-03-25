import { executeRegisterDomain } from '../../utils/aggregation/register-domains';
import { checkDomain, checkMultipleDomains, getMaxAggregationSize } from '../../utils/aggregation/check-domains';
import { generateAndVerifyProofs } from '../../utils/aggregation/send-multiple-proofs';
import { setTimeout } from 'timers/promises';

jest.setTimeout(300000);

const wsProviderUrl = 'ws://127.0.0.1:9944';
const signingUser = '//Alice';

const proofType = 'fflonk';

const firstDomainId = 0;
const secondDomainId = 1;

let aggregationSize = 2;
let queueSize = 10;
let numberOfAggregations = 2;

describe('zkVerify proof aggregation tests', () => {
    test('check the proofs are correctly aggregated by the aggregator application', async () => {

        const domainIds = [0, 1];

        try {
            await checkMultipleDomains(wsProviderUrl, domainIds);
            console.log("All domains are already present. Proceeding...");
        } catch {
            console.log("Domain check failed. Register the domain IDs...");
            await executeRegisterDomain(wsProviderUrl, signingUser, aggregationSize, queueSize, numberOfAggregations);
        }

        let nextIdFirstDomain = await checkDomain(wsProviderUrl, firstDomainId);
        let nextIdSecondDomain = await checkDomain(wsProviderUrl, secondDomainId);

        let maxAggregationSizeFirstDomain = await getMaxAggregationSize(wsProviderUrl, firstDomainId);
        await generateAndVerifyProofs(wsProviderUrl, signingUser, proofType, maxAggregationSizeFirstDomain, firstDomainId)
            .then(() => console.log('Proof generation and verification completed.'))
            .catch(error => console.error('Error:', error));

        let maxAggregationSizeSecondDomain = await getMaxAggregationSize(wsProviderUrl, secondDomainId);
        await generateAndVerifyProofs(wsProviderUrl, signingUser, proofType, maxAggregationSizeSecondDomain, secondDomainId)
            .then(() => console.log('Proof generation and verification completed.'))
            .catch(error => console.error('Error:', error));

        await setTimeout(10000);

        await checkDomain(wsProviderUrl, firstDomainId, nextIdFirstDomain+1);
        await checkDomain(wsProviderUrl, secondDomainId, nextIdSecondDomain+1);

    });

    
});
