import { Router } from 'express';
import { reminderRepository, logRepository } from './db';
import { fireReminderNow } from './scheduler';

const router = Router();

router.get('/reminders', (_req, res) => {
  const reminders = reminderRepository.getAll();
  res.json({ success: true, data: reminders });
});

router.post('/reminders', (req, res) => {
  const { title, start_date, interval_days, telegram_bot_token, telegram_chat_id, email_host, email_port, email_user, email_pass, email_to, feishu_app_id, feishu_app_secret, feishu_receive_id } = req.body;

  if (!title || !start_date || !interval_days) {
    res.status(400).json({ success: false, error: '标题、开始时间和间隔天数为必填项' });
    return;
  }

  const reminder = reminderRepository.create({
    title: String(title),
    start_date: String(start_date),
    interval_days: parseInt(interval_days, 10),
    telegram_bot_token: telegram_bot_token ? String(telegram_bot_token) : undefined,
    telegram_chat_id: telegram_chat_id ? String(telegram_chat_id) : undefined,
    email_host: email_host ? String(email_host) : undefined,
    email_port: email_port ? parseInt(email_port, 10) : undefined,
    email_user: email_user ? String(email_user) : undefined,
    email_pass: email_pass ? String(email_pass) : undefined,
    email_to: email_to ? String(email_to) : undefined,
    feishu_app_id: feishu_app_id ? String(feishu_app_id) : undefined,
    feishu_app_secret: feishu_app_secret ? String(feishu_app_secret) : undefined,
    feishu_receive_id: feishu_receive_id ? String(feishu_receive_id) : undefined
  });

  res.json({ success: true, data: reminder });
});

router.put('/reminders/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const reminder = reminderRepository.update(id, req.body);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  res.json({ success: true, data: reminder });
});

router.delete('/reminders/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = reminderRepository.getById(id);
  if (!existing) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
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
  const id = parseInt(req.params.id, 10);
  const { enabled } = req.body;
  const reminder = reminderRepository.toggle(id, !!enabled);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  res.json({ success: true, data: reminder });
});

router.post('/reminders/:id/fire', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const reminder = reminderRepository.getById(id);

  if (!reminder) {
    res.status(404).json({ success: false, error: '未找到该提醒' });
    return;
  }

  const results = fireReminderNow(reminder);

  const resultsObj: any = {};
  if (results.telegram) resultsObj.telegram = await results.telegram;
  if (results.email) resultsObj.email = await results.email;
  if (results.feishu) resultsObj.feishu = await results.feishu;

  res.json({ success: true, data: resultsObj });
});

router.get('/reminders/:id/logs', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const logs = logRepository.getByReminder(id, limit);
  res.json({ success: true, data: logs });
});

router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const logs = logRepository.getAll(limit);
  res.json({ success: true, data: logs });
});

router.get('/config', (_req, res) => {
  res.json({
    success: true,
    data: {
      telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      email_configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    }
  });
});

export default router;
