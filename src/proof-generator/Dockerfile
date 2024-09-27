FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY .env.generator ./

COPY src/utils ./src/utils

COPY src/config.ts ./src/config.ts 

COPY src/proof-generator ./src/proof-generator

ENV INTERVAL=5
ENV DURATION=60

CMD ["npm", "run", "generate:proofs"]
