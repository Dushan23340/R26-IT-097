import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLES, homeFor } from "@/lib/roles";
import { AuthLayout, RolePicker } from "@/components/AuthLayout";
import { EMAIL_PATTERN, Field, Notice, PasswordField, PasswordStrength } from "@/components/AuthFields";
import { VerifyCodeStep } from "@/components/VerifyCodeStep";

const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — AdaptiveMind" }] }),
  component: SignupPage,
});

function Steps({ step }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progress">
      {["Your role", "Your details", "Verify e-mail"].map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold ${done || current ? "text-primary-foreground" : "text-muted-foreground border border-border"}`}
              style={done || current ? { background: "var(--gradient-primary)" } : undefined}
            >
              {n}
            </span>
            <span className={`${current ? "text-foreground" : "text-muted-foreground hidden sm:inline"}`}>{label}</span>
            {n < 3 && <span className="mx-1 h-px w-4 sm:w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function SignupPage() {
  const router = useRouter();
  const { signup, verifyOtp, resendOtp } = useAuth();
  // Set when the account was created but its e-mail must be verified first.
  const [pending, setPending] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const info = ROLES[form.role];

  // Same rules the account service enforces (validateSignupFields), checked
  // here first so the user sees the problem next to the field.
  const validate = () => {
    const errors = {};
    const name = form.name.trim();
    if (name.length < 2) errors.name = "Enter your full name (at least 2 characters)";
    else if (name.length > 100) errors.name = "Name must be 100 characters or fewer";
    if (!form.email.trim()) errors.email = "Enter your e-mail address";
    else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid e-mail address";
    if (form.password.length < 6) errors.password = "Use at least 6 characters";
    if (!form.confirmPassword) errors.confirmPassword = "Type your password again";
    else if (form.confirmPassword !== form.password) errors.confirmPassword = "The two passwords do not match";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsLoading(true);
    const result = await signup(form.email.trim(), form.password, form.name.trim(), form.role);
    setIsLoading(false);

    if (!result.success) {
      setError(result.message || "Could not create the account. Please try again.");
      return;
    }
    if (result.requiresVerification) {
      setPending({ email: result.email || form.email.trim(), delivery: result.delivery });
      setStep(3);
      return;
    }
    if (result.user && result.token) {
      // Signed in already (lib/auth.jsx keeps the token the sign-up returns).
      toast.success(`Welcome to AdaptiveMind, ${result.user.name?.split(" ")[0] || "there"}`, {
        description: `Your ${result.user.role} account is ready.`,
      });
      setSuccess("Account created.");
      router.navigate({ to: homeFor(result.user.role), replace: true });
    } else {
      toast.success("Account created", { description: "Please sign in." });
      router.navigate({ to: "/login", replace: true });
    }
  };

  return (
    <AuthLayout role={form.role}>
      <div className="glass rounded-3xl p-7 sm:p-9">
        <Steps step={step} />

        {step === 3 && pending ? (
          <div className="mt-4">
            <VerifyCodeStep
              email={pending.email}
              delivery={pending.delivery}
              onResend={() => resendOtp(pending.email)}
              onVerify={async (code) => {
                const verified = await verifyOtp(pending.email, code);
                if (verified.success && verified.user) {
                  toast.success(`Welcome to AdaptiveMind, ${verified.user.name?.split(" ")[0] || "there"}`, {
                    description: `Your ${verified.user.role} account is ready.`,
                  });
                  router.navigate({ to: homeFor(verified.user.role), replace: true });
                }
                return verified;
              }}
            />
          </div>
        ) : step === 1 ? (
          <>
            <h2 className="mt-6 text-3xl font-bold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">First, tell us how you will use AdaptiveMind.</p>
            <div className="mt-6">
              <RolePicker value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              Continue as {info.label.toLowerCase()}
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep(1)} className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Change role
            </button>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {info.label} details
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{info.tagline}.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <Field id="name" label="Full name" icon={User} autoComplete="name" placeholder={form.role === "teacher" ? "Ms. Kumari Silva" : "Nimal Perera"} value={form.name} onChange={set("name")} error={fieldErrors.name} />
              <Field id="email" label="E-mail address" icon={Mail} type="email" autoComplete="email" placeholder={form.role === "teacher" ? "teacher@school.lk" : "you@example.com"} value={form.email} onChange={set("email")} error={fieldErrors.email} />
              <div>
                <PasswordField id="password" label="Password" icon={Lock} autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={set("password")} error={fieldErrors.password} />
                <PasswordStrength password={form.password} />
              </div>
              <PasswordField id="confirmPassword" label="Confirm password" icon={Lock} autoComplete="new-password" placeholder="Type it again" value={form.confirmPassword} onChange={set("confirmPassword")} error={fieldErrors.confirmPassword} />

              {form.role === "student" && (
                <div className="flex gap-3 rounded-xl border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>During live classes your webcam is used to read how the lesson is going for you. No face images are stored.</span>
                </div>
              )}

              {error && <Notice>{error}</Notice>}

              <button
                type="submit"
                disabled={isLoading || Boolean(success)}
                className="w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {isLoading ? "Creating account..." : `Create ${info.label.toLowerCase()} account`}
              </button>
            </form>
          </>
        )}

        <div className="hairline my-6" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export { Route };
