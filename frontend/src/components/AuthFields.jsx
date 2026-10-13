import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ id, label, icon: Icon, error, hint, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`h-12 w-full rounded-xl border px-4 text-sm placeholder:text-muted-foreground/70 ${Icon ? "pl-10" : ""} ${error ? "border-destructive/70" : "border-border"}`}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function PasswordField({ id, label, icon: Icon, error, hint, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
        <input
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`h-12 w-full rounded-xl border px-4 pr-12 text-sm placeholder:text-muted-foreground/70 ${Icon ? "pl-10" : ""} ${error ? "border-destructive/70" : "border-border"}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// 0-4: one point each for length >= 8, mixed case, a digit, a symbol.
// Guidance only - the account service's rule is "at least 6 characters".
function passwordScore(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH = [
  ["Too short", "bg-destructive"],
  ["Weak", "bg-destructive"],
  ["Fair", "bg-amber"],
  ["Good", "bg-emotion-happy"],
  ["Strong", "bg-emotion-happy"],
];

function PasswordStrength({ password }) {
  if (!password) return null;
  const score = password.length < 6 ? 0 : Math.max(1, passwordScore(password));
  const [label, colour] = STRENGTH[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full ${n <= score ? colour : "bg-secondary"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{label}</span>
        {score < 3 && password.length >= 6 ? " - add a capital letter, a number or a symbol" : ""}
      </p>
    </div>
  );
}

function Notice({ kind = "error", children }) {
  const ok = kind === "success";
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div role={ok ? "status" : "alert"} className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${ok ? "border-emotion-happy/40 bg-emotion-happy/10 text-emotion-happy" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export { EMAIL_PATTERN, Field, Notice, PasswordField, PasswordStrength };
