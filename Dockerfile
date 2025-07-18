FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p /usr/src/app/uploads

EXPOSE 5000

CMD ["node", "server.js"]