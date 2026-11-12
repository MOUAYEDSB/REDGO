import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Webhook } from 'standardwebhooks';
import * as nodemailer from 'nodemailer';

type AuthEmailAction =
  | 'signup'
  | 'recovery'
  | 'invite'
  | 'magiclink'
  | 'email_change'
  | 'email'
  | 'reauthentication'
  | 'password_changed_notification'
  | 'email_changed_notification'
  | 'phone_changed_notification'
  | 'identity_linked_notification'
  | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification'
  | 'mfa_factor_unenrolled_notification';

type AuthEmailHookPayload = {
  user?: {
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    token?: string;
    token_new?: string;
    email_action_type?: AuthEmailAction;
    old_email?: string;
  };
};

const MAX_BODY_BYTES = 64 * 1024;
const AUTHENTICATION_ACTIONS = new Set<AuthEmailAction>([
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email_change',
  'email',
  'reauthentication',
]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 320
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function authEmailMessage(payload: AuthEmailHookPayload) {
  const recipient = payload.user?.email;
  const action = payload.email_data?.email_action_type;
  if (!validEmail(recipient) || !action) {
    throw new Error('The Supabase Auth email hook payload is incomplete.');
  }

  const displayName = typeof payload.user?.user_metadata?.full_name === 'string'
    ? payload.user.user_metadata.full_name.trim().slice(0, 120)
    : '';
  const safeName = escapeHtml(displayName || 'client REDGO');
  const token = payload.email_data?.token;
  const isAuthenticationAction = AUTHENTICATION_ACTIONS.has(action);

  if (isAuthenticationAction && (!token || !/^\d{8}$/.test(token))) {
    throw new Error('Supabase did not provide a valid eight-digit authentication code.');
  }

  const subject = action === 'signup'
    ? 'Confirmez votre adresse e-mail REDGO'
    : action === 'recovery'
      ? 'Réinitialisez votre mot de passe REDGO'
      : action.endsWith('_notification')
        ? 'Notification de sécurité REDGO'
        : 'Votre code de vérification REDGO';

  const text = isAuthenticationAction
    ? `Bonjour ${displayName || 'client REDGO'},\n\nVotre code REDGO est : ${token}\n\nCe code est à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`
    : `Bonjour ${displayName || 'client REDGO'},\n\nUne modification de sécurité a été effectuée sur votre compte REDGO. Si vous n'êtes pas à l'origine de cette action, contactez l'assistance REDGO.`;

  const logoUrl = process.env.REDGO_EMAIL_LOGO_URL?.trim();
  const logo = logoUrl && /^https:\/\/\S+$/i.test(logoUrl)
    ? `<img src="${escapeHtml(logoUrl)}" alt="REDGO" width="132" style="display:block;max-width:132px;height:auto;margin:0 auto 24px;">`
    : '<div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#ff2638;margin-bottom:24px;">REDGO</div>';
  const content = isAuthenticationAction
    ? `<h1 style="font-size:22px;margin:0 0 12px;color:#18181b;">${action === 'signup' ? 'Confirmez votre e-mail' : action === 'recovery' ? 'Réinitialisez votre mot de passe' : 'Votre code de vérification'}</h1>
       <p style="font-size:15px;line-height:1.6;color:#52525b;">Bonjour ${safeName}, utilisez ce code à huit chiffres dans l’application REDGO :</p>
       <div style="margin:26px 0;padding:18px;border-radius:12px;background:#fff1f2;color:#be123c;font-size:32px;font-weight:800;letter-spacing:10px;text-align:center;">${escapeHtml(token ?? '')}</div>
       <p style="font-size:13px;line-height:1.6;color:#71717a;">Ce code est à usage unique. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>`
    : `<h1 style="font-size:22px;margin:0 0 12px;color:#18181b;">Notification de sécurité</h1>
       <p style="font-size:15px;line-height:1.6;color:#52525b;">Bonjour ${safeName}, une modification de sécurité a été effectuée sur votre compte REDGO. Si vous n’êtes pas à l’origine de cette action, contactez l’assistance REDGO.</p>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:32px 12px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px;border-radius:18px;background:#fff;text-align:center;">
      ${logo}${content}
      <p style="margin:30px 0 0;color:#a1a1aa;font-size:12px;">REDGO · Scooter Taxi & Livraison</p>
    </div>
  </body></html>`;

  return { to: recipient, subject, text, html };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body exceeds the allowed size.'));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const smtpPort = Number(process.env.SMTP_PORT ?? '587');
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
  throw new Error('SMTP_PORT must be a valid TCP port.');
}

const mailer = nodemailer.createTransport({
  host: requiredEnv('SMTP_HOST'),
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: requiredEnv('SMTP_USER'),
    pass: requiredEnv('SMTP_PASSWORD'),
  },
});
const sender = requiredEnv('SMTP_FROM');
const hookSecret = requiredEnv('AUTH_EMAIL_HOOK_SECRET');
if (!hookSecret.startsWith('v1,whsec_')) {
  throw new Error('AUTH_EMAIL_HOOK_SECRET must use the Supabase v1,whsec_ format.');
}
const hook = new Webhook(hookSecret.slice('v1,whsec_'.length));

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/auth/email-hook') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  let payload: AuthEmailHookPayload;
  try {
    const body = await readBody(request);
    const webhookId = request.headers['webhook-id'];
    const webhookTimestamp = request.headers['webhook-timestamp'];
    const webhookSignature = request.headers['webhook-signature'];
    if (
      typeof webhookId !== 'string'
      || typeof webhookTimestamp !== 'string'
      || typeof webhookSignature !== 'string'
    ) {
      sendJson(response, 401, { error: 'Missing webhook signature headers.' });
      return;
    }

    payload = hook.verify(body, {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': webhookSignature,
    }) as AuthEmailHookPayload;
  } catch {
    sendJson(response, 401, { error: 'Invalid authentication email hook request.' });
    return;
  }

  try {
    const message = authEmailMessage(payload);
    await mailer.sendMail({ from: sender, ...message });
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end('{}');
  } catch {
    sendJson(response, 502, { error: 'The authentication email could not be delivered.' });
  }
});

const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

server.listen(port, '0.0.0.0', () => {
  console.info(`REDGO Auth email hook listening on port ${port}.`);
});
