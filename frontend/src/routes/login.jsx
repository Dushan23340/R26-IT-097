import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { OtpInput } from "@/components/OtpInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GraduationCap, Mail, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
const Route = createFileRoute("/login")({
  component: LoginPage
});
function LoginPage() {
  const router = useRouter();
  const { login, verifyOtp, resendOtp } = useAuth();
  const [step, setStep] = useState("form");
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!formData.email || !formData.password) {
      setError("Email and password are required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    const result = await login(formData.email, formData.password);
    setIsLoading(false);
    if (result.success) {
      if (result.requiresOtp) {
        setSuccess("Please verify your identity with the OTP sent to your email.");
        setStep("otp");
      } else {
        setSuccess("Login successful! Redirecting...");
        setTimeout(() => {
          router.navigate({ to: "/" });
        }, 1500);
      }
    } else {
      setError(result.message);
    }
  };
  const handleOtpComplete = async (otp) => {
    setError("");
    setIsLoading(true);
    const result = await verifyOtp(formData.email, otp);
    setIsLoading(false);
    if (result.success) {
      setSuccess("Email verified successfully! Redirecting...");
      setTimeout(() => {
        router.navigate({ to: "/" });
      }, 1500);
    } else {
      setError(result.message);
    }
  };
  const handleResendOtp = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    const result = await resendOtp(formData.email);
    setIsLoading(false);
    if (result.success) {
      setSuccess("OTP resent! Please check your email.");
    } else {
      setError(result.message);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background px-4">
      <div className="w-full max-w-md">
        {
    /* Logo */
  }
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold leading-tight">Adaptive<span className="text-gradient-primary">Mind</span></div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome Back</div>
            </div>
          </Link>
        </div>

        {
    /* Card */
  }
        <div className="glass rounded-2xl p-8 shadow-xl">
          {step === "form" ? <>
              <h2 className="text-2xl font-bold mb-2">Sign In</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your credentials to access your account
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {
    /* Email */
  }
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
    id="email"
    type="email"
    placeholder="john@example.com"
    value={formData.email}
    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
    className="h-12"
  />
                </div>

                {
    /* Password */
  }
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
    id="password"
    type="password"
    placeholder="••••••••"
    value={formData.password}
    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
    className="h-12"
  />
                </div>

                {
    /* Error/Success Messages */
  }
                {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>}

                {success && <div className="flex items-center gap-2 text-sm text-emotion-happy bg-emotion-happy/10 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    {success}
                  </div>}

                {
    /* Submit Button */
  }
                <Button
    type="submit"
    disabled={isLoading}
    className="w-full h-12 text-base font-semibold"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </form>

              {
    /* Signup Link */
  }
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </> : <>
              <button
    onClick={() => setStep("form")}
    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
  >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="text-center mb-6">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Verify Your Identity</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{formData.email}</span>
                </p>
              </div>

              <OtpInput length={6} onComplete={handleOtpComplete} />

              {error && <div className="flex items-center justify-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg mt-6">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>}

              {success && <div className="flex items-center justify-center gap-2 text-sm text-emotion-happy bg-emotion-happy/10 p-3 rounded-lg mt-6">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>}

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button
    onClick={handleResendOtp}
    disabled={isLoading}
    className="text-primary hover:underline font-medium disabled:opacity-50"
  >
                    {isLoading ? "Sending..." : "Resend OTP"}
                  </button>
                </p>
              </div>
            </>}
        </div>

        {
    /* Footer */
  }
        <div className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{" "}
          <Link to="/" className="hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>;
}
export {
  Route
};
