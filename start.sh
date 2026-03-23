#!/bin/bash

# MakeContents 本地开发启动脚本

# 获取脚本所在目录（无论从哪里运行都正确）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 后台模式
DAEMON_MODE=false
if [ "$1" = "--daemon" ] || [ "$1" = "-d" ]; then
  DAEMON_MODE=true
fi

echo "=============================="
echo "  MakeContents 本地启动"
echo "=============================="

# 检查是否在项目根目录
if [ ! -d "$SCRIPT_DIR/backend" ] || [ ! -d "$SCRIPT_DIR/frontend" ]; then
  echo "错误：找不到 backend 或 frontend 目录"
  exit 1
fi

# 检查 node_modules
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
  echo "正在安装后端依赖..."
  (cd "$SCRIPT_DIR/backend" && npm install)
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo "正在安装前端依赖..."
  (cd "$SCRIPT_DIR/frontend" && npm install)
fi

# 创建数据目录
mkdir -p "$SCRIPT_DIR/backend/data" \
         "$SCRIPT_DIR/backend/uploads/images" \
         "$SCRIPT_DIR/backend/uploads/rendered" \
         "$SCRIPT_DIR/logs"

# 启动后端
echo "启动后端服务 (端口 3710)..."
if [ "$DAEMON_MODE" = true ]; then
  nohup sh -c "cd $SCRIPT_DIR/backend && node index.js" >> "$SCRIPT_DIR/logs/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "✓ 后端已启动 (PID: $BACKEND_PID)"
else
  (cd "$SCRIPT_DIR/backend" && node index.js) &
  BACKEND_PID=$!
fi

# 等待后端启动
sleep 2
if curl -s http://localhost:3710/api/health > /dev/null 2>&1; then
  echo "✓ 后端服务已启动"
else
  echo "⚠ 后端服务可能未完全启动，继续..."
fi

# 启动前端
echo "启动前端开发服务 (端口 3711)..."
if [ "$DAEMON_MODE" = true ]; then
  nohup sh -c "cd $SCRIPT_DIR/frontend && BROWSER=none PORT=3711 npm start" >> "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "✓ 前端已启动 (PID: $FRONTEND_PID)"
else
  (cd "$SCRIPT_DIR/frontend" && BROWSER=none PORT=3711 npm start) &
  FRONTEND_PID=$!
fi

echo ""
echo "=============================="
echo "  服务已启动"
echo "  前端: http://localhost:3711"
echo "  后端: http://localhost:3710"
echo "=============================="

if [ "$DAEMON_MODE" = true ]; then
  echo "后台运行中，日志: $SCRIPT_DIR/logs/"
  exit 0
else
  echo "按 Ctrl+C 停止所有服务"
  # 捕获退出信号
  trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
  wait
fi
