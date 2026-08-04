import cron from 'node-cron';
import { reminderRepository, logRepository, Reminder } from './db';
import { sendTelegramMessage } from './notify/telegram';
import { sendEmailMessage } from './notify/email';
import { sendFeishuMessage } from './notify/feishu';

function shouldTriggerReminder(reminder: Reminder): boolean {
  const now = new Date();
  const startDate = new Date(reminder.start_date);

  if (isNaN(startDate.getTime())) return false;
  if (now < startDate) return false;

  const diffDays = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays % reminder.interval_days !== 0) return false;
  if (diffDays === 0 && now.toDateString() === startDate.toDateString()) return true;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startMidnight = new Date(startDate);
  startMidnight.setHours(0, 0, 0, 0);
  const mod = Math.floor(
    (today.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)
  ) % reminder.interval_days;

  return mod === 0;
}

function formatReminderMessage(reminder: Reminder): string {
  const now = new Date();
  const nextDate = new Date(reminder.start_date);
  nextDate.setDate(nextDate.getDate() + reminder.interval_days);

  const telegramMsg = `📋 <b>事项提醒</b>\n\n` +
    `📌 事项: ${reminder.title}\n` +
    `⏰ 提醒周期: 每 ${reminder.interval_days} 天\n` +
    `📅 下次提醒日期: ${nextDate.toISOString().slice(0, 10)}\n` +
    `🕐 提醒时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  return telegramMsg;
}

function formatPlainMessage(reminder: Reminder): string {
  const now = new Date();
  const nextDate = new Date(reminder.start_date);
  nextDate.setDate(nextDate.getDate() + reminder.interval_days);

  return `【事项提醒】\n` +
    `事项: ${reminder.title}\n` +
    `提醒周期: 每${reminder.interval_days}天\n` +
    `下次提醒日期: ${nextDate.toISOString().slice(0, 10)}\n` +
    `提醒时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
}

export function checkAndFireReminders(): void {
  const reminders = reminderRepository.getActive();

  for (const reminder of reminders) {
    if (!shouldTriggerReminder(reminder)) continue;

    const hasTelegram = reminder.telegram_bot_token || reminder.telegram_chat_id;
    if (hasTelegram) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'telegram');
      if (!alreadySent) {
        const message = formatReminderMessage(reminder);
        sendTelegramMessage(message, {
          botToken: reminder.telegram_bot_token || undefined,
          chatId: reminder.telegram_chat_id || undefined
        }).then(result => {
          logRepository.create(
            reminder.id,
            'telegram',
            result.success ? 'success' : 'failed',
            result.error
          );
          console.log(`[${new Date().toISOString()}] Telegram ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }

    const hasEmail = reminder.email_host || reminder.email_to;
    if (hasEmail) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'email');
      if (!alreadySent) {
        const message = formatPlainMessage(reminder);
        sendEmailMessage(message, {
          host: reminder.email_host || undefined,
          port: reminder.email_port || undefined,
          user: reminder.email_user || undefined,
          pass: reminder.email_pass || undefined,
          to: reminder.email_to || undefined
        }).then(result => {
          logRepository.create(
            reminder.id,
            'email',
            result.success ? 'success' : 'failed',
            result.error
          );
          console.log(`[${new Date().toISOString()}] Email ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }

    const hasFeishu = reminder.feishu_app_id || reminder.feishu_app_secret || reminder.feishu_receive_id;
    if (hasFeishu) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'feishu');
      if (!alreadySent) {
        const message = formatPlainMessage(reminder);
        sendFeishuMessage(message, {
          appId: reminder.feishu_app_id || undefined,
          appSecret: reminder.feishu_app_secret || undefined,
          receiveId: reminder.feishu_receive_id || undefined
        }).then(result => {
          logRepository.create(
            reminder.id,
            'feishu',
            result.success ? 'success' : 'failed',
            result.error
          );
          console.log(`[${new Date().toISOString()}] Feishu ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }
  }
}

export function startScheduler(): void {
  cron.schedule('*/1 * * * *', () => {
    checkAndFireReminders();
  }, {
    timezone: 'Asia/Shanghai'
  });

  console.log('⏰ 事项提醒调度器已启动 (每分钟检查)');
  checkAndFireReminders();
}

export function fireReminderNow(reminder: Reminder): { telegram?: Promise<any>; email?: Promise<any>; feishu?: Promise<any> } {
  const results: { telegram?: Promise<any>; email?: Promise<any>; feishu?: Promise<any> } = {};

  const hasTelegram = reminder.telegram_bot_token || reminder.telegram_chat_id;
  if (hasTelegram) {
    const message = formatReminderMessage(reminder);
    results.telegram = sendTelegramMessage(message, {
      botToken: reminder.telegram_bot_token || undefined,
      chatId: reminder.telegram_chat_id || undefined
    }).then(result => {
      logRepository.create(reminder.id, 'telegram', result.success ? 'success' : 'failed', result.error);
      return result;
    });
  }

  const hasEmail = reminder.email_host || reminder.email_to;
  if (hasEmail) {
    const message = formatPlainMessage(reminder);
    results.email = sendEmailMessage(message, {
      host: reminder.email_host || undefined,
      port: reminder.email_port || undefined,
      user: reminder.email_user || undefined,
      pass: reminder.email_pass || undefined,
      to: reminder.email_to || undefined
    }).then(result => {
      logRepository.create(reminder.id, 'email', result.success ? 'success' : 'failed', result.error);
      return result;
    });
  }

  const hasFeishu = reminder.feishu_app_id || reminder.feishu_app_secret || reminder.feishu_receive_id;
  if (hasFeishu) {
    const message = formatPlainMessage(reminder);
    results.feishu = sendFeishuMessage(message, {
      appId: reminder.feishu_app_id || undefined,
      appSecret: reminder.feishu_app_secret || undefined,
      receiveId: reminder.feishu_receive_id || undefined
    }).then(result => {
      logRepository.create(reminder.id, 'feishu', result.success ? 'success' : 'failed', result.error);
      return result;
    });
  }

  return results;
}
