const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function isConfigured() {
  return !!(config.smtp.host && config.smtp.user);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const from = config.mailFrom;
  const t = getTransporter();
  if (!t) {
    console.log('[mailer] SMTP nicht konfiguriert — Mail nur geloggt:');
    console.log(`  from:    ${from}`);
    console.log(`  to:      ${to}`);
    console.log(`  subject: ${subject}`);
    console.log(`  replyTo: ${replyTo || '-'}`);
    console.log(`  text:    ${(text || '').split('\n').slice(0, 5).join(' | ')}`);
    return { simulated: true };
  }
  const info = await t.sendMail({ from, to, subject, text, html, replyTo });
  return { simulated: false, messageId: info.messageId };
}

module.exports = { sendMail, isConfigured };
