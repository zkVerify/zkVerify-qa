## Performance Tests

These tests use the `artillery` npm package.  More details can be found here:

https://www.artillery.io/docs

## Pre-Requisites

### Install Packages

From top level `zkVerify-qa` directory:

```
npm install
```

## Configuration

Configuration for tests can be found in `src/performance/artillery-config.yml`

## Environment Variables

Copy `.env.performance` into a `.env` file and populate the values.

## Fund Test Accounts

- Note: pre-funded accounts for the stress test env can be found in confluence [HERE](https://horizenlabs.atlassian.net/wiki/spaces/QA/pages/908001281/zkVerify+Performance+Test+Data)
- If a regenesis has been performed since then, continue below and upload a new file to confluence.

Modify the values in `setup.ts` if needed, otherwise it will generate 10,000 accounts
with 10 tokens each from the `FUNDING_SEED_PHRASE` wallet:

```typescript
const TOTAL_ACCOUNTS = 10000;
const INTERMEDIARY_COUNT = 100;
const FUND_PER_ACCOUNT = 10;
const MAX_PARALLEL_TXS = 100;
```

Run the following command from the top level directory:

`npm run performance:fund-accounts`

Which will perform the following actions

- output a new json file in `src/performance/funded_accounts` with the format `funded_accounts_mm-dd-yyyy.json` 
- add address and mnemonic values for x number of accounts defined by `TOTAL_ACCOUNTS` value
- fund all accounts with `FUND_PER_ACCOUNT` number of tokens from the `FUNDING_SEED_PHRASE` wallet

## Run Tests

1. Edit the `artillery-config.yml` as required, each scenario is run sequentially - comment out if not needed.
2. Execute via package.json at the top level `zkVerify-qa`

```shell
npm run performance:test
```

3. Or execute from within the `src/performance` directory directly and specify a config file to use

```shell
npx artillery run src/performance/artillery-config.yml
```

## Metrics

`/metrics` - this endpoint can be called to retrieve metrics if exposed publicly.
`Prometheus` - https://metrics.horizenlabs.io/prometheus/targets at the bottom are the zkVerify instances.

You can filter/query for them in Grafana https://metrics.horizenlabs.io/grafana which requires a GH Login.