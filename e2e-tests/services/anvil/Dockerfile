FROM ghcr.io/foundry-rs/foundry

WORKDIR /anvil

RUN apk --no-cache add curl jq

COPY ./anvil/entrypoint.sh /anvil/entrypoint.sh
COPY ./nh-attestation-bot/contracts /anvil/contracts

RUN chmod +x /anvil/entrypoint.sh

ENTRYPOINT ["/bin/sh", "/anvil/entrypoint.sh"]
