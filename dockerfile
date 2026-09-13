FROM node:24.15.0-slim

WORKDIR /app

COPY package.json ./

COPY package-lock.json ./

RUN npm install

COPY app/ ./app/

EXPOSE 3000

CMD ["node", "app/app.js"]