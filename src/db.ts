import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: Database.Database = new Database(path.join(dataDir, 'account-keeper.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (reminder_id) REFERENCES reminders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(enabled);
  CREATE INDEX IF NOT EXISTS idx_notification_log_reminder ON notification_log(reminder_id);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS captcha (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  );
`);

// 迁移: 为旧表添加新列
const columns = db.prepare("PRAGMA table_info(reminders)").all() as { name: string }[];
const colNames = columns.map(c => c.name);
if (!colNames.includes('telegram_bot_token')) {
  db.exec('ALTER TABLE reminders ADD COLUMN telegram_bot_token TEXT');
}
if (!colNames.includes('email_host')) {
  db.exec('ALTER TABLE reminders ADD COLUMN email_host TEXT');
}
if (!colNames.includes('email_port')) {
  db.exec('ALTER TABLE reminders ADD COLUMN email_port INTEGER');
}
if (!colNames.includes('email_user')) {
  db.exec('ALTER TABLE reminders ADD COLUMN email_user TEXT');
}
if (!colNames.includes('email_pass')) {
  db.exec('ALTER TABLE reminders ADD COLUMN email_pass TEXT');
}
if (!colNames.includes('email_to')) {
  db.exec('ALTER TABLE reminders ADD COLUMN email_to TEXT');
}
if (!colNames.includes('feishu_app_id')) {
  db.exec('ALTER TABLE reminders ADD COLUMN feishu_app_id TEXT');
}
if (!colNames.includes('feishu_app_secret')) {
  db.exec('ALTER TABLE reminders ADD COLUMN feishu_app_secret TEXT');
}
if (!colNames.includes('feishu_receive_id')) {
  db.exec('ALTER TABLE reminders ADD COLUMN feishu_receive_id TEXT');
}
if (!colNames.includes('user_id')) {
  db.exec('ALTER TABLE reminders ADD COLUMN user_id INTEGER');
}
if (!colNames.includes('description')) {
  db.exec('ALTER TABLE reminders ADD COLUMN description TEXT');
}
if (!colNames.includes('bark_url')) {
  db.exec('ALTER TABLE reminders ADD COLUMN bark_url TEXT');
}
if (!colNames.includes('interval_unit')) {
  db.exec("ALTER TABLE reminders ADD COLUMN interval_unit TEXT NOT NULL DEFAULT 'days'");
}

// 迁移: 为 users 表添加 role 列
const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
const userColNames = userColumns.map(c => c.name);
if (!userColNames.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}
// 迁移: 为 users 表添加 status 列
if (!userColNames.includes('status')) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
}

// 迁移: 为 notification_log 表添加 title/description 列（记录发送时的快照）
const logColumns = db.prepare("PRAGMA table_info(notification_log)").all() as { name: string }[];
const logColNames = logColumns.map(c => c.name);
if (!logColNames.includes('title')) {
  db.exec('ALTER TABLE notification_log ADD COLUMN title TEXT');
}
if (!logColNames.includes('description')) {
  db.exec('ALTER TABLE notification_log ADD COLUMN description TEXT');
}

export interface Reminder {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  interval_days: number;
  interval_unit: string;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  email_host: string | null;
  email_port: number | null;
  email_user: string | null;
  email_pass: string | null;
  email_to: string | null;
  feishu_app_id: string | null;
  feishu_app_secret: string | null;
  feishu_receive_id: string | null;
  bark_url: string | null;
  user_id: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  username?: string;
}

export interface NotificationLog {
  id: number;
  reminder_id: number;
  channel: string;
  sent_at: string;
  status: string;
  error_message: string | null;
  title?: string;
  description?: string | null;
}

export const reminderRepository = {
  getAll(userId?: number): Reminder[] {
    if (userId !== undefined) {
      return db.prepare(`
        SELECT r.*, u.username 
        FROM reminders r 
        LEFT JOIN users u ON r.user_id = u.id 
        WHERE r.user_id = ? 
        ORDER BY r.id DESC
      `).all(userId) as Reminder[];
    }
    return db.prepare(`
      SELECT r.*, u.username 
      FROM reminders r 
      LEFT JOIN users u ON r.user_id = u.id 
      ORDER BY r.id DESC
    `).all() as Reminder[];
  },

  getById(id: number): Reminder | undefined {
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder | undefined;
  },

  getActive(): Reminder[] {
    return db.prepare('SELECT * FROM reminders WHERE enabled = 1').all() as Reminder[];
  },

  create(data: {
    title: string;
    description?: string;
    start_date: string;
    interval_days: number;
    interval_unit?: string;
    telegram_bot_token?: string;
    telegram_chat_id?: string;
    email_host?: string;
    email_port?: number;
    email_user?: string;
    email_pass?: string;
    email_to?: string;
    feishu_app_id?: string;
    feishu_app_secret?: string;
    feishu_receive_id?: string;
    bark_url?: string;
    user_id?: number;
  }): Reminder {
    const stmt = db.prepare(`
      INSERT INTO reminders (title, description, start_date, interval_days, interval_unit, telegram_bot_token, telegram_chat_id, email_host, email_port, email_user, email_pass, email_to, feishu_app_id, feishu_app_secret, feishu_receive_id, bark_url, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
    `);
    const result = stmt.run(
      data.title,
      data.description || null,
      data.start_date,
      data.interval_days,
      data.interval_unit || 'days',
      data.telegram_bot_token || null,
      data.telegram_chat_id || null,
      data.email_host || null,
      data.email_port || null,
      data.email_user || null,
      data.email_pass || null,
      data.email_to || null,
      data.feishu_app_id || null,
      data.feishu_app_secret || null,
      data.feishu_receive_id || null,
      data.bark_url || null,
      data.user_id || null
    );
    return reminderRepository.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, data: Partial<Omit<Reminder, 'id' | 'created_at'>>): Reminder | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description || null); }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
    if (data.interval_days !== undefined) { fields.push('interval_days = ?'); values.push(data.interval_days); }
    if (data.interval_unit !== undefined) { fields.push('interval_unit = ?'); values.push(data.interval_unit); }
    if (data.telegram_bot_token !== undefined) { fields.push('telegram_bot_token = ?'); values.push(data.telegram_bot_token || null); }
    if (data.telegram_chat_id !== undefined) { fields.push('telegram_chat_id = ?'); values.push(data.telegram_chat_id || null); }
    if (data.email_host !== undefined) { fields.push('email_host = ?'); values.push(data.email_host || null); }
    if (data.email_port !== undefined) { fields.push('email_port = ?'); values.push(data.email_port || null); }
    if (data.email_user !== undefined) { fields.push('email_user = ?'); values.push(data.email_user || null); }
    if (data.email_pass !== undefined) { fields.push('email_pass = ?'); values.push(data.email_pass || null); }
    if (data.email_to !== undefined) { fields.push('email_to = ?'); values.push(data.email_to || null); }
    if (data.feishu_app_id !== undefined) { fields.push('feishu_app_id = ?'); values.push(data.feishu_app_id || null); }
    if (data.feishu_app_secret !== undefined) { fields.push('feishu_app_secret = ?'); values.push(data.feishu_app_secret || null); }
    if (data.feishu_receive_id !== undefined) { fields.push('feishu_receive_id = ?'); values.push(data.feishu_receive_id || null); }
    if (data.bark_url !== undefined) { fields.push('bark_url = ?'); values.push(data.bark_url || null); }
    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled); }

    if (fields.length === 0) return reminderRepository.getById(id);

    fields.push("updated_at = datetime('now', '+8 hours')");
    values.push(id);

    db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return reminderRepository.getById(id);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM notification_log WHERE reminder_id = ?').run(id);
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },

  toggle(id: number, enabled: boolean): Reminder | undefined {
    return reminderRepository.update(id, { enabled: enabled ? 1 : 0 });
  }
};

export const logRepository = {
  getByReminder(reminderId: number, limit = 50): NotificationLog[] {
    return db.prepare(`
      SELECT nl.*, COALESCE(nl.title, r.title) as title, COALESCE(nl.description, r.description) as description
      FROM notification_log nl
      INNER JOIN reminders r ON nl.reminder_id = r.id
      WHERE nl.reminder_id = ?
      ORDER BY nl.sent_at DESC
      LIMIT ?
    `).all(reminderId, limit) as NotificationLog[];
  },

  getAll(limit = 100): NotificationLog[] {
    return db.prepare(`
      SELECT nl.*, COALESCE(nl.title, r.title) as title, COALESCE(nl.description, r.description) as description
      FROM notification_log nl
      INNER JOIN reminders r ON nl.reminder_id = r.id
      ORDER BY nl.sent_at DESC
      LIMIT ?
    `).all(limit) as NotificationLog[];
  },

  getByUserId(userId: number, limit = 100): NotificationLog[] {
    return db.prepare(`
      SELECT nl.*, COALESCE(nl.title, r.title) as title, COALESCE(nl.description, r.description) as description
      FROM notification_log nl
      INNER JOIN reminders r ON nl.reminder_id = r.id
      WHERE r.user_id = ?
      ORDER BY nl.sent_at DESC
      LIMIT ?
    `).all(userId, limit) as NotificationLog[];
  },

  create(reminderId: number, channel: string, status: string, errorMessage?: string, title?: string, description?: string): void {
    db.prepare(`
      INSERT INTO notification_log (reminder_id, channel, status, error_message, title, description, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))
    `).run(reminderId, channel, status, errorMessage || null, title || null, description || null);
  },

  hasSentToday(reminderId: number, channel: string, unit?: string): boolean {
    let format: string;
    switch (unit) {
      case 'minutes': format = '%Y-%m-%d %H:%M'; break;
      case 'hours': format = '%Y-%m-%d %H'; break;
      case 'days':
      case 'months':
      default: format = '%Y-%m-%d'; break;
    }
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM notification_log
      WHERE reminder_id = ? AND channel = ? AND status = 'success'
      AND strftime(?, sent_at) = strftime(?, 'now', '+8 hours')
    `).get(reminderId, channel, format, format) as { count: number };
    return result.count > 0;
  }
};

export interface User {
  id: number;
  username: string;
  password: string;
  role: string;
  status: string;
  created_at: string;
}

export const userRepository = {
  getByName(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },

  getById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  getAll(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY id ASC').all() as User[];
  },

  updatePassword(id: number, hashedPassword: string): void {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
  },

  updateUsername(id: number, username: string): void {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
  },

  updateRole(id: number, role: string): void {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  },

  updateStatus(id: number, status: string): void {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    // 如果被停用，同时删除该用户的所有登录会话
    if (status === 'disabled') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
  },

  count(): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
  },

  create(username: string, hashedPassword: string, role: string = 'user', status: string = 'active'): void {
    db.prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)').run(username, hashedPassword, role, status);
  },

  delete(id: number): void {
    // 删除用户的通知日志和提醒
    db.prepare('DELETE FROM notification_log WHERE reminder_id IN (SELECT id FROM reminders WHERE user_id = ?)').run(id);
    db.prepare('DELETE FROM reminders WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  getReminderCount(userId: number): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM reminders WHERE user_id = ?').get(userId) as { count: number };
    return result.count;
  }
};

export const sessionRepository = {
  create(userId: number, token: string): void {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  },

  getByToken(token: string): { token: string; user_id: number; created_at: string } | undefined {
    return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as { token: string; user_id: number; created_at: string } | undefined;
  },

  delete(token: string): void {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
};

export const captchaRepository = {
  create(id: string, code: string): void {
    // 清理超过 5 分钟的旧验证码
    db.prepare("DELETE FROM captcha WHERE created_at < datetime('now', '+8 hours', '-5 minutes')").run();
    db.prepare('INSERT INTO captcha (id, code) VALUES (?, ?)').run(id, code);
  },

  getAndDelete(id: string): string | null {
    const row = db.prepare('SELECT * FROM captcha WHERE id = ?').get(id) as { code: string; created_at: string } | undefined;
    if (!row) return null;
    // 检查是否过期（5分钟）
    const isExpired = db.prepare("SELECT COUNT(*) as count FROM captcha WHERE id = ? AND created_at < datetime('now', '+8 hours', '-5 minutes')").get(id) as { count: number };
    db.prepare('DELETE FROM captcha WHERE id = ?').run(id);
    return isExpired.count > 0 ? null : row.code;
  }
};

export const settingsRepository = {
  get(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },

  set(key: string, value: string): void {
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now', '+8 hours'))").run(key, value);
  },

  getTimezone(): string {
    return settingsRepository.get('timezone') || 'Asia/Shanghai';
  }
};
