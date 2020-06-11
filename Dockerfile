FROM node:current

ARG buildno
ARG commitsha

LABEL maintainer="Remco Jongschaap <hello@dougley.com>" \
      repository="https://github.com/TheSharks/WildBeast"

# Don't run wildbeast as root (safety)
RUN useradd -m -d /home/wildbeast -s /bin/bash wildbeast
RUN mkdir /opt/wildbeast && chown wildbeast /opt/wildbeast -R
# Copy files and install modules
COPY . /opt/wildbeast
WORKDIR /opt/wildbeast
RUN npm i --production
# Install optional native modules
# TODO: swap out UWS whenever a better module is available
RUN npm i zlib-sync uws@10.148.1 https://github.com/discordapp/erlpack.git bufferutil
# Switch to wildbeast user and run entrypoint
# USER wildbeast
CMD ["node", "index.js"]
