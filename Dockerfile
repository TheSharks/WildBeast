FROM node:lts-alpine

WORKDIR /usr/wildbeast

COPY tsconfig.json ./
COPY package*.json ./
COPY src ./src

ENV GIT_COMMIT $(git rev-parse HEAD)

RUN npm install
RUN npm prune --production

CMD ["npm", "start"]
