FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start"]
