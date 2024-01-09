FROM mcr.microsoft.com/devcontainers/javascript-node

# Install CLI tools for Redis and Postgres
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y install --no-install-recommends redis-tools postgresql-client