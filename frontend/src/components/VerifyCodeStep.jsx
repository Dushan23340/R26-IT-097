import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Notice, replayAnimation } from "@/components/AuthFields";
import { useT } from "@/lib/i18n";

const RESEND_SECONDS = 60;

// Tells the user where their code went. Without SMTP credentials the
// account service prints the code to its own log instead of e-mailing it.
function DeliveryNote({ delivery, email }) {
  const t = useT();
  if (delivery === "server-log") {
    return (
      <div className="flex gap-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs text-amber">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("E-mail sending is not set up on this server, so the code was not e-mailed. Ask the person running AdaptiveMind for the code shown in the account service log.")}</span>
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {t("We sent a 6-digit code to")} <span className="font-medium text-foreground">{email}</span>. {t("It expires in 10 minutes.")}
    </p>
  );
}

// One 6-digit field (easier to paste into and to read aloud than six boxes).
function CodeField({ value, onChange, error, autoFocus = true }) {
  const t = useT();
  return (
    <div>
      <label htmlFor="code" className="block text-sm font-medium mb-1.5">
        {t("6-digit code")}
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-invalid={error ? "true" : undefined}
        className={`h-14 w-full rounded-xl border px-4 text-center text-2xl font-bold tracking-[0.5em] tnum placeholder:text-muted-foreground/40 ${error ? "border-destructive/70" : "border-border"}`}
      />
    </div>
  );
}

// "Resend code" with the same one-minute wait the server enforces.
function ResendLink({ onResend }) {
  const t = useT();
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  const resend = async () => {
    setBusy(true);
    setNote(null);
    const result = await onResend();
    setBusy(false);
    setNote({ ok: Boolean(result?.success), text: result?.success ? t("A new code is on its way.") : result?.message || t("Could not send a new code.") });
    if (result?.success) {
      setWait(RESEND_SECONDS);
      toast.success(t("New code sent"), { description: t("Codes expire after 10 minutes.") });
    } else {
      toast.error(result?.message || t("Could not send a new code."));
    }
  };
  return (
    <div className="text-center text-sm text-muted-foreground">
      {t("Did not get it?")}{" "}
      {wait > 0 ? (
        <span className="tnum">{t("You can ask for a new code in {n}s", { n: wait })}</span>
      ) : (
        <button type="button" onClick={resend} disabled={busy} className="font-semibold text-primary hover:underline disabled:opacity-50">
          {busy ? t("Sending...") : t("Send a new code")}
        </button>
      )}
      {note && <p className={`mt-1 text-xs ${note.ok ? "text-emotion-happy" : "text-destructive"}`} role="status">{note.text}</p>}
    </div>
  );
}

// The "check your e-mail" step shared by sign-up and sign-in.
function VerifyCodeStep({ email, delivery, onVerify, onResend, onBack, backLabel = "Back" }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const verify = async (value) => {
    if (busy) return;
    if (value.length !== 6) {
      setError(t("Enter the 6-digit code"));
      replayAnimation(formRef.current);
      return;
    }
    setBusy(true);
    setError("");
    const result = await onVerify(value);
    setBusy(false);
    if (!result?.success) {
      setError(result?.message || t("That code is not correct."));
      setCode("");
      replayAnimation(formRef.current);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    verify(code);
  };
  // The sixth digit (typed or pasted) submits straight away.
  const onCodeChange = (value) => {
    setCode(value);
    if (error) setError("");
    if (value.length === 6) verify(value);
  };
  return (
    <div>
      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {backLabel === "Back" ? t("Back") : backLabel}
        </button>
      )}
      <div className="mt-4 h-12 w-12 rounded-2xl grid place-items-center bg-primary/10 border border-primary/30">
        <MailCheck className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-4 text-3xl font-bold tracking-tight">{t("Verify your e-mail")}</h2>
      <div className="mt-2">
        <DeliveryNote delivery={delivery} email={email} />
      </div>
      <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-4">
        <CodeField value={code} onChange={onCodeChange} error={error} />
        {error && <Notice>{error}</Notice>}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {busy ? t("Verifying...") : t("Verify and continue")}
        </button>
      </form>
      <div className="mt-5">
        <ResendLink onResend={onResend} />
      </div>
    </div>
  );
}

export { CodeField, DeliveryNote, ResendLink, VerifyCodeStep };
