FROM node:lts-alpine

WORKDIR /usr/wildbeast

COPY tsconfig.json ./
COPY package*.json ./

COPY src ./src

RUN npm install
RUN npm run compile
RUN npm prune --production

CMD ["npm", "start"]