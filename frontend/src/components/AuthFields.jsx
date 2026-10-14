import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Live validation for a small form. Errors stay hidden until the user has
// left a field with something typed in it (or pressed submit), then follow
// every keystroke - so a fixed mistake clears at once instead of waiting
// for the next submit.
function useLiveValidation(validate, values) {
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState({});
  const all = validate(values);
  const shown = (key) => attempted || touched[key];
  const errors = Object.fromEntries(Object.entries(all).filter(([key]) => shown(key)));
  const valid = (key) => shown(key) && !all[key] && Boolean(String(values[key] ?? "").trim());
  const blur = useCallback(
    (key) => (e) => {
      // Focus moving to a submit button: let the submit reveal everything.
      // Showing this field's error now would push the button down between
      // mouse-down and mouse-up, and the click would miss it.
      // (Safari does not focus buttons on click, so the short delay covers
      // that case: the click finishes before the layout moves.)
      if (e.relatedTarget?.type === "submit") return;
      if (!String(e.target.value ?? "").trim()) return;
      setTimeout(() => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), 180);
    },
    []
  );
  // Call on submit: reveals every error and returns true when the form is clean.
  const check = () => {
    setAttempted(true);
    return Object.keys(all).length === 0;
  };
  const reset = () => {
    setAttempted(false);
    setTouched({});
  };
  return { errors, valid, blur, check, reset };
}

// Re-runs a CSS animation (e.g. "shake") on an element each time it is called.
function replayAnimation(el, className = "shake") {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth; // restart the animation
  el.classList.add(className);
}

function FieldMessage({ id, error, hint }) {
  if (error) {
    return (
      <p id={`${id}-error`} key={error} className="field-error mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    );
  }
  return hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null;
}

function Field({ id, label, icon: Icon, error, hint, valid, ...props }) {
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
          className={`h-12 w-full rounded-xl border px-4 text-sm placeholder:text-muted-foreground/70 ${Icon ? "pl-10" : ""} ${valid ? "pr-10" : ""} ${error ? "border-destructive/70" : "border-border"}`}
          {...props}
        />
        {valid && !error && (
          <CheckCircle2 aria-hidden="true" className="field-valid-icon pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emotion-happy" />
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

function PasswordField({ id, label, icon: Icon, error, hint, valid, ...props }) {
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
          className={`h-12 w-full rounded-xl border px-4 ${valid ? "pr-20" : "pr-12"} text-sm placeholder:text-muted-foreground/70 ${Icon ? "pl-10" : ""} ${error ? "border-destructive/70" : "border-border"}`}
          {...props}
        />
        {valid && !error && (
          <CheckCircle2 aria-hidden="true" className="field-valid-icon pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 h-4 w-4 text-emotion-happy" />
        )}
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
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
          <span key={n} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${n <= score ? colour : "bg-secondary"}`} />
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
    <div role={ok ? "status" : "alert"} className={`animate-pop-in flex items-start gap-2.5 rounded-xl border p-3 text-sm ${ok ? "border-emotion-happy/40 bg-emotion-happy/10 text-emotion-happy" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export { EMAIL_PATTERN, Field, Notice, PasswordField, PasswordStrength, replayAnimation, useLiveValidation };
