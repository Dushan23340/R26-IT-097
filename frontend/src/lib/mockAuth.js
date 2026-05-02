const users = [];
const otpRecords = [];
function generateOtp() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}
function generateToken(user) {
  return btoa(`${user.id}:${user.email}:${Date.now()}`);
}
function sendOtpEmail(email, otp, purpose) {
  console.log(`
${"=".repeat(60)}`);
  console.log(`\u{1F4E7} OTP Email Sent to: ${email}`);
  console.log(`\u{1F4DD} Purpose: ${purpose}`);
  console.log(`\u{1F522} OTP Code: ${otp}`);
  console.log(`${"=".repeat(60)}
`);
  if (typeof window !== "undefined") {
    console.log(`[MOCK EMAIL] OTP for ${email}: ${otp}`);
  }
}
async function handleAuthRequest(path, body) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (path === "/auth/signup") {
    const { email, password, name, role } = body;
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return {
        success: false,
        message: "An account with this email already exists"
      };
    }
    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    otpRecords.push({
      email,
      otp,
      expiresAt,
      purpose: "signup"
    });
    sendOtpEmail(email, otp, "Account Verification");
    return {
      success: true,
      message: "Account created successfully. Please verify your email with the OTP sent to you.",
      requiresOtp: true
    };
  }
  if (path === "/auth/login") {
    const { email, password } = body;
    const user = users.find((u) => u.email === email);
    if (!user) {
      return {
        success: false,
        message: "Invalid email or password"
      };
    }
    if (user.password !== password) {
      return {
        success: false,
        message: "Invalid email or password"
      };
    }
    if (!user.isVerified) {
      const otp = generateOtp();
      const expiresAt = Date.now() + 10 * 60 * 1e3;
      otpRecords.push({
        email,
        otp,
        expiresAt,
        purpose: "login"
      });
      sendOtpEmail(email, otp, "Login Verification");
      return {
        success: true,
        message: "Please verify your identity with the OTP sent to your email.",
        requiresOtp: true
      };
    }
    const token = generateToken(user);
    const { password: _, ...userData } = user;
    return {
      success: true,
      message: "Login successful",
      user: userData,
      token
    };
  }
  if (path === "/auth/verify-otp") {
    const { email, otp } = body;
    const otpRecord = otpRecords.find(
      (r) => r.email === email && r.otp === otp && r.expiresAt > Date.now()
    );
    if (!otpRecord) {
      return {
        success: false,
        message: "Invalid or expired OTP"
      };
    }
    const index = otpRecords.indexOf(otpRecord);
    otpRecords.splice(index, 1);
    if (otpRecord.purpose === "signup") {
      const existingUser = users.find((u) => u.email === email);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found. Please sign up again."
        };
      }
      existingUser.isVerified = true;
      const token = generateToken(existingUser);
      const { password: _, ...userData } = existingUser;
      return {
        success: true,
        message: "Email verified successfully",
        user: userData,
        token
      };
    }
    if (otpRecord.purpose === "login") {
      const user = users.find((u) => u.email === email);
      if (!user) {
        return {
          success: false,
          message: "User not found"
        };
      }
      const token = generateToken(user);
      const { password: _, ...userData } = user;
      return {
        success: true,
        message: "Login successful",
        user: userData,
        token
      };
    }
    return {
      success: false,
      message: "Invalid OTP purpose"
    };
  }
  if (path === "/auth/resend-otp") {
    const { email } = body;
    const user = users.find((u) => u.email === email);
    if (!user) {
      return {
        success: false,
        message: "User not found"
      };
    }
    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    otpRecords.push({
      email,
      otp,
      expiresAt,
      purpose: user.isVerified ? "login" : "signup"
    });
    sendOtpEmail(email, otp, "OTP Resend");
    return {
      success: true,
      message: "OTP sent successfully"
    };
  }
  return {
    success: false,
    message: "Invalid endpoint"
  };
}
if (typeof window !== "undefined") {
  window.__mockAuthHandler = handleAuthRequest;
}
export {
  handleAuthRequest
};
