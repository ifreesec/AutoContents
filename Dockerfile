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

# 安装 Chromium、中文字体和 fontconfig
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fontconfig \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Apple Color Emoji 字体到系统字体目录，让 Chromium 可以 local() 引用
COPY fonts/AppleColorEmoji-Linux.ttf /usr/local/share/fonts/AppleColorEmoji.ttf
RUN fc-cache -f /usr/local/share/fonts/

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev --prefer-offline

COPY backend/ ./
COPY fonts/ ../fonts/
COPY --from=frontend-builder /frontend/build ./frontend/build

RUN mkdir -p data uploads/images uploads/rendered uploads/emoji_cache

EXPOSE 3710

CMD ["node", "index.js"]
