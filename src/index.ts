import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { startScheduler } from './scheduler';
import routes from './routes';
import authRouter, { requireAuth } from './auth';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const publicDir = require('fs').existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'src', 'public');

app.use(cors());
app.use(express.json());

// Auth routes (no auth required)
app.use('/api/auth', authRouter);

// API info (no auth required)
app.get('/api', (_req, res) => {
  res.json({
    name: '事项提醒系统 API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': '登录',
        'POST /api/auth/logout': '退出登录',
        'POST /api/auth/register': '注册',
        'GET /api/auth/captcha': '获取验证码',
        'GET /api/auth/me': '获取当前用户',
        'PUT /api/auth/settings': '修改用户名/密码',
      },
      reminders: {
        'GET /api/reminders': '获取提醒列表',
        'POST /api/reminders': '创建提醒',
        'PUT /api/reminders/:id': '更新提醒',
        'DELETE /api/reminders/:id': '删除提醒',
        'POST /api/reminders/:id/toggle': '启用/暂停',
        'POST /api/reminders/:id/fire': '手动触发通知',
        'GET /api/reminders/:id/logs': '获取提醒通知日志',
      },
      logs: {
        'GET /api/logs': '获取通知日志',
      },
      users: {
        'GET /api/users': '获取用户列表（管理员）',
        'PUT /api/users/:id': '更新用户（管理员）',
        'POST /api/users/:id/toggle-status': '切换用户状态（管理员）',
        'DELETE /api/users/:id': '删除用户（管理员）',
      },
      settings: {
        'GET /api/settings': '获取系统设置',
        'PUT /api/settings': '更新系统设置（管理员）',
      },
    },
    note: '除 /api/auth 外，所有接口需要 Bearer Token 认证',
  });
});

// Protected API routes
app.use('/api', requireAuth, routes);

// Static files
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 事项提醒服务已启动: http://localhost:${PORT}`);
  console.log(`📡 API 文档: http://localhost:${PORT}/api`);
  console.log('─'.repeat(50));
  startScheduler();
  console.log('─'.repeat(50));
});
