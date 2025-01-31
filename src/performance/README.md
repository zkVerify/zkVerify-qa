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

Copy `.env.performance` into a `.env` file and provide seed phrases for all proof types.

## Run Tests

1. Execute via package.json at the top level `zkVerify-qa`

```shell
npm run performance:test
```

2. Or execute from within the `src/performance` directory directly and specify a config file to use

```shell
npx artillery run src/performance/artillery-config.yml
```