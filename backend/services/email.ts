import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('⚠️  Email transporter error:', error);
    console.log('📝 Using console logging for OTP codes (development mode)');
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email with OTP code
 */
export async function sendOtpEmail(email: string, otp: string, purpose: 'signup' | 'login'): Promise<void> {
  const subject = purpose === 'signup' 
    ? 'Verify Your Email - AdaptiveMind' 
    : 'Login Verification - AdaptiveMind';

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
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 AdaptiveMind</h1>
          <p>Emotion-Aware Learning Platform</p>
        </div>
        <div class="content">
          <h2>${purpose === 'signup' ? 'Welcome to AdaptiveMind!' : 'Login Verification'}</h2>
          <p>${purpose === 'signup' 
            ? 'Thank you for signing up! Please use the following OTP code to verify your email address:' 
            : 'We received a login request for your account. Please use the following OTP code to complete your login:'
          }</p>
          
          <div class="otp">${otp}</div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          
          ${purpose === 'signup' 
            ? '<p>Once verified, you will have full access to your adaptive learning dashboard.</p>'
            : '<p>For security reasons, never share this code with anyone.</p>'
          }
          
          <div class="footer">
            <p>&copy; 2024 AdaptiveMind. All rights reserved.</p>
            <p>SLIIT R26-IT-097</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    AdaptiveMind - Email Verification
    
    Your OTP code is: ${otp}
    
    This code will expire in 10 minutes.
    
    If you didn't request this code, please ignore this email.
  `;

  try {
    await transporter.sendMail({
      from: `"AdaptiveMind" <${process.env.SMTP_FROM || 'noreply@adaptivemind.com'}>`,
      to: email,
      subject,
      html,
      text,
    });
    
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Fallback: Log OTP to console for development
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 [DEVELOPMENT MODE] OTP Email for: ${email}`);
    console.log(`📝 Purpose: ${purpose}`);
    console.log(`🔢 OTP Code: ${otp}`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"AdaptiveMind" <${process.env.SMTP_FROM || 'noreply@adaptivemind.com'}>`,
      to,
      subject: 'Test Email - AdaptiveMind',
      html: '<h1>Test Email</h1><p>If you received this, your email configuration is working!</p>',
    });
    return true;
  } catch (error) {
    console.error('Test email failed:', error);
    return false;
  }
}
