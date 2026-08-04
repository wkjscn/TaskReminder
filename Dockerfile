FROM node:18-slim

# 安装 better-sqlite3 编译依赖
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm install

# 复制源码并编译
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# 暴露端口
EXPOSE 3000

# 数据持久化目录
VOLUME ["/app/data"]

# 启动
CMD ["node", "dist/index.js"]
