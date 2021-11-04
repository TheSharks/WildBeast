FROM node:lts-alpine
ARG COMMIT

WORKDIR /usr/wildbeast

COPY tsconfig.json ./
COPY package*.json ./
COPY src ./src

ENV GIT_COMMIT ${COMMIT}

RUN npm install
RUN npm prune --production

CMD ["npm", "start"]
