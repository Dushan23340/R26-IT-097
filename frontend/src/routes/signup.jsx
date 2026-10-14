import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLES, homeFor } from "@/lib/roles";
import { AuthLayout, RolePicker } from "@/components/AuthLayout";
import { EMAIL_PATTERN, Field, Notice, PasswordField, PasswordStrength, replayAnimation, useLiveValidation } from "@/components/AuthFields";
import { useT } from "@/lib/i18n";
import { VerifyCodeStep } from "@/components/VerifyCodeStep";

const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — AdaptiveMind" }] }),
  component: SignupPage,
});

function Steps({ step }) {
  const t = useT();
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progress">
      {[t("Your role"), t("Your details"), t("Verify e-mail")].map((label, i) => {
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
  const t = useT();
  const router = useRouter();
  const { signup, verifyOtp, resendOtp } = useAuth();
  // Set when the account was created but its e-mail must be verified first.
  const [pending, setPending] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "student" });
  const cardRef = useRef(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const info = ROLES[form.role];

  // Same rules the account service enforces (validateSignupFields), checked
  // here first so the user sees the problem next to the field.
  const validate = (form) => {
    const errors = {};
    const name = form.name.trim();
    if (name.length < 2) errors.name = t("Enter your full name (at least 2 characters)");
    else if (name.length > 100) errors.name = t("Name must be 100 characters or fewer");
    if (!form.email.trim()) errors.email = t("Enter your e-mail address");
    else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = t("Enter a valid e-mail address");
    if (form.password.length < 6) errors.password = t("Use at least 6 characters");
    if (!form.confirmPassword) errors.confirmPassword = t("Type your password again");
    else if (form.confirmPassword !== form.password) errors.confirmPassword = t("The two passwords do not match");
    return errors;
  };
  const live = useLiveValidation(validate, form);
  const fieldErrors = live.errors;
  const fieldProps = (key) => ({ onBlur: live.blur(key), error: fieldErrors[key], valid: live.valid(key) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!live.check()) {
      replayAnimation(cardRef.current);
      return;
    }

    setIsLoading(true);
    const result = await signup(form.email.trim(), form.password, form.name.trim(), form.role);
    setIsLoading(false);

    if (!result.success) {
      setError(result.message || t("Could not create the account. Please try again."));
      replayAnimation(cardRef.current);
      return;
    }
    if (result.requiresVerification) {
      setPending({ email: result.email || form.email.trim(), delivery: result.delivery });
      setStep(3);
      return;
    }
    if (result.user && result.token) {
      // Signed in already (lib/auth.jsx keeps the token the sign-up returns).
      toast.success(t("Welcome to AdaptiveMind, {name}", { name: result.user.name?.split(" ")[0] || "" }), {
        description: t(`Your ${result.user.role} account is ready.`),
      });
      setSuccess("Account created.");
      router.navigate({ to: homeFor(result.user.role), replace: true });
    } else {
      toast.success(t("Account created"), { description: t("Please sign in.") });
      router.navigate({ to: "/login", replace: true });
    }
  };

  return (
    <AuthLayout role={form.role}>
      <div ref={cardRef} className="glass rounded-3xl p-7 sm:p-9">
        <Steps step={step} />

        {step === 3 && pending ? (
          <div key="verify" className="mt-4 page-enter">
            <VerifyCodeStep
              email={pending.email}
              delivery={pending.delivery}
              onResend={() => resendOtp(pending.email)}
              onVerify={async (code) => {
                const verified = await verifyOtp(pending.email, code);
                if (verified.success && verified.user) {
                  toast.success(t("Welcome to AdaptiveMind, {name}", { name: verified.user.name?.split(" ")[0] || "" }), {
                    description: t(`Your ${verified.user.role} account is ready.`),
                  });
                  router.navigate({ to: homeFor(verified.user.role), replace: true });
                }
                return verified;
              }}
            />
          </div>
        ) : step === 1 ? (
          <div key="role" className="page-enter">
            <h2 className="mt-6 text-3xl font-bold tracking-tight">{t("Create your account")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("First, tell us how you will use AdaptiveMind.")}</p>
            <div className="mt-6">
              <RolePicker value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {t(`Continue as ${info.label.toLowerCase()}`)}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div key="details" className="page-enter">
            <button type="button" onClick={() => setStep(1)} className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {t("Change role")}
            </button>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t(`${info.label} details`)}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(info.tagline)}.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <Field id="name" label={t("Full name")} icon={User} autoComplete="name" placeholder={form.role === "teacher" ? "Ms. Kumari Silva" : "Nimal Perera"} value={form.name} onChange={set("name")} {...fieldProps("name")} />
              <Field id="email" label={t("E-mail address")} icon={Mail} type="email" autoComplete="email" placeholder={form.role === "teacher" ? "teacher@school.lk" : "you@example.com"} value={form.email} onChange={set("email")} {...fieldProps("email")} />
              <div>
                <PasswordField id="password" label={t("Password")} icon={Lock} autoComplete="new-password" placeholder={t("At least 6 characters")} value={form.password} onChange={set("password")} onBlur={live.blur("password")} error={fieldErrors.password} />
                <PasswordStrength password={form.password} />
              </div>
              <PasswordField id="confirmPassword" label={t("Confirm password")} icon={Lock} autoComplete="new-password" placeholder={t("Type it again")} value={form.confirmPassword} onChange={set("confirmPassword")} {...fieldProps("confirmPassword")} />

              {form.role === "student" && (
                <div className="flex gap-3 rounded-xl border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{t("During live classes your webcam is used to read how the lesson is going for you. No face images are stored.")}</span>
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
                {isLoading ? t("Creating account...") : t(`Create ${info.label.toLowerCase()} account`)}
              </button>
            </form>
          </div>
        )}

        <div className="hairline my-6" />
        <p className="text-center text-sm text-muted-foreground">
          {t("Already have an account?")}{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t("Sign in")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export { Route };
