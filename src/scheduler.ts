import cron from 'node-cron';
import { reminderRepository, logRepository, Reminder } from './db';
import { sendTelegramMessage } from './notify/telegram';
import { sendEmailMessage } from './notify/email';
import { sendFeishuMessage } from './notify/feishu';
import { sendBarkMessage } from './notify/bark';

function shouldTriggerReminder(reminder: Reminder): boolean {
  const now = new Date();
  const startDate = new Date(reminder.start_date);

  if (isNaN(startDate.getTime())) return false;
  if (now < startDate) return false;

  const unit = reminder.interval_unit || 'days';
  const value = reminder.interval_days;
  const hasTime = reminder.start_date.includes('T') || reminder.start_date.includes(':');

  switch (unit) {
    case 'minutes': {
      const diffMin = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60));
      return diffMin >= 0 && diffMin % value === 0;
    }
    case 'hours': {
      if (now.getMinutes() !== startDate.getMinutes()) return false;
      const diffHours = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
      return diffHours >= 0 && diffHours % value === 0;
    }
    case 'months': {
      if (now.getDate() !== startDate.getDate()) return false;
      if (hasTime) {
        if (now.getHours() !== startDate.getHours()) return false;
        if (now.getMinutes() !== startDate.getMinutes()) return false;
      }
      const monthDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
      return monthDiff >= 0 && monthDiff % value === 0;
    }
    case 'days':
    default: {
      if (hasTime) {
        if (now.getHours() !== startDate.getHours()) return false;
        if (now.getMinutes() !== startDate.getMinutes()) return false;
      }
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const startMidnight = new Date(startDate);
      startMidnight.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % value === 0;
    }
  }
}

function getUnitLabel(unit: string): string {
  switch (unit) {
    case 'minutes': return '分钟';
    case 'hours': return '小时';
    case 'months': return '个月';
    case 'days':
    default: return '天';
  }
}

function getNextTriggerDate(reminder: Reminder): Date {
  const start = new Date(reminder.start_date);
  const unit = reminder.interval_unit || 'days';
  const value = reminder.interval_days;
  const next = new Date(start);

  switch (unit) {
    case 'minutes': next.setMinutes(next.getMinutes() + value); break;
    case 'hours': next.setHours(next.getHours() + value); break;
    case 'months': next.setMonth(next.getMonth() + value); break;
    case 'days':
    default: next.setDate(next.getDate() + value); break;
  }
  return next;
}

function formatNextDate(nextDate: Date, unit: string): string {
  const dateStr = nextDate.getFullYear() + '-' +
    String(nextDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(nextDate.getDate()).padStart(2, '0');
  if (unit === 'minutes' || unit === 'hours') {
    return dateStr + ' ' +
      String(nextDate.getHours()).padStart(2, '0') + ':' +
      String(nextDate.getMinutes()).padStart(2, '0');
  }
  return dateStr;
}

function formatReminderMessage(reminder: Reminder): string {
  const now = new Date();
  const unit = reminder.interval_unit || 'days';
  const unitLabel = getUnitLabel(unit);
  const nextDate = getNextTriggerDate(reminder);
  const nextDateStr = formatNextDate(nextDate, unit);

  let descriptionLine = '';
  if (reminder.description) {
    descriptionLine = `📝 详情: ${reminder.description}\n`;
  }

  const telegramMsg = `📋 <b>事项提醒</b>\n` +
    `📌 事项: ${reminder.title}\n` +
    descriptionLine +
    `⏰ 提醒周期: 每 ${reminder.interval_days} ${unitLabel}\n` +
    `📅 下次提醒日期: ${nextDateStr}\n` +
    `🕐 提醒时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

  return telegramMsg;
}

function formatPlainMessage(reminder: Reminder): string {
  const now = new Date();
  const unit = reminder.interval_unit || 'days';
  const unitLabel = getUnitLabel(unit);
  const nextDate = getNextTriggerDate(reminder);
  const nextDateStr = formatNextDate(nextDate, unit);

  let descriptionLine = '';
  if (reminder.description) {
    descriptionLine = `详情: ${reminder.description}\n`;
  }

  return `【事项提醒】\n` +
    `事项: ${reminder.title}\n` +
    descriptionLine +
    `提醒周期: 每${reminder.interval_days}${unitLabel}\n` +
    `下次提醒日期: ${nextDateStr}\n` +
    `提醒时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
}

export function checkAndFireReminders(): void {
  const reminders = reminderRepository.getActive();

  for (const reminder of reminders) {
    if (!shouldTriggerReminder(reminder)) continue;

    const unit = reminder.interval_unit || 'days';

    const hasTelegram = reminder.telegram_bot_token || reminder.telegram_chat_id;
    if (hasTelegram) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'telegram', unit);
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
            result.error,
            reminder.title,
            reminder.description || undefined
          );
          console.log(`[${new Date().toISOString()}] Telegram ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }

    const hasEmail = reminder.email_host || reminder.email_to;
    if (hasEmail) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'email', unit);
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
            result.error,
            reminder.title,
            reminder.description || undefined
          );
          console.log(`[${new Date().toISOString()}] Email ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }

    const hasFeishu = reminder.feishu_app_id || reminder.feishu_app_secret || reminder.feishu_receive_id;
    if (hasFeishu) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'feishu', unit);
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
            result.error,
            reminder.title,
            reminder.description || undefined
          );
          console.log(`[${new Date().toISOString()}] Feishu ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
        });
      }
    }

    const hasBark = reminder.bark_url;
    if (hasBark) {
      const alreadySent = logRepository.hasSentToday(reminder.id, 'bark', unit);
      if (!alreadySent) {
        const message = formatPlainMessage(reminder);
        sendBarkMessage(message, {
          barkUrl: reminder.bark_url || undefined
        }).then(result => {
          logRepository.create(
            reminder.id,
            'bark',
            result.success ? 'success' : 'failed',
            result.error,
            reminder.title,
            reminder.description || undefined
          );
          console.log(`[${new Date().toISOString()}] Bark ${result.success ? '✓' : '✗'} 提醒: ${reminder.title}${result.error ? ' - ' + result.error : ''}`);
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

export function fireReminderNow(reminder: Reminder): { telegram?: Promise<any>; email?: Promise<any>; feishu?: Promise<any>; bark?: Promise<any> } {
  const results: { telegram?: Promise<any>; email?: Promise<any>; feishu?: Promise<any>; bark?: Promise<any> } = {};

  const hasTelegram = reminder.telegram_bot_token || reminder.telegram_chat_id;
  if (hasTelegram) {
    const message = formatReminderMessage(reminder);
    results.telegram = sendTelegramMessage(message, {
      botToken: reminder.telegram_bot_token || undefined,
      chatId: reminder.telegram_chat_id || undefined
    }).then(result => {
      logRepository.create(reminder.id, 'telegram', result.success ? 'success' : 'failed', result.error, reminder.title, reminder.description || undefined);
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
      logRepository.create(reminder.id, 'email', result.success ? 'success' : 'failed', result.error, reminder.title, reminder.description || undefined);
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
      logRepository.create(reminder.id, 'feishu', result.success ? 'success' : 'failed', result.error, reminder.title, reminder.description || undefined);
      return result;
    });
  }

  if (reminder.bark_url) {
    const message = formatPlainMessage(reminder);
    results.bark = sendBarkMessage(message, {
      barkUrl: reminder.bark_url || undefined
    }).then(result => {
      logRepository.create(reminder.id, 'bark', result.success ? 'success' : 'failed', result.error, reminder.title, reminder.description || undefined);
      return result;
    });
  }

  return results;
}
