# ────────────────────────────────────────────
# Stage 1: 构建前端
# ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install --omit=dev --prefer-offline
COPY frontend/ ./
ENV REACT_APP_API_URL=/api
RUN npm run build

# ────────────────────────────────────────────
# Stage 2: 生产镜像
# ────────────────────────────────────────────
FROM node:20-slim

# 安装 Chromium、中文字体、Noto Color Emoji（用于截图渲染）
# 以及 canvas 的原生依赖（保留以防其他功能需要）
RUN apt-get update && apt-get install -y \
    # Chromium
    chromium \
    # 中文字体
    fonts-noto-cjk \
    # Noto Color Emoji（容器内彩色 emoji）
    fonts-noto-color-emoji \
    # canvas 原生依赖
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    # 工具
    curl \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev --prefer-offline

COPY backend/ ./
COPY --from=frontend-builder /frontend/build ./frontend/build

RUN mkdir -p data uploads/images uploads/rendered uploads/emoji_cache

EXPOSE 3710

CMD ["node", "index.js"]
