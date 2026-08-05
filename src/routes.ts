import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { reminderRepository, logRepository, userRepository, settingsRepository } from './db';
import { fireReminderNow } from './scheduler';
import { requireAdmin } from './auth';

const router = Router();

router.get('/reminders', (req, res) => {
  const user = (req as any).user;
  const reminders = user.role === 'admin' ? reminderRepository.getAll() : reminderRepository.getAll(user.id);
  res.json({ success: true, data: reminders });
});

router.post('/reminders', (req, res) => {
  const user = (req as any).user;
  const { title, description, start_date, interval_days, interval_unit, telegram_bot_token, telegram_chat_id, email_host, email_port, email_user, email_pass, email_to, feishu_app_id, feishu_app_secret, feishu_receive_id, bark_url } = req.body;

  if (!title || !start_date || !interval_days) {
    res.status(400).json({ success: false, error: '标题、开始时间和间隔天数为必填项' });
    return;
  }

  const reminder = reminderRepository.create({
    title: String(title),
    description: description ? String(description) : undefined,
    start_date: String(start_date),
    interval_days: parseInt(interval_days, 10),
    interval_unit: interval_unit ? String(interval_unit) : undefined,
    telegram_bot_token: telegram_bot_token ? String(telegram_bot_token) : undefined,
    telegram_chat_id: telegram_chat_id ? String(telegram_chat_id) : undefined,
    email_host: email_host ? String(email_host) : undefined,
    email_port: email_port ? parseInt(email_port, 10) : undefined,
    email_user: email_user ? String(email_user) : undefined,
    email_pass: email_pass ? String(email_pass) : undefined,
    email_to: email_to ? String(email_to) : undefined,
    feishu_app_id: feishu_app_id ? String(feishu_app_id) : undefined,
    feishu_app_secret: feishu_app_secret ? String(feishu_app_secret) : undefined,
    feishu_receive_id: feishu_receive_id ? String(feishu_receive_id) : undefined,
    bark_url: bark_url ? String(bark_url) : undefined,
    user_id: user.id
  });

  res.json({ success: true, data: reminder });
});

router.put('/reminders/:id', (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const existing = reminderRepository.getById(id);

  if (!existing) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  if (user.role !== 'admin' && existing.user_id !== user.id) {
    res.status(403).json({ success: false, error: '无权限操作此提醒' });
    return;
  }

  const reminder = reminderRepository.update(id, req.body);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  res.json({ success: true, data: reminder });
});

router.delete('/reminders/:id', (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const existing = reminderRepository.getById(id);
  if (!existing) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  if (user.role !== 'admin' && existing.user_id !== user.id) {
    res.status(403).json({ success: false, error: '无权限操作此提醒' });
    return;
  }

  try {
    reminderRepository.delete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除失败' });
  }
});

router.post('/reminders/:id/toggle', (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const existing = reminderRepository.getById(id);

  if (!existing) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  if (user.role !== 'admin' && existing.user_id !== user.id) {
    res.status(403).json({ success: false, error: '无权限操作此提醒' });
    return;
  }

  const { enabled } = req.body;
  const reminder = reminderRepository.toggle(id, !!enabled);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  res.json({ success: true, data: reminder });
});

router.post('/reminders/:id/fire', async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const reminder = reminderRepository.getById(id);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  if (user.role !== 'admin' && reminder.user_id !== user.id) {
    res.status(403).json({ success: false, error: '无权限操作此提醒' });
    return;
  }

  const results = fireReminderNow(reminder);

  const resultsObj: any = {};
  if (results.telegram) resultsObj.telegram = await results.telegram;
  if (results.email) resultsObj.email = await results.email;
  if (results.feishu) resultsObj.feishu = await results.feishu;
  if (results.bark) resultsObj.bark = await results.bark;

  res.json({ success: true, data: resultsObj });
});

router.get('/reminders/:id/logs', (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const existing = reminderRepository.getById(id);

  if (!existing) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  if (user.role !== 'admin' && existing.user_id !== user.id) {
    res.status(403).json({ success: false, error: '无权限查看此提醒的日志' });
    return;
  }

  const logs = logRepository.getByReminder(id, limit);
  res.json({ success: true, data: logs });
});

router.get('/logs', (req, res) => {
  const user = (req as any).user;
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const logs = user.role === 'admin' ? logRepository.getAll(limit) : logRepository.getByUserId(user.id, limit);
  res.json({ success: true, data: logs });
});

// ===== 用户管理（仅管理员）=====

router.get('/users', requireAdmin, (_req, res) => {
  const users = userRepository.getAll();
  const data = users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status || 'active',
    created_at: u.created_at,
    reminder_count: userRepository.getReminderCount(u.id)
  }));
  res.json({ success: true, data });
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = userRepository.getById(id);
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }

  const { username, password, role, status } = req.body;

  if (username && username !== user.username) {
    const existing = userRepository.getByName(String(username));
    if (existing) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }
    userRepository.updateUsername(id, String(username));
  }

  if (password) {
    const hashed = bcrypt.hashSync(String(password), 10);
    userRepository.updatePassword(id, hashed);
  }

  if (role && (role === 'admin' || role === 'user')) {
    userRepository.updateRole(id, role);
  }

  if (status && (status === 'active' || status === 'disabled')) {
    // 不能停用自己
    const currentUser = (req as any).user;
    if (id === currentUser.id && status === 'disabled') {
      res.status(400).json({ success: false, error: '不能停用自己的账号' });
      return;
    }
    userRepository.updateStatus(id, status);
  }

  res.json({ success: true, message: '用户信息已更新' });
});

router.post('/users/:id/toggle-status', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const currentUser = (req as any).user;
  if (id === currentUser.id) {
    res.status(400).json({ success: false, error: '不能修改自己的状态' });
    return;
  }
  const user = userRepository.getById(id);
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }
  const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
  userRepository.updateStatus(id, newStatus);
  res.json({ success: true, data: { status: newStatus } });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const currentUser = (req as any).user;

  if (id === currentUser.id) {
    res.status(400).json({ success: false, error: '不能删除自己' });
    return;
  }

  const user = userRepository.getById(id);
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }

  try {
    userRepository.delete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除失败' });
  }
});

// ===== 系统设置 =====
router.get('/settings', (req, res) => {
  res.json({ success: true, data: { timezone: settingsRepository.getTimezone() } });
});

router.put('/settings', requireAdmin, (req, res) => {
  const { timezone } = req.body;
  if (!timezone || typeof timezone !== 'string') {
    return res.status(400).json({ success: false, error: '时区不能为空' });
  }
  try {
    // 验证时区是否有效
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return res.status(400).json({ success: false, error: '无效的时区' });
  }
  settingsRepository.set('timezone', timezone);
  res.json({ success: true });
});

export default router;
