// Lightweight mailer for dev (Mailpit) and prod/staging (SMTP).
// ESM module. Requires: nodemailer in apps/api/package.json

import nodemailer from 'nodemailer';

let _transporter;

/**
 * Build a singleton Nodemailer transporter from env.
 * Falls back to Mailpit defaults in dev.
 */
function getTransporter() {
  if (_transporter) return _transporter;

  const {
    SMTP_HOST = '127.0.0.1',
    SMTP_PORT = '1025',
    SMTP_USER = '',
    SMTP_PASS = '',
    SMTP_SECURE = '', // "true" to force TLS (465)
    SMTP_FROM = 'p5 <no-reply@p5.local>', // default sender
    NODE_ENV = 'development',
  } = process.env;

  const portNum = Number(SMTP_PORT);
  const secure =
    SMTP_SECURE?.toLowerCase() === 'true' || portNum === 465 ? true : false;

  // In dev + Mailpit, allow self-signed/notls
  const isDevMailpit =
    NODE_ENV !== 'production' &&
    SMTP_HOST === '127.0.0.1' &&
    portNum === 1025;

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: portNum,
    secure,
    auth:
      SMTP_USER && SMTP_PASS
        ? { user: SMTP_USER, pass: SMTP_PASS }
        : undefined,
    tls: isDevMailpit
      ? { rejectUnauthorized: false } // Mailpit is fine with this in dev
      : undefined,
  });

  // Stash default "from" on the instance for convenience
  _transporter._defaultFrom = SMTP_FROM;
  return _transporter;
}

/**
 * Quick readiness probe for SMTP connectivity.
 * Throws if not reachable.
 */
export async function verifyEmailTransport() {
  const tx = getTransporter();
  await tx.verify(); // nodemailer will attempt a connection
  return true;
}

/**
 * Optional export if another file really needs direct transporter access.
 * Keep this only because you prefer comprehensive/advanced structure.
 */
export function getMailer() {
  return getTransporter();
}

/**
 * Send an email.
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {string} [opts.from] - defaults to env SMTP_FROM or "p5 <no-reply@p5.local>"
 * @param {Array}  [opts.attachments] - nodemailer attachments array
 */
export async function sendEmail({ to, subject, text, html, from, attachments } = {}) {
  if (!to) throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');
  if (!text && !html) throw new Error('sendEmail: provide "text" or "html"');

  const tx = getTransporter();
  const info = await tx.sendMail({
    to,
    subject,
    text,
    html,
    from: from || tx._defaultFrom || 'p5 <no-reply@p5.local>',
    attachments,
  });

  // For local dev with Mailpit, messages are visible at http://localhost:8025
  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

/**
 * Backward-compatible alias for older code that still calls sendMail().
 * This prevents duplication/conflict while preserving your older usage style.
 */
export async function sendMail(opts = {}) {
  return sendEmail(opts);
}

/**
 * A tiny helper to render simple HTML emails consistently.
 * @param {string} title
 * @param {string} bodyHtml - inner HTML content (already sanitized/escaped upstream if needed)
 */
export function simpleTemplate(title, bodyHtml) {
  // Intentional minimal styles; keeps emails readable across clients.
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue','Noto Sans',Arial,'Apple Color Emoji','Segoe UI Emoji';color:#111">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e8eb;border-radius:12px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(title)}</div>
    <div style="padding:20px">${bodyHtml}</div>
  </div>
  <div style="max-width:640px;margin:12px auto 0;text-align:center;color:#6b7280;font-size:12px">
    p5 • This is an automated message.
  </div>
</body>
</html>`;
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Optional: convenience wrapper for common notifications
export async function sendWelcomeEmail(to, name = '') {
  const title = 'Welcome to p5';
  const html = simpleTemplate(
    title,
    `<p>Hi ${escapeHtml(name || 'there')},</p>
     <p>Welcome to <strong>p5</strong>. Your account is ready.</p>`
  );
  const text = `Welcome to p5.\nYour account is ready.`;
  return sendEmail({ to, subject: title, text, html });
}