#!/usr/bin/env sh
# 沟通牌计分平台 —— 构建镜像并重启容器
# 职责边界：git pull 由 Jenkins 负责，本脚本只做 podman build + podman run。
# 前置：当前目录已是最新代码；服务器已安装 podman。
set -e
cd "$(dirname "$0")"

IMAGE="goutongpai"
CONTAINER="goutongpai"
PORT="127.0.0.1:5178:5178"
VOLUME="goutongpai-data:/app/data"   # 具名卷，首次 run 会自动创建；数据持久化靠它

echo "==> 构建镜像 $IMAGE"
podman build -t "$IMAGE" .

echo "==> 重启容器 $CONTAINER（数据卷 $VOLUME 保持不变）"
# run 前先停并删除同名旧容器，否则容器已存在会报错；数据在卷里不受影响
podman stop "$CONTAINER" 2>/dev/null || true
podman rm "$CONTAINER" 2>/dev/null || true
podman run -d \
  --name "$CONTAINER" \
  -p "$PORT" \
  -v "$VOLUME" \
  --restart unless-stopped \
  "$IMAGE"

echo "==> 完成"
