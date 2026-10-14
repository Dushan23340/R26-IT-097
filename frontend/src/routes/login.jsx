import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLES, homeFor } from "@/lib/roles";
import { AuthLayout, RolePicker } from "@/components/AuthLayout";
import { EMAIL_PATTERN, Field, Notice, PasswordField, replayAnimation, useLiveValidation } from "@/components/AuthFields";
import { useT } from "@/lib/i18n";
import { VerifyCodeStep } from "@/components/VerifyCodeStep";

const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — AdaptiveMind" }] }),
  component: LoginPage,
});

function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { login, verifyOtp, resendOtp } = useAuth();
  // Set when the password was right but the e-mail is not verified yet.
  const [pending, setPending] = useState(null);
  // The role tab only changes what this screen shows. The account itself
  // decides the role: after sign-in the user always lands on the home of the
  // role their account really has.
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const cardRef = useRef(null);
  const form = useLiveValidation(
    ({ email, password }) => {
      const errors = {};
      if (!email.trim()) errors.email = t("Enter your e-mail address");
      else if (!EMAIL_PATTERN.test(email.trim())) errors.email = t("Enter a valid e-mail address");
      if (!password) errors.password = t("Enter your password");
      return errors;
    },
    { email, password }
  );
  const fieldErrors = form.errors;
  // "?expired=1" is set by lib/authHeaders.js when a saved session's token
  // was rejected, so the user knows why they are back on this page.
  const [error, setError] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expired")
      ? t("Your session has expired. Please sign in again.")
      : ""
  );
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.check()) {
      replayAnimation(cardRef.current);
      return;
    }

    setIsLoading(true);
    const result = await login(email.trim(), password);
    setIsLoading(false);

    if (result.requiresVerification) {
      setPending({ email: result.email || email.trim(), delivery: result.delivery });
      return;
    }
    if (!result.success || !result.user) {
      setError(result.message || t("Sign in failed. Please try again."));
      replayAnimation(cardRef.current);
      return;
    }
    finishSignIn(result.user);
  };

  const finishSignIn = (signedInUser) => {
    // The route guard moves a signed-in user off this page at once, so the
    // confirmation is a toast (it stays visible across the redirect).
    const result = { user: signedInUser };
    const actualRole = result.user.role;
    const destination = actualRole === "teacher" ? t("Teacher Console") : t("dashboard");
    if (actualRole !== role && ROLES[actualRole]) {
      toast.info(t(`This is a ${ROLES[actualRole].label.toLowerCase()} account`), { description: t("Opening your {destination}.", { destination }) });
    } else {
      toast.success(t("Welcome back, {name}", { name: result.user.name?.split(" ")[0] || "" }), { description: t("Opening your {destination}.", { destination }) });
    }
    setSuccess("Signed in.");
    router.navigate({ to: homeFor(actualRole), replace: true });
  };

  return (
    <AuthLayout role={role}>
      <div ref={cardRef} className="glass rounded-3xl p-7 sm:p-9">
        {pending ? (
          <VerifyCodeStep
            email={pending.email}
            delivery={pending.delivery}
            backLabel={t("Back to sign in")}
            onBack={() => setPending(null)}
            onResend={() => resendOtp(pending.email)}
            onVerify={async (code) => {
              const verified = await verifyOtp(pending.email, code);
              if (verified.success && verified.user) finishSignIn(verified.user);
              return verified;
            }}
          />
        ) : (<>
        <p className="eyebrow">{t("Welcome back")}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("Sign in")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("Choose how you use AdaptiveMind, then enter your details.")}</p>

        <div className="mt-6">
          <RolePicker value={role} onChange={setRole} compact />
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <Field
            id="email"
            label={t("E-mail address")}
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder={role === "teacher" ? "teacher@school.lk" : "you@example.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={form.blur("email")}
            error={fieldErrors.email}
            valid={form.valid("email")}
          />
          <PasswordField
            id="password"
            label={t("Password")}
            icon={Lock}
            autoComplete="current-password"
            placeholder={t("Your password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <div className="-mt-1 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              {t("Forgot password?")}
            </Link>
          </div>

          {error && <Notice>{error}</Notice>}

          <button
            type="submit"
            disabled={isLoading || Boolean(success)}
            className="w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isLoading ? t("Signing in...") : t(`Sign in as ${ROLES[role].label.toLowerCase()}`)}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="hairline my-6" />
        <p className="text-center text-sm text-muted-foreground">
          {t("New to AdaptiveMind?")}{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            {t("Create an account")}
          </Link>
        </p>
        </>)}
      </div>
    </AuthLayout>
  );
}

export { Route };
