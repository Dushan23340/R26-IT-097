import nodemailer from "nodemailer";

// Whether real e-mail can be sent. SMTP_USER and SMTP_PASS are blank by
// default in this project's .env; without them every message is printed to
// this service's log instead (see the catch blocks below).
export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Created on first use, not at import time: index.js imports the routes
// (and through them this file) before it calls dotenv.config(), so a
// module-level transporter was always built with empty credentials even
// when .env had them.
let cachedTransporter = null;
function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    });
  }
  return cachedTransporter;
}
const transporter = { sendMail: (message) => getTransporter().sendMail(message) };

const OTP_COPY = {
  signup: {
    subject: "Verify your e-mail - AdaptiveMind",
    heading: "Welcome to AdaptiveMind!",
    body: "Thank you for signing up. Use this code to verify your e-mail address:",
  },
  login: {
    subject: "Verify your e-mail - AdaptiveMind",
    heading: "Verify your e-mail",
    body: "Use this code to verify your e-mail address and finish signing in:",
  },
  reset: {
    subject: "Reset your password - AdaptiveMind",
    heading: "Reset your password",
    body: "We received a request to reset your password. Use this code to choose a new one. If you did not ask for this, ignore this e-mail and your password stays the same.",
  },
};

export async function sendOtpEmail(email, otp, purpose) {
  const copy = OTP_COPY[purpose] || OTP_COPY.login;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00d4d5 0%, #00b8cc 100%); color: #071426; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp { font-size: 36px; font-weight: bold; color: #0f766e; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AdaptiveMind</h1>
          <p>Emotion-Aware Learning Platform</p>
        </div>
        <div class="content">
          <h2>${copy.heading}</h2>
          <p>${copy.body}</p>
          <div class="otp">${otp}</div>
          <p><strong>This code expires in 10 minutes.</strong> Never share it with anyone.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `AdaptiveMind - ${copy.heading}\n\n${copy.body}\n\nYour code is: ${otp}\n\nThis code expires in 10 minutes.`;

  const logToConsole = () => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[E-MAIL NOT SENT - shown here instead] To: ${email}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`Code: ${otp}`);
    console.log(`${"=".repeat(60)}\n`);
  };

  if (!isEmailConfigured()) {
    logToConsole();
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"AdaptiveMind" <${process.env.SMTP_USER}>`,
      to: email,
      subject: copy.subject,
      html,
      text,
    });
    console.log(`E-mail (${purpose}) sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending e-mail:", error.message);
    logToConsole();
    return false;
  }
}

// Generic notification email (as opposed to sendOtpEmail's fixed OTP
// template) - first real caller is routes/users.js's quiz-unlocked
// notification. Same graceful degrade as sendOtpEmail: SMTP creds are
// blank by default in this project's .env, so this logs to console
// instead of throwing/silently dropping the notification.
export async function sendNotificationEmail(to, subject, message) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 AdaptiveMind</h1>
        </div>
        <div class="content">
          <p>${message}</p>
        </div>
        <div class="footer">
          <p>You're receiving this because notifications are enabled in your AdaptiveMind account settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AdaptiveMind" <${process.env.SMTP_FROM || "noreply@adaptivemind.com"}>`,
      to,
      subject,
      html,
      text: message,
    });
    console.log(`✅ Notification email sent to ${to}`);
  } catch (error) {
    console.error("❌ Error sending notification email:", error);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📧 [DEVELOPMENT MODE] Notification for: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    console.log(`💬 Message: ${message}`);
    console.log(`${"=".repeat(60)}\n`);
  }
}

export async function sendTestEmail(to) {
  try {
    await transporter.sendMail({
      from: `"AdaptiveMind" <${process.env.SMTP_FROM || "noreply@adaptivemind.com"}>`,
      to,
      subject: "Test Email - AdaptiveMind",
      html: "<h1>Test Email</h1><p>If you received this, your email configuration is working!</p>",
    });
    return true;
  } catch (error) {
    console.error("Test email failed:", error);
    return false;
  }
}
