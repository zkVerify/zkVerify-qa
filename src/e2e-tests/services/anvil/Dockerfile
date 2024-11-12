ARG FOUNDRY_VERSION=nightly-471e4ac317858b3419faaee58ade30c0671021e0
FROM ghcr.io/foundry-rs/foundry:${FOUNDRY_VERSION}

# Set working directory
WORKDIR /anvil

# Install required packages
RUN apk --no-cache add curl jq

# Copy entrypoint script and contracts
COPY ./anvil/entrypoint.sh /anvil/entrypoint.sh
COPY ./zkv-attestation-contracts/contracts /anvil/contracts

# Make entrypoint script executable
RUN chmod +x /anvil/entrypoint.sh

# Define entrypoint
ENTRYPOINT ["/bin/sh", "/anvil/entrypoint.sh"]
