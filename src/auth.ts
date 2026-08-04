import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userRepository, sessionRepository } from './db';

// 初始化默认用户
const DEFAULT_USERNAME = process.env.LOGIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';

if (userRepository.count() === 0) {
  const hashed = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  userRepository.create(DEFAULT_USERNAME, hashed);
  console.log(`✅ 默认用户已创建: ${DEFAULT_USERNAME} / ${DEFAULT_PASSWORD}`);
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)auth_token=([^\s;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }
  const session = sessionRepository.getByToken(token);
  if (!session) {
    res.status(401).json({ success: false, error: '登录已过期' });
    return;
  }
  const user = userRepository.getById(session.user_id);
  if (!user) {
    res.status(401).json({ success: false, error: '用户不存在' });
    return;
  }
  (req as any).user = user;
  next();
}

const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' });
    return;
  }
  const user = userRepository.getByName(String(username));
  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessionRepository.create(user.id, token);
  res.json({ success: true, data: { token, username: user.username } });
});

authRouter.post('/logout', (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) sessionRepository.delete(token);
  res.json({ success: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, data: { username: user.username } });
});

authRouter.put('/settings', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { new_username, new_password, current_password } = req.body;

  if (!current_password || !bcrypt.compareSync(String(current_password), user.password)) {
    res.status(403).json({ success: false, error: '当前密码不正确' });
    return;
  }

  if (new_username && new_username !== user.username) {
    const existing = userRepository.getByName(String(new_username));
    if (existing) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }
    userRepository.updateUsername(user.id, String(new_username));
  }

  if (new_password) {
    const hashed = bcrypt.hashSync(String(new_password), 10);
    userRepository.updatePassword(user.id, hashed);
  }

  res.json({ success: true, message: '设置已更新' });
});

export default authRouter;
