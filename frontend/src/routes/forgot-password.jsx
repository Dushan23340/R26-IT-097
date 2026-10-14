import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AuthLayout } from "@/components/AuthLayout";
import { EMAIL_PATTERN, Field, Notice, PasswordField, PasswordStrength } from "@/components/AuthFields";
import { CodeField, DeliveryNote, ResendLink } from "@/components/VerifyCodeStep";

const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — AdaptiveMind" }] }),
  component: ForgotPasswordPage,
});

const PRIMARY =
  "w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60";

function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState(1); // 1 = ask for e-mail, 2 = code + new password
  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldErrors({ email: "Enter a valid e-mail address" });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const result = await forgotPassword(email.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setDelivery(result.delivery || "email");
    setStep(2);
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError("");
    const errors = {};
    if (code.length !== 6) errors.code = "Enter the 6-digit code";
    if (password.length < 6) errors.password = "Use at least 6 characters";
    if (confirm !== password) errors.confirm = "The two passwords do not match";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    const result = await resetPassword(email.trim(), code, password);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    toast.success("Password changed", { description: "Sign in with your new password." });
    router.navigate({ to: "/login", replace: true });
  };

  return (
    <AuthLayout role="student">
      <div className="glass rounded-3xl p-7 sm:p-9">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <div className="mt-4 h-12 w-12 rounded-2xl grid place-items-center bg-primary/10 border border-primary/30">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>

        {step === 1 ? (
          <>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Forgot your password?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Enter the e-mail of your account. We will send a 6-digit code to reset it.</p>
            <form onSubmit={requestCode} noValidate className="mt-6 space-y-4">
              <Field id="email" label="E-mail address" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
              {error && <Notice>{error}</Notice>}
              <button type="submit" disabled={busy} className={PRIMARY} style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {busy ? "Sending..." : "Send reset code"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Choose a new password</h2>
            <div className="mt-2">
              {delivery === "server-log" ? (
                <DeliveryNote delivery={delivery} email={email} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, a 6-digit code is on its way. It expires in 10 minutes.
                </p>
              )}
            </div>
            <form onSubmit={submitNewPassword} noValidate className="mt-6 space-y-4">
              <div>
                <CodeField value={code} onChange={setCode} error={fieldErrors.code} />
                {fieldErrors.code && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.code}</p>}
              </div>
              <div>
                <PasswordField id="password" label="New password" icon={Lock} autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} />
                <PasswordStrength password={password} />
              </div>
              <PasswordField id="confirm" label="Confirm new password" icon={Lock} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fieldErrors.confirm} />
              {error && <Notice>{error}</Notice>}
              <button type="submit" disabled={busy} className={PRIMARY} style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {busy ? "Saving..." : "Change password"}
              </button>
            </form>
            <div className="mt-5">
              <ResendLink onResend={() => forgotPassword(email.trim())} />
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export { Route };
