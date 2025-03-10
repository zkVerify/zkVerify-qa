FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY .env.local.rpc ./
COPY .env.testnet.rpc ./
COPY jest.config.local.rpc.js ./
COPY jest.config.testnet.rpc.js ./
COPY tsconfig.json ./
COPY jest.setup.js ./
COPY jest.teardown.js ./
COPY zkverifyjs-0.7.0.tgz ./

RUN npm install

COPY src/rpc-tests ./src/rpc-tests
COPY src/utils ./src/utils
COPY src/tests ./src/tests

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$TEST_ENV\" = 'local' ]; then npm run test:rpc:local; else npm run test:rpc:testnet; fi"]
