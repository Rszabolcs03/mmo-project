FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --omit=optional

COPY server ./server

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start"]
