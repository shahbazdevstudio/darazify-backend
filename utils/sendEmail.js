const nodemailer = require('nodemailer');

/** Sends an email via SMTP. In development without SMTP, prints the message to the console. */
const sendEmail = async ({ to, subject, html, text }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, NODE_ENV } = process.env;

  if (!SMTP_HOST) {
    if (NODE_ENV === 'production') throw new Error('SMTP is not configured');
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { dev: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, html, text });
};

module.exports = sendEmail;
