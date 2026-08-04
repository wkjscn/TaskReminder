import fetch from 'node-fetch';

const DEFAULT_APP_ID = process.env.FEISHU_APP_ID || '';
const DEFAULT_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const DEFAULT_RECEIVE_ID = process.env.FEISHU_RECEIVE_ID || '';

// 缓存 tenant_access_token 及过期时间
let cachedToken: { token: string; expireAt: number } | null = null;

async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  // 复用未过期的缓存 token
  if (cachedToken && Date.now() < cachedToken.expireAt) {
    return cachedToken.token;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });

  const data = await response.json() as { code: number; msg?: string; tenant_access_token?: string; expire?: number };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(data.msg || '获取飞书 access_token 失败');
  }

  // 提前 5 分钟过期，避免边界问题
  cachedToken = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire || 7200) * 1000 - 5 * 60 * 1000
  };
  return cachedToken.token;
}

export async function sendFeishuMessage(
  message: string,
  options?: { appId?: string; appSecret?: string; receiveId?: string }
): Promise<{ success: boolean; error?: string }> {
  const appId = options?.appId || DEFAULT_APP_ID;
  const appSecret = options?.appSecret || DEFAULT_APP_SECRET;
  const receiveId = options?.receiveId || DEFAULT_RECEIVE_ID;

  if (!appId || !appSecret || !receiveId) {
    return { success: false, error: '飞书配置不完整 (需要 App ID、App Secret 和 接收者 ID)' };
  }

  try {
    const token = await getTenantAccessToken(appId, appSecret);

    const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      })
    });

    const data = await response.json() as { code: number; msg?: string };
    if (data.code === 0) {
      return { success: true };
    }
    // token 失效则清除缓存重试一次
    if (data.code === 99991663 || data.code === 99991661) {
      cachedToken = null;
    }
    return { success: false, error: data.msg || '飞书 API 错误' };
  } catch (err: any) {
    return { success: false, error: err.message || '请求失败' };
  }
}
