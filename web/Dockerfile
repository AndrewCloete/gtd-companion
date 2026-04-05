FROM node:22-alpine AS builder

WORKDIR /app

# Cache npm dependencies
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build args become the config.json that Vite bundles at build time.
# Using a node one-liner ensures valid JSON regardless of special characters.
ARG GTD_SCHEME=http
ARG GTD_WS_SCHEME=ws
ARG GTD_BACKEND_PORT=10084
ARG GTD_USER
ARG GTD_PSW
ARG GTD_EDITOR_SCHEME=vscode

RUN node -e " \
  const cfg = { \
    scheme: process.env.GTD_SCHEME, \
    ws_scheme: process.env.GTD_WS_SCHEME, \
    backend_port: Number(process.env.GTD_BACKEND_PORT), \
    user: process.env.GTD_USER, \
    psw: process.env.GTD_PSW, \
    editor_scheme: process.env.GTD_EDITOR_SCHEME, \
  }; \
  require('fs').writeFileSync('src/config.json', JSON.stringify(cfg, null, 2)); \
" \
GTD_SCHEME=$GTD_SCHEME \
GTD_WS_SCHEME=$GTD_WS_SCHEME \
GTD_BACKEND_PORT=$GTD_BACKEND_PORT \
GTD_USER=$GTD_USER \
GTD_PSW=$GTD_PSW \
GTD_EDITOR_SCHEME=$GTD_EDITOR_SCHEME

RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
