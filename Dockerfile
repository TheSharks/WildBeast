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
RUN npm i zlib-sync@0.1 abalabahaha/erlpack bufferutil pg
CMD ["node", "index.js"]
