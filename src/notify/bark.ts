import fetch from 'node-fetch';

const DEFAULT_BARK_URL = process.env.BARK_URL || '';

export async function sendBarkMessage(
  message: string,
  options?: { barkUrl?: string }
): Promise<{ success: boolean; error?: string }> {
  const barkUrl = (options?.barkUrl || DEFAULT_BARK_URL).trim();

  if (!barkUrl) {
    return { success: false, error: 'Bark URL 未配置' };
  }

  try {
    // 支持两种格式：
    // 1. 完整 URL: https://api.day.app/{device_key}
    // 2. 仅 device_key: abc123
    const url = barkUrl.startsWith('http')
      ? barkUrl.replace(/\/$/, '')
      : `https://api.day.app/${barkUrl}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '事项提醒',
        body: message,
        group: '事项提醒系统'
      })
    });

    if (response.ok) {
      return { success: true };
    }

    const text = await response.text();
    return { success: false, error: `Bark HTTP ${response.status}: ${text.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, error: err.message || '请求失败' };
  }
}
