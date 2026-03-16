# ── Stage 1 : build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Dependances (copie lockfile si present)
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile || npm install

# Build (VITE_API_URL=/api -> calls proxied via nginx)
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2 : serve avec nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
