import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

transporter.verify((error) => {
  if (error) {
    console.log("⚠️  Email transporter error:", error);
    console.log("📝 Using console logging for OTP codes (development mode)");
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

export async function sendOtpEmail(email, otp, purpose) {
  const subject =
    purpose === "signup" ? "Verify Your Email - AdaptiveMind" : "Login Verification - AdaptiveMind";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp { font-size: 36px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 AdaptiveMind</h1>
          <p>Emotion-Aware Learning Platform</p>
        </div>
        <div class="content">
          <h2>${purpose === "signup" ? "Welcome to AdaptiveMind!" : "Login Verification"}</h2>
          <p>${
            purpose === "signup"
              ? "Thank you for signing up! Please use the following OTP code to verify your email address:"
              : "We received a login request for your account. Please use the following OTP code to complete your login:"
          }</p>
          <div class="otp">${otp}</div>
          <p><strong>This code will expire in 10 minutes.</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    AdaptiveMind - Email Verification
    Your OTP code is: ${otp}
    This code will expire in 10 minutes.
  `;

  try {
    await transporter.sendMail({
      from: `"AdaptiveMind" <${process.env.SMTP_FROM || "noreply@adaptivemind.com"}>`,
      to: email,
      subject,
      html,
      text,
    });

    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📧 [DEVELOPMENT MODE] OTP Email for: ${email}`);
    console.log(`📝 Purpose: ${purpose}`);
    console.log(`🔢 OTP Code: ${otp}`);
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
