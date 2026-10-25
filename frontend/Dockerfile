# Frontend: build the React app with Node, then serve the static files with Nginx.

# --- Stage 1: build ---
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first, so code changes don't reinstall them.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-fund --no-audit

COPY . .
RUN npm run build

# --- Stage 2: serve ---
# The unprivileged Nginx image runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
