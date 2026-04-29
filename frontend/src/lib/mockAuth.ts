// Mock authentication API handlers
// In production, this should be replaced with actual backend API calls

interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher";
  password: string;
  createdAt: string;
  isVerified: boolean;
}

interface OtpRecord {
  email: string;
  otp: string;
  expiresAt: number;
  purpose: "signup" | "login";
}

// Mock database (in-memory)
const users: User[] = [];
const otpRecords: OtpRecord[] = [];

// Generate random OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate user ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Generate mock token
function generateToken(user: User): string {
  return btoa(`${user.id}:${user.email}:${Date.now()}`);
}

// Mock email sending (in production, use actual email service)
function sendOtpEmail(email: string, otp: string, purpose: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📧 OTP Email Sent to: ${email}`);
  console.log(`📝 Purpose: ${purpose}`);
  console.log(`🔢 OTP Code: ${otp}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // Also show in browser console for testing
  if (typeof window !== "undefined") {
    console.log(`[MOCK EMAIL] OTP for ${email}: ${otp}`);
  }
}

export async function handleAuthRequest(path: string, body: any) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Signup handler
  if (path === "/auth/signup") {
    const { email, password, name, role } = body;

    // Check if user already exists
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return {
        success: false,
        message: "An account with this email already exists",
      };
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP record
    otpRecords.push({
      email,
      otp,
      expiresAt,
      purpose: "signup",
    });

    // Send OTP email
    sendOtpEmail(email, otp, "Account Verification");

    return {
      success: true,
      message: "Account created successfully. Please verify your email with the OTP sent to you.",
      requiresOtp: true,
    };
  }

  // Login handler
  if (path === "/auth/login") {
    const { email, password } = body;

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    // Check password
    if (user.password !== password) {
      return {
        success: false,
        message: "Invalid email or password",
      };
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Generate new OTP
      const otp = generateOtp();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      otpRecords.push({
        email,
        otp,
        expiresAt,
        purpose: "login",
      });

      sendOtpEmail(email, otp, "Login Verification");

      return {
        success: true,
        message: "Please verify your identity with the OTP sent to your email.",
        requiresOtp: true,
      };
    }

    // Generate token
    const token = generateToken(user);

    // Return user data (without password)
    const { password: _, ...userData } = user;

    return {
      success: true,
      message: "Login successful",
      user: userData,
      token,
    };
  }

  // OTP verification handler
  if (path === "/auth/verify-otp") {
    const { email, otp } = body;

    // Find OTP record
    const otpRecord = otpRecords.find(
      (r) => r.email === email && r.otp === otp && r.expiresAt > Date.now()
    );

    if (!otpRecord) {
      return {
        success: false,
        message: "Invalid or expired OTP",
      };
    }

    // Remove used OTP
    const index = otpRecords.indexOf(otpRecord);
    otpRecords.splice(index, 1);

    // Handle signup verification
    if (otpRecord.purpose === "signup") {
      const existingUser = users.find((u) => u.email === email);
      if (!existingUser) {
        return {
          success: false,
          message: "User not found. Please sign up again.",
        };
      }

      // Mark user as verified
      existingUser.isVerified = true;

      // Generate token
      const token = generateToken(existingUser);

      // Return user data (without password)
      const { password: _, ...userData } = existingUser;

      return {
        success: true,
        message: "Email verified successfully",
        user: userData,
        token,
      };
    }

    // Handle login verification
    if (otpRecord.purpose === "login") {
      const user = users.find((u) => u.email === email);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Generate token
      const token = generateToken(user);

      // Return user data (without password)
      const { password: _, ...userData } = user;

      return {
        success: true,
        message: "Login successful",
        user: userData,
        token,
      };
    }

    return {
      success: false,
      message: "Invalid OTP purpose",
    };
  }

  // Resend OTP handler
  if (path === "/auth/resend-otp") {
    const { email } = body;

    // Check if user exists
    const user = users.find((u) => u.email === email);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    // Generate new OTP
    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpRecords.push({
      email,
      otp,
      expiresAt,
      purpose: user.isVerified ? "login" : "signup",
    });

    sendOtpEmail(email, otp, "OTP Resend");

    return {
      success: true,
      message: "OTP sent successfully",
    };
  }

  return {
    success: false,
    message: "Invalid endpoint",
  };
}

// Expose handler to window for API utility to use
if (typeof window !== "undefined") {
  (window as any).__mockAuthHandler = handleAuthRequest;
}
