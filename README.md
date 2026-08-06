# 事项提醒系统

一个完全由 AI 开发的轻量级事项提醒管理系统，支持 Telegram、Email、飞书 Bot、Bark 四种通知渠道，支持注册登录、用户管理、多时区、多间隔单位、定时与手动触发提醒。

## 功能特性

- **提醒管理**：创建、编辑、克隆、删除、启用/暂停提醒事项
- **定时通知**：按设定间隔（分钟/小时/天/月）自动检查并发送提醒
- **多渠道通知**：Telegram Bot、邮件（SMTP）、飞书 Bot、Bark
- **每个提醒独立配置**：可为每个提醒单独配置通知渠道
- **事项详细内容**：每条提醒支持填写详细说明
- **通知历史快照**：发送通知时快照标题和详情
- **通知日志**：记录每次通知发送结果，避免重复发送
- **用户系统**：
  - 注册/登录，支持图形验证码
  - 修改账号密码
  - 管理员用户管理（查看、编辑、启用/停用、删除）
  - 按角色数据隔离：普通用户仅能查看自己的提醒
- **时区设置**：全局时区切换（默认北京时间），所有时间根据设置显示
- **搜索与分页**：提醒列表与用户列表均支持关键词搜索和分页
- **响应式设计**：PC 表格视图 / 移动端卡片视图自动切换
- **手动触发**：支持手动立即发送提醒通知
- **下次提醒日期**：自动计算并显示下次提醒时间

## 技术栈

| 类别 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 定时任务 | node-cron |
| 前端 | 原生 HTML/CSS/JavaScript |
| 通知 | Telegram Bot API / Nodemailer / 飞书开放平台 API / Bark API |
| 认证 | bcryptjs + Token + Session |

## 快速开始
### 方式一：宝塔面板部署(小白推荐)

1. 登录宝塔面板，进入 **软件商店** → 搜索安装 **Docker 管理器**

2. 进入 **Docker 管理器** 

3. 点击 **容器** →  **创建容器** 添加容器，配置如下：
   - **容器名称**：`Task-reminder`
   - **镜像**：
     ```
     ghcr.io/wkjscn/taskreminder:latest
     ```
   - **端口映射**：本地端口：3000 → 宿主机端口：3000

5. 点击 **运行** 启动容器

6. 点击**管理**→**反向代理**→ **绑定域名** 
通过域名访问后：
   - 管理员用户名：`admin`
   - 管理员密码：`admin123`

### 方式二：Docker 部署（推荐）

1. **创建配置文件**

   ```bash
   mkdir bh-reminder && cd bh-reminder
   ```

   创建 `.env` 文件：

   ```env
   # 服务端口
   PORT=3000

   # 管理员账号（首次启动自动创建，之后可通过设置页面修改）
   LOGIN_USERNAME=admin
   LOGIN_PASSWORD=admin123

2. **创建 docker-compose.yml**

   ```yaml
   version: '3.8'

   services:
     bh-reminder:
       image: ghcr.io/wkjscn/taskreminder:latest
       container_name: bh-reminder
       restart: always
       ports:
         - "3000:3000"
       volumes:
         - ./data:/app/data
         - ./.env:/app/.env:ro
       environment:
         - TZ=Asia/Shanghai
         - NODE_ENV=production
   ```

3. **启动服务**

   ```bash
   docker compose up -d
   ```

4. **访问**

   打开浏览器访问 `http://服务器IP:3000`，使用默认账号登录：
   - 用户名：`admin`
   - 密码：`admin123`

> 首次登录后请务必在「设置」页面修改默认密码。

### Docker 命令行方式

如果不使用 docker-compose，也可以直接用 docker 命令：

```bash
docker pull ghcr.io/wkjscn/taskreminder:latest
docker run -d \
  --name bh-reminder \
  --restart always \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/.env:/app/.env:ro \
  -e TZ=Asia/Shanghai \
  ghcr.io/wkjscn/taskreminder:latest
```

### 方式三：源码部署

1. **克隆仓库**

   ```bash
   git clone https://github.com/wkjscn/TaskReminder.git
   cd TaskReminder
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **配置环境变量**

   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件
   ```
   #服务端口
   PORT=3000
   #默认管理员账号密码
   LOGIN_USERNAME=admin
   LOGIN_PASSWORD=admin123
  ```

4. **编译**

   ```bash
   npm run build
   ```

5. **启动**

   ```bash
   # 生产模式
   npm start

   # 开发模式（热重载）
   npm run dev
   ```

### 方式四：PM2 部署（源码方式）

```bash
npm run build
pm2 start dist/index.js --name bh-reminder
pm2 save
```

## 通知渠道配置

### Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`，发送 `/newbot` 创建机器人，获取 **Bot Token**
2. 搜索 `@userinfobot`，获取你的 **Chat ID**
3. 在新建提醒时填写

### 邮件通知

1. 准备一个 SMTP 邮箱账号
2. **Gmail**：需使用应用专用密码（非账号密码）
3. **QQ 邮箱**：设置 → 账户 → 开启 SMTP，获取授权码
4. **163 邮箱**：设置 → POP3/SMTP/IMAP → 开启，获取授权码
5. 在新建提醒时填写

### 飞书 Bot

1. 访问 [飞书开放平台](https://open.feishu.cn/) 创建企业自建应用
2. 开启「机器人」能力
3. 在「事件与回调 → 事件配置」中选择「使用长连接接收事件」
4. 添加权限：`im:message:send_as_bot`
5. 获取 **App ID** 和 **App Secret**
6. 获取接收者 **open_id**（通讯录中查看用户详情）

### Bark

1. 在 iPhone 上安装 [Bark](https://apps.apple.com/app/bark/id1403753865) App
2. 打开 Bark 获取推送 URL（格式：`https://api.day.app/{device_key}`）
3. 在新建提醒时填写
4. 支持两种格式：
   - 完整 URL：`https://api.day.app/abc123`
   - 仅 device_key：`abc123`

## 使用说明

### 创建提醒

1. 登录系统后，在仪表盘点击「新建提醒」
2. 填写提醒标题、事项详细内容（可选）、开始日期时间
3. 选择间隔单位（分钟/小时/天/月）和间隔数值
4. 选择通知渠道 Tab（Telegram / 邮件 / 飞书 / Bark），填写对应配置
5. 保存即可

### 提醒规则

- 系统每分钟检查一次是否有到期提醒
- 从开始日期起，每隔设定间隔（分钟/小时/天/月）触发一次通知
- 每个提醒每个间隔周期最多发送一次通知（避免重复）
- 支持手动触发立即发送
- 支持克隆已有提醒快速创建新提醒

### 管理功能

- **启用/暂停**：暂停后不再发送通知
- **编辑**：修改提醒内容和通知配置
- **克隆**：复制现有提醒，ID 不同，标题加「（副本）」
- **发送**：手动立即触发通知
- **日志**：查看通知历史快照
- **删除**：删除提醒及其通知日志

### 用户管理（仅管理员可见）

- 查看所有注册用户列表
- 修改用户信息（用户名、密码、角色、状态）
- 启用/停用用户（停用后无法登录）
- 删除用户（管理员账号不可删除）

## API 接口

所有 `/api` 接口（除 `/api/auth/*`）需要携带 Token 认证：

```
Authorization: Bearer <token>
```

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/captcha` | 获取图形验证码 |
| POST | `/api/auth/register` | 注册新账号 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| PUT | `/api/auth/settings` | 修改用户名/密码 |

### 提醒管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reminders` | 获取提醒列表（支持按用户筛选） |
| POST | `/api/reminders` | 创建提醒 |
| PUT | `/api/reminders/:id` | 更新提醒 |
| DELETE | `/api/reminders/:id` | 删除提醒 |
| POST | `/api/reminders/:id/toggle` | 启用/暂停 |
| POST | `/api/reminders/:id/fire` | 手动触发通知 |
| GET | `/api/reminders/:id/logs` | 获取指定提醒的通知日志 |

### 通知日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/logs` | 获取全部通知日志（按用户权限过滤） |

### 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取用户列表 |
| PUT | `/api/users/:id` | 更新用户信息 |
| POST | `/api/users/:id/toggle-status` | 启用/停用用户 |
| DELETE | `/api/users/:id` | 删除用户 |

### 系统设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取系统设置 |
| PUT | `/api/settings` | 更新系统设置（管理员） |

## 项目结构

```
TaskReminder/
├── src/
│   ├── index.ts          # 应用入口
│   ├── db.ts             # 数据库操作
│   ├── routes.ts         # API 路由
│   ├── auth.ts           # 认证模块
│   ├── scheduler.ts      # 定时调度
│   ├── notify/
│   │   ├── telegram.ts   # Telegram 通知
│   │   ├── email.ts      # 邮件通知
│   │   ├── feishu.ts     # 飞书通知
│   │   └── bark.ts       # Bark 通知
│   └── public/
│       └── index.html    # 前端页面
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## 数据备份

数据库文件位于 `data/account-keeper.db`，定期备份此文件即可。

**Docker 部署**：备份 `./data/` 目录。

## 常见问题

### 忘记密码？

删除 `data/account-keeper.db` 文件后重启服务，将使用 `.env` 中的 `LOGIN_USERNAME` / `LOGIN_PASSWORD` 重新创建用户。

> 注意：此操作会清除所有提醒数据，请提前备份数据库。

### 更新 Docker 镜像

```bash
docker compose pull
docker compose up -d
```

如遇缓存问题，可先清理旧镜像：

```bash
docker image rm ghcr.io/wkjscn/taskreminder:latest
docker compose pull
docker compose up -d
```

## 官方交流TG群

https://t.me/wkjsGroup
