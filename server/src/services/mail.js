import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

let transporter;
let warnedMissingConfiguration = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function emailConfigured() {
  const hasUser = Boolean(process.env.SMTP_USER);
  const hasPassword = Boolean(process.env.SMTP_PASSWORD);
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && Number(process.env.SMTP_PORT) > 0 && hasUser === hasPassword);
}

function getTransporter() {
  if (!emailConfigured()) return null;
  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
      ...(user && pass ? { auth: { user, pass } } : {})
    });
  }
  return transporter;
}

export function grievanceUrl(grievanceId) {
  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl) throw new Error('CLIENT_URL is not configured');
  return new URL(`/app/grievances/${encodeURIComponent(grievanceId)}`, clientUrl).toString();
}

async function deliveryLog({ event, recipient, status, safeError = null, grievanceId = null }) {
  try {
    const { prisma } = await import('../config/db.js');
    await prisma.$executeRaw`INSERT INTO "EmailDelivery" ("id", "event", "recipient", "status", "safeError", "grievanceId", "createdAt") VALUES (${randomUUID()}, ${event}, ${recipient}, ${status}::"EmailDeliveryStatus", ${safeError}, ${grievanceId}, NOW())`;
  } catch (error) {
    console.error('[email] Delivery log could not be saved.', { code: error.code || 'EMAIL_LOG_ERROR' });
  }
}

export async function getEmailDiagnostics() {
  const configured = emailConfigured();
  const result = { smtpConfigured: configured, smtpHost: process.env.SMTP_HOST || null, smtpPort: Number(process.env.SMTP_PORT) || null, smtpSecure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', smtpUserConfigured: Boolean(process.env.SMTP_USER), smtpPasswordConfigured: Boolean(process.env.SMTP_PASSWORD), connection: 'not-tested', safeError: null, superAdminRecipientFound: false };
  if (configured) {
    try { await getTransporter().verify(); result.connection = 'success'; }
    catch (error) { result.connection = 'failed'; result.safeError = String(error.code || 'SMTP_VERIFY_ERROR').slice(0, 80); console.error('[email] SMTP connection verification failed.', { code: result.safeError, responseCode: error.responseCode || null }); }
  }
  return result;
}

export async function sendNotice({ to, subject, heading, introduction, grievance, additionalFields = [], event = 'GRIEVANCE_NOTICE' }) {
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
  if (!recipients.length) return false;

  let mailer;
  try {
    mailer = getTransporter();
  } catch (error) {
    console.error('[email] SMTP configuration could not be initialized.', { code: error.code || 'SMTP_CONFIG_ERROR' });
    return false;
  }
  if (!mailer) {
    if (!warnedMissingConfiguration) {
      console.warn('[email] SMTP not configured; email skipped.');
      warnedMissingConfiguration = true;
    }
    await Promise.all(recipients.map(recipient => deliveryLog({ event, recipient, status: 'SKIPPED', safeError: 'SMTP_NOT_CONFIGURED', grievanceId: grievance?.id })));
    return false;
  }

  const submittedAt = new Date(grievance.createdAt).toLocaleString();
  const fields = [
    ['Reference', grievance.referenceNo],
    ['Student', grievance.student?.fullName],
    ['Student ID', grievance.student?.studentId || 'Not provided'],
    ['Category', grievance.category?.name],
    ['Department', grievance.department?.name || 'Not assigned'],
    ['Priority', grievance.priority],
    ['Title', grievance.title],
    ...(grievance.description ? [['Description summary', `${String(grievance.description).slice(0, 350)}${String(grievance.description).length > 350 ? '…' : ''}`]] : []),
    ['Current status', String(grievance.status).replaceAll('_', ' ')],
    ['Submitted', submittedAt],
    ...additionalFields
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  let link;
  try {
    link = grievanceUrl(grievance.id);
  } catch (error) {
    console.error('[email] Grievance link could not be created; email was skipped.', { code: 'INVALID_CLIENT_URL' });
    await Promise.all(recipients.map(recipient => deliveryLog({ event, recipient, status: 'SKIPPED', safeError: 'INVALID_CLIENT_URL', grievanceId: grievance?.id })));
    return false;
  }
  const htmlRows = fields.map(([label, value]) => `<tr><th align="left" style="padding:9px 12px;color:#64748b;font-size:12px;border-bottom:1px solid #e8edf4">${escapeHtml(label)}</th><td style="padding:9px 12px;color:#17233b;font-size:13px;border-bottom:1px solid #e8edf4">${escapeHtml(value)}</td></tr>`).join('');
  const text = `${heading}\n\n${introduction}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nView Grievance: ${link}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#17233b"><div style="max-width:640px;margin:28px auto;padding:0 16px"><div style="background:#1e3a8a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;font-size:19px;font-weight:bold">CGMS <span style="font-size:12px;font-weight:normal;color:#dbeafe">College Grievance Management System</span></div><div style="background:#fff;padding:26px 24px;border:1px solid #e5eaf2;border-top:0;border-radius:0 0 12px 12px"><h1 style="font-size:21px;margin:0 0 10px">${escapeHtml(heading)}</h1><p style="font-size:14px;line-height:1.6;color:#526178;margin:0 0 18px">${escapeHtml(introduction)}</p><table role="presentation" style="border-collapse:collapse;width:100%">${htmlRows}</table><p style="margin:24px 0 12px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#315bd9;color:white;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:bold;font-size:13px">View Grievance</a></p><p style="font-size:11px;line-height:1.5;color:#7b879b">Sign in to CGMS if prompted. This link does not grant access by itself.</p></div></div></body></html>`;

  try {
    await mailer.sendMail({ from: process.env.MAIL_FROM, to: recipients, subject, text, html });
    await Promise.all(recipients.map(recipient => deliveryLog({ event, recipient, status: 'SENT', grievanceId: grievance?.id })));
    return true;
  } catch (error) {
    // Avoid logging error.message: SMTP libraries may include connection details.
    console.error('[email] Delivery failed.', { code: error.code || 'SMTP_ERROR', responseCode: error.responseCode || null });
    await Promise.all(recipients.map(recipient => deliveryLog({ event, recipient, status: 'FAILED', safeError: String(error.code || 'SMTP_ERROR').slice(0, 80), grievanceId: grievance?.id })));
    return false;
  }
}

export async function sendAccountCreated({ to, fullName, role, departmentName, temporaryPassword }) {
  if (!to) return false;
  let mailer;
  try { mailer = getTransporter(); } catch (error) {
    console.error('[email] SMTP configuration could not be initialized.', { code: error.code || 'SMTP_CONFIG_ERROR' });
    return false;
  }
  if (!mailer) {
    if (!warnedMissingConfiguration) { console.warn('[email] SMTP not configured; email skipped.'); warnedMissingConfiguration = true; }
    await deliveryLog({ event: 'ACCOUNT_CREATED', recipient: to, status: 'SKIPPED', safeError: 'SMTP_NOT_CONFIGURED' });
    return false;
  }
  let loginUrl;
  try { if (!process.env.CLIENT_URL) throw new Error(); loginUrl = new URL('/login', process.env.CLIENT_URL).toString(); }
  catch { console.error('[email] Account email skipped.', { code: 'INVALID_CLIENT_URL' }); await deliveryLog({ event: 'ACCOUNT_CREATED', recipient: to, status: 'SKIPPED', safeError: 'INVALID_CLIENT_URL' }); return false; }
  const fields = [['Name', fullName], ['Role', role.replaceAll('_', ' ')], ['Department', departmentName || 'Not assigned'], ['Email', to], ['Temporary password', temporaryPassword]];
  const htmlRows = fields.map(([label, value]) => `<tr><th align="left" style="padding:9px 12px;color:#64748b;border-bottom:1px solid #e8edf4">${escapeHtml(label)}</th><td style="padding:9px 12px;color:#17233b;border-bottom:1px solid #e8edf4">${escapeHtml(value)}</td></tr>`).join('');
  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM, to, subject: 'Your CGMS account has been created',
      text: `Hello ${fullName},\n\nYour CGMS account is ready.\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nSign in: ${loginUrl}\nPlease change your temporary password after signing in.`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px"><div style="max-width:620px;margin:auto;background:white;border-radius:12px;overflow:hidden"><header style="background:#1e3a8a;color:white;padding:20px;font-size:20px">CGMS · College Grievance Management System</header><main style="padding:24px"><h1 style="font-size:21px">Your account is ready</h1><p>Hello ${escapeHtml(fullName)}, an administrator created your CGMS account.</p><table style="width:100%;border-collapse:collapse">${htmlRows}</table><p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#315bd9;color:white;text-decoration:none;padding:12px 18px;border-radius:7px">Sign in to CGMS</a></p><p>Please change your temporary password after signing in.</p></main></div></body></html>`
    });
    await deliveryLog({ event: 'ACCOUNT_CREATED', recipient: to, status: 'SENT' });
    return true;
  } catch (error) {
    console.error('[email] Account email delivery failed.', { code: error.code || 'SMTP_ERROR', responseCode: error.responseCode || null });
    await deliveryLog({ event: 'ACCOUNT_CREATED', recipient: to, status: 'FAILED', safeError: String(error.code || 'SMTP_ERROR').slice(0, 80) });
    return false;
  }
}
