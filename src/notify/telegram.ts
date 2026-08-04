import fetch from 'node-fetch';

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export async function sendTelegramMessage(
  message: string,
  options?: { botToken?: string; chatId?: string }
): Promise<{ success: boolean; error?: string }> {
  const botToken = options?.botToken || DEFAULT_BOT_TOKEN;
  const chatId = options?.chatId || DEFAULT_CHAT_ID;

  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram 配置不完整 (需要 Bot Token 和 Chat ID)' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json() as { ok: boolean; description?: string };
    if (data.ok) {
      return { success: true };
    }
    return { success: false, error: data.description || 'Telegram API 错误' };
  } catch (err: any) {
    return { success: false, error: err.message || '请求失败' };
  }
}
