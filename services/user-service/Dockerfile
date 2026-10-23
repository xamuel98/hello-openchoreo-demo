FROM node:22-alpine AS validation

WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=validation --chown=node:node /src/index.js ./
USER node
EXPOSE 8080
CMD ["npm", "start"]
