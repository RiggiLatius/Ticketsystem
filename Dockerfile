# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=deps /app/backend/node_modules /app/backend/node_modules
COPY backend /app/backend
COPY frontend /app/frontend

RUN mkdir -p /app/backend/data/uploads && chown -R app:app /app/backend/data
USER app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "backend/src/server.js"]
