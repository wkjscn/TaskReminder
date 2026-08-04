# 事项提醒系统

一个完全由Ai开发的轻量级事项提醒管理系统，支持按间隔天数自动发送提醒通知到 Telegram、邮箱和飞书 Bot。

## 功能特性

- **提醒管理**：创建、编辑、删除、启用/暂停提醒事项
- **定时通知**：按设定间隔（天数）自动检查并发送提醒
- **多渠道通知**：
  - Telegram Bot
  - 邮件（SMTP）
  - 飞书 Bot
- **每个提醒独立配置**：可为每个提醒单独配置通知渠道，也可使用全局默认配置
- **通知日志**：记录每次通知发送结果，避免重复发送
- **用户认证**：登录系统保护数据安全，支持修改用户名/密码
- **响应式设计**：支持移动端访问，卡片式列表展示
- **手动触发**：支持手动立即发送提醒通知
- **下次提醒日期**：自动计算并显示下次提醒时间

## 技术栈

| 类别 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 定时任务 | node-cron |
| 前端 | 原生 HTML/CSS/JavaScript |
| 通知 | Telegram Bot API / Nodemailer / 飞书开放平台 API |
| 认证 | bcryptjs + Token |

## 快速开始

### 方式一：Docker 部署（推荐）

1. **创建配置文件**

   ```bash
   mkdir bh-reminder && cd bh-reminder
   ```

   创建 `.env` 文件：

   ```env
   # 服务端口
   PORT=3000

   # 登录账号（首次启动自动创建，之后可通过设置页面修改）
   LOGIN_USERNAME=admin
   LOGIN_PASSWORD=admin123

   ```

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

### 方式二：源码部署

1. **克隆仓库**

   ```bash
   git clone https://github.com/wkjscn/TaskReminder.git
   cd bh-reminder
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **配置环境变量（设置默认登录密码/端口）**

   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件。

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

### 方式三：PM2 部署（源码方式）

```bash
npm run build
pm2 start dist/index.js --name bh-reminder
pm2 save
```

## 通知渠道配置

### Telegram Bot

1. 在 Telegram 中搜索 `@BotFather`，发送 `/newbot` 创建机器人，获取 **Bot Token**
2. 搜索 `@userinfobot`，获取你的 **Chat ID**
3. 填入 `.env` 文件或在新建提醒时填写

### 邮件通知

1. 准备一个 SMTP 邮箱账号
2. **Gmail**：需使用应用专用密码（非账号密码）
3. **QQ 邮箱**：设置 → 账户 → 开启 SMTP，获取授权码
4. **163 邮箱**：设置 → POP3/SMTP/IMAP → 开启，获取授权码
5. 填入 `.env` 文件或在新建提醒时填写

### 飞书 Bot

1. 访问 [飞书开放平台](https://open.feishu.cn/) 创建企业自建应用
2. 开启「机器人」能力
3. 添加权限：`im:message:send_as_bot`
4. 获取 **App ID** 和 **App Secret**
5. 获取接收者 **open_id**（通讯录中查看用户详情）

## 使用说明

### 创建提醒

1. 登录系统后，在仪表盘点击「新建提醒」
2. 填写提醒标题、开始日期、间隔天数
3. 选择通知渠道 Tab（Telegram / 邮件 / 飞书），填写对应配置
4. 保存即可

### 提醒规则

- 系统每分钟检查一次是否有到期提醒
- 从开始日期起，每隔「间隔天数」触发一次通知
- 每个提醒每天最多发送一次通知（避免重复）
- 支持手动触发立即发送

### 管理功能

- **启用/暂停**：暂停后不再发送通知
- **编辑**：修改提醒内容和通知配置
- **删除**：删除提醒及其通知日志
- **通知日志**：查看历史发送记录

## API 接口

所有 `/api` 接口（除 `/api/auth/*`）需要携带 Token 认证：

```
Authorization: Bearer <token>
```

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| PUT | `/api/auth/settings` | 修改用户名/密码 |
| GET | `/api/reminders` | 获取提醒列表 |
| POST | `/api/reminders` | 创建提醒 |
| PUT | `/api/reminders/:id` | 更新提醒 |
| DELETE | `/api/reminders/:id` | 删除提醒 |
| PATCH | `/api/reminders/:id/toggle` | 启用/暂停 |
| POST | `/api/reminders/:id/trigger` | 手动触发通知 |
| GET | `/api/logs/:reminderId` | 获取通知日志 |

## 项目结构

```
bh-reminder/
├── src/
│   ├── index.ts          # 应用入口
│   ├── db.ts             # 数据库操作
│   ├── routes.ts         # API 路由
│   ├── auth.ts           # 认证模块
│   ├── scheduler.ts      # 定时调度
│   ├── notify/
│   │   ├── telegram.ts   # Telegram 通知
│   │   ├── email.ts      # 邮件通知
│   │   └── feishu.ts     # 飞书通知
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

### 官方交流TG群： https://t.me/wkjsGroup

