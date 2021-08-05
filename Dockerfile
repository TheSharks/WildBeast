FROM node:lts-alpine

WORKDIR /usr/wildbeast

COPY tsconfig.json ./
COPY package*.json ./

RUN npm install

COPY src ./src

RUN npm run compile
RUN npm prune --production

CMD ["npm", "start"]