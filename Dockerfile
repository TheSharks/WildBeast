FROM node:9

ARG buildno
ARG commitsha

LABEL maintainer="Remco Jongschaap hello@dougley.com" \
      repository="https://github.com/TheSharks/WildBeast" \
      buildno=$buildno \
      commit=$commitsha

# Don't run wildbeast as root (safety)
RUN useradd -m -d /home/wildbeast -s /bin/bash wildbeast
RUN mkdir /opt/wildbeast && chown wildbeast /opt/wildbeast -R
# Copy files and install modules
COPY . /opt/wildbeast
WORKDIR /opt/wildbeast
RUN npm i --production
# Install optional native modules
RUN npm i zlib-sync uws https://github.com/discordapp/erlpack.git bufferutil sodium-native node-opus

# Switch to wildbeast user and run entrypoint
USER wildbeast
CMD ["node", "index.js"]
