# Production static build for the SPA (served by nginx in the final stage).
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY docker/ ./docker/

ARG NPM_STRICT_SSL=1
RUN --mount=type=cache,target=/root/.npm \
    if [ -f ./docker/corporate-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/app/docker/corporate-ca.pem; fi; \
    if [ "$NPM_STRICT_SSL" = "0" ]; then export NPM_CONFIG_STRICT_SSL=false; fi; \
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY packages/types ./packages/types
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Browser must reach the API on the host (Compose publishes api:4000).
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Microsoft 365 (MSAL) app IDs: loaded at runtime from the API, not from this build.

RUN npm run build -w @office/types && npm run build -w @office/web

FROM nginx:1.27-alpine
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
