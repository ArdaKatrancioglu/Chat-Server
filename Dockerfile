FROM node:22-slim

WORKDIR /app

COPY package.json ./

RUN apt-get update -y && apt-get install -y openssl

RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN npm run build
RUN npm run db:generate

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
