FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY frontend/ ./
ENV REACT_APP_API_URL=/api
RUN npm run build

# ---- Backend ----
FROM node:20-slim

# 安装 canvas 依赖
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-builder /frontend/build ./frontend/build

RUN mkdir -p data uploads/images uploads/rendered

EXPOSE 3710

CMD ["node", "index.js"]
