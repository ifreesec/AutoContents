# MakeContents 启动指南

## 开发模式

### 前台运行
```bash
cd ~/Projects/dev/AutoContents
./start.sh
```

### 后台运行
```bash
cd ~/Projects/dev/AutoContents
./start.sh --daemon
# 或
./start.sh -d
```

### 查看日志
```bash
tail -f ~/Projects/dev/AutoContents/logs/backend.log   # 后端日志
tail -f ~/Projects/dev/AutoContents/logs/frontend.log  # 前端日志
```

### 停止服务
```bash
pkill -f "node index.js"   # 后端
pkill -f "react-scripts"   # 前端
```

---

## 生产模式

生产模式只启动后端（Express 提供静态文件），更轻量，不需要多个 React 进程。

### 1. 构建前端
```bash
cd ~/Projects/dev/AutoContents/frontend
npm run build
```
构建产物会生成在 `frontend/build` 目录。

### 2. 启动后端
```bash
cd ~/Projects/dev/AutoContents/backend
node index.js
```

### 3. 访问
- 后端 API: http://localhost:3710/api/health
- 前端页面: http://localhost:3710

### 后台运行
```bash
cd ~/Projects/dev/AutoContents/backend
nohup node index.js > ../logs/prod.log 2>&1 &
```

---

## 端口说明

| 端口 | 说明 |
|------|------|
| 3710 | 后端 API |
| 3711 | 前端开发服务器（仅开发模式） |
