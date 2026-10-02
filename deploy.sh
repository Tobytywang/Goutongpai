#!/usr/bin/env sh
# 沟通牌计分平台 —— 构建镜像并重启容器
# 职责边界：git pull 由 Jenkins 负责，本脚本只做 podman build + podman run。
# 前置：本脚本须与 Dockerfile 同处项目根目录（随代码 git pull 下来）；服务器已装 podman。
#       脚本会 cd 到自身所在目录作为构建上下文，因此调用时无需手动 cd。
set -e
cd "$(dirname "$0")"   # 切到脚本所在目录（= 项目根），确保 podman build . 的上下文正确

IMAGE="goutongpai"
CONTAINER="goutongpai"
PORT="127.0.0.1:5178:5178"
# 使用宿主机真实目录 bind 挂载，而非命名卷：容器引擎的命名卷底层存储文件系统
# 经常不支持 SQLite 所需的 mmap/文件锁/fdatasync，会触发 "disk I/O error" 启动失败。
# bind 挂到宿主机的 ext4/xfs 目录可彻底规避该问题，且能直接 ls / 备份。
DATA_DIR="/opt/goutongpai-data"

echo "==> 构建镜像 $IMAGE"
podman build -t "$IMAGE" .

echo "==> 重启容器 $CONTAINER（数据目录 $DATA_DIR 保持不变）"
# run 前先停并删除同名旧容器，否则容器已存在会报错；数据在目录里不受影响
podman stop "$CONTAINER" 2>/dev/null || true
podman rm "$CONTAINER" 2>/dev/null || true
mkdir -p "$DATA_DIR"                 # 确保宿主机数据目录存在（首次或目录被删时）
# 注意：本环境（root Podman）的 --restart 策略不被支持（cgroup 配置限制，run 报 invalid argument），故不加该标志；
# 开机自启与崩溃重启改用 systemd unit（Restart=always），见仓库 goutongpai.service。
podman run -d \
  --name "$CONTAINER" \
  -p "$PORT" \
  -v "$DATA_DIR:/app/data" \
  "$IMAGE"

echo "==> 完成"
