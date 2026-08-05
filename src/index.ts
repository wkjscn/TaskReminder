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

// Protected API routes
app.use('/api', requireAuth, routes);

// Static files
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 事项提醒服务已启动: http://localhost:${PORT}`);
  console.log('─'.repeat(50));
  startScheduler();
  console.log('─'.repeat(50));
});
