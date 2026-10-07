# 沟通牌计分平台 —— 服务器环境无关部署
# 构建：podman build -t goutongpai .
# 运行：podman run -d --pull=never -p 127.0.0.1:5178:5178 -v /opt/goutongpai-data:/app/data --name goutongpai --security-opt seccomp=unconfined localhost/goutongpai:latest
# 注：--pull=never + localhost/ 全限定标签用于规避短名解析（部分环境 unqualified-search-registries 为空会报 invalid reference format）；
#     --security-opt seccomp=unconfined 用于放行 glibc 2.34+ clone3，否则 Node 启动期线程创建会被拦导致容器秒退。
# 用 node:22-slim（Debian/glibc）而非 alpine（musl）：node:sqlite 在 musl 上会报 disk I/O error，glibc 正常。

FROM node:22-slim

WORKDIR /app

# 零第三方依赖，直接拷贝源码即可
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

ENV PORT=5178
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 5178

# 数据（SQLite 库 + 上传的图片）挂载到卷，容器重建不丢数据
VOLUME ["/app/data"]

# 简单的健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5178)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
