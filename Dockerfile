FROM node:current

ARG buildno
ARG commitsha

LABEL maintainer="Remco Jongschaap <hey@dougley.com>" \
      repository="https://github.com/TheSharks/WildBeast"

RUN mkdir /opt/wildbeast
# Copy files and install modules
COPY . /opt/wildbeast
WORKDIR /opt/wildbeast
RUN npm ci --production
# Install optional native modules
# TODO: swap out UWS whenever a better module is available
RUN npm i zlib-sync uws@10.148.1 https://github.com/discordapp/erlpack.git bufferutil pg
CMD ["node", "index.js"]
