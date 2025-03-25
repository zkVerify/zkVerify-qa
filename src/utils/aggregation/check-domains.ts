import { ApiPromise, WsProvider } from '@polkadot/api';

interface DomainData {
    id: string;
    shouldPublish?: Record<string, unknown>;
    next?: { id: string };
    maxAggregationSize?: string;
}


export async function checkDomain(wsProviderUrl: string, domainIdToCheck: number, nextIdToMatch?: number): Promise<number> {
    const wsProvider = new WsProvider(wsProviderUrl);
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("\n🔍 Checking storage entries in pallet 'aggregate':");

    if (!(api.query.aggregate && api.query.aggregate.domains)) {
        throw new Error("'domains' storage entry not found in aggregate pallet.");
    }

    console.log("\nFetching available keys for 'domains' storage...");
    
    // Get all stored keys
    const keys = await api.query.aggregate.domains.keys();
    
    if (keys.length === 0) {
        throw new Error("No entries found in 'domains' storage.");
    }

    console.log(`Found ${keys.length} keys. Checking conditions...`);

    for (const key of keys) {
        const domainData = await api.query.aggregate.domains(key.args[0]);
        const humanData = domainData.toHuman() as unknown as DomainData;

        if (!humanData.id) {
            throw new Error("Invalid data structure: missing 'id' field.");
        }

        if (humanData.id !== String(domainIdToCheck)) {
            continue;
        }

        const shouldPublish = humanData.shouldPublish || {};
        const next = humanData.next || { id: "" };
        const nextId = next.id;

        if (Object.keys(shouldPublish).length !== 0) {
            throw new Error(`Domain ID ${domainIdToCheck} has non-empty shouldPublish.`);
        }
        
        if (typeof nextIdToMatch !== 'undefined') {
            if (nextId !== String(nextIdToMatch)) {
                throw new Error(`Domain ID ${domainIdToCheck} has next.id ${nextId}, expected ${nextIdToMatch}.`);
            }
        }

        console.log(`Validation passed for domainId: ${domainIdToCheck}`);
        return Number(nextId);
    }

    throw new Error(`Domain ID ${domainIdToCheck} not found.`);
}

export async function checkMultipleDomains(wsProviderUrl: string, domainIdsToCheck: number[]): Promise<void> {
    if (domainIdsToCheck.length === 0) {
        throw new Error("No domain IDs provided.");
    }

    const wsProvider = new WsProvider(wsProviderUrl);
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("\n🔍 Checking storage entries in pallet 'aggregate':");

    if (!(api.query.aggregate && api.query.aggregate.domains)) {
        throw new Error("'domains' storage entry not found in aggregate pallet.");
    }

    console.log("\nFetching available keys for 'domains' storage...");
    
    // Get all stored keys
    const keys = await api.query.aggregate.domains.keys();
    
    if (keys.length === 0) {
        throw new Error("No entries found in 'domains' storage.");
    }

    console.log(`Found ${keys.length} keys. Checking conditions...`);

    const foundDomainIds = new Set<string>();

    for (const key of keys) {
        const domainData = await api.query.aggregate.domains(key.args[0]);
        const humanData = domainData.toHuman() as unknown as DomainData;

        if (!humanData.id) {
            throw new Error("Invalid data structure: missing 'id' field.");
        }

        foundDomainIds.add(humanData.id);
    }

    for (const domainId of domainIdsToCheck) {
        if (!foundDomainIds.has(String(domainId))) {
            throw new Error(`Domain ID ${domainId} not found in storage.`);
        }
    }

    console.log("All domain IDs are present in storage.");
}

export async function getMaxAggregationSize(wsProviderUrl: string, domainId: number): Promise<number> {
    const wsProvider = new WsProvider(wsProviderUrl);
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log(`\nFetching maxAggregationSize for domain ID ${domainId}...`);

    if (!(api.query.aggregate && api.query.aggregate.domains)) {
        throw new Error("'domains' storage entry not found in aggregate pallet.");
    }

    // Fetch domain data
    const domainData = await api.query.aggregate.domains(domainId);
    const humanData = domainData.toHuman() as unknown as DomainData;

    if (!humanData || humanData.id !== String(domainId)) {
        throw new Error(`Domain ID ${domainId} not found in storage.`);
    }

    if (!humanData.maxAggregationSize) {
        throw new Error(`maxAggregationSize not found for domain ID ${domainId}.`);
    }

    console.log(`maxAggregationSize for domain ID ${domainId}: ${humanData.maxAggregationSize}`);

    return Number(humanData.maxAggregationSize);
}