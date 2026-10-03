#!/usr/bin/env sh
# 沟通牌计分平台 —— Linux / macOS 启动脚本
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 没找到 node 命令，请先安装 Node.js 22 或更高版本" >&2
  exit 1
fi

echo "Node 版本：$(node -v)"
echo "数据目录：$(pwd)/data"
echo
exec node server.js
