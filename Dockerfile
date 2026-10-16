# YES HR: website + backend in one container (used by Railway, or any Docker host).
#
# Data lives in /data (database + uploaded files). On Railway, attach a
# volume at /data so it survives restarts and redeploys.

# ---- 1. Build the website and the server ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --no-audit --no-fund

COPY . .
RUN npm run build && cd backend && npm run build

# ---- 2. Small image that only runs it ----
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8080 \
    SQLITE_FILE=/data/yeselevate.db \
    UPLOAD_DIR=/data/uploads \
    FRONTEND_DIST=/app/dist

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/dist /app/dist

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
