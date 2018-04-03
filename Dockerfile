FROM node:9

ARG buildno
ARG commitsha

LABEL maintainer="hello@dougley.com" \
      repository="https://github.com/TheSharks/WildBeast" \
      buildno=$buildno \
      commit=$commitsha

# Don't run wildbeast as root (safety)
RUN useradd -m -d /home/wildbeast -s /bin/bash wildbeast
RUN mkdir /opt/wildbeast && chown wildbeast /opt/wildbeast -R
USER wildbeast

WORKDIR /opt/wildbeast

# Copy app
COPY package.json /opt/wildbeast/
COPY . /opt/wildbeast

RUN npm i --production

CMD ["node", "index.js"]