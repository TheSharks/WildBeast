FROM node:9

ARG buildno
ARG commitsha

LABEL maintainer="hello@dougley.com" \
      repository="https://github.com/TheSharks/WildBeast" \
      buildno=$buildno \
      commit=$commitsha

WORKDIR /app

CMD ["node", "index.js"]

COPY package.json /app/

# Create working dir
RUN mkdir -p /app
COPY . /app

RUN npm i
