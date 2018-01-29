FROM node:9
MAINTAINER hello@dougley.com

WORKDIR /app

CMD ["node", "index.js"]

COPY package.json /app/

# Create working dir
RUN mkdir -p /app
COPY . /app

RUN npm i
