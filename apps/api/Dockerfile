FROM node:22-alpine

# Prisma/OpenSSL on Alpine; libc6-compat avoids occasional musl/glibc edge issues.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY docker/ ./docker/

# Corporate TLS: optional PEM at docker/corporate-ca.pem, or NPM_STRICT_SSL=0 (dev only).
ARG NPM_STRICT_SSL=1
RUN --mount=type=cache,target=/root/.npm \
    if [ -f ./docker/corporate-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/app/docker/corporate-ca.pem; fi; \
    if [ "$NPM_STRICT_SSL" = "0" ]; then export NPM_CONFIG_STRICT_SSL=false; fi; \
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Prisma downloads engine binaries; apply same corporate TLS as npm ci.
RUN if [ -f ./docker/corporate-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/app/docker/corporate-ca.pem; fi; \
    if [ "$NPM_STRICT_SSL" = "0" ]; then export NODE_TLS_REJECT_UNAUTHORIZED=0; fi; \
    npm run build -w @office/types && \
    npm run prisma:generate -w @office/api && \
    npm run build -w @office/api

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npm run prisma:migrate -w @office/api && node apps/api/dist/index.js"]
