FROM node:22-alpine AS validation

WORKDIR /src

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run validate:ci

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=validation /src/index.js ./

EXPOSE 8080

USER node

CMD ["npm", "start"]
