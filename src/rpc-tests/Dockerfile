FROM node:16-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json from the root level
COPY ../../package*.json ./

RUN npm install

# Copy the src directory and its contents
COPY ../../src .

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$TEST_ENV\" = 'local' ]; then npm run test:rpc:local; else npm run test:rpc:testnet; fi"]
