# 沟通牌计分平台 —— 服务器环境无关部署
# 构建：docker build -t goutongpai .
# 运行：docker run -d -p 5178:5178 -v goutongpai-data:/app/data --name goutongpai goutongpai

FROM node:22-alpine

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
