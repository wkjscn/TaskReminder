import nodemailer from 'nodemailer';

const DEFAULT_HOST = process.env.SMTP_HOST || '';
const DEFAULT_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const DEFAULT_USER = process.env.SMTP_USER || '';
const DEFAULT_PASS = process.env.SMTP_PASS || '';
const DEFAULT_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || '';
const DEFAULT_TO = process.env.SMTP_TO || '';

export async function sendEmailMessage(
  message: string,
  options?: { host?: string; port?: number; user?: string; pass?: string; from?: string; to?: string }
): Promise<{ success: boolean; error?: string }> {
  const host = options?.host || DEFAULT_HOST;
  const port = options?.port || DEFAULT_PORT;
  const user = options?.user || DEFAULT_USER;
  const pass = options?.pass || DEFAULT_PASS;
  const from = options?.from || DEFAULT_FROM || user;
  const to = options?.to || DEFAULT_TO;

  if (!host) {
    return { success: false, error: 'SMTP 服务器地址未配置' };
  }
  if (!user || !pass) {
    return { success: false, error: 'SMTP 账号或密码未配置' };
  }
  if (!to) {
    return { success: false, error: '收件邮箱未配置' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const subject = '📋 事项提醒';
    const textBody = message.replace(/<[^>]+>/g, '');

    await transporter.sendMail({
      from,
      to,
      subject,
      text: textBody,
      html: message.replace(/\n/g, '<br>')
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '邮件发送失败' };
  }
}
