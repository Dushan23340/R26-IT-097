import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Camera, CameraOff, Download, EyeOff, FileJson, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { downloadFromAccount, platformApi } from "@/lib/platformApi";
import { useT } from "@/lib/i18n";

// What the webcam is used for, in the same words everywhere it is asked.
function ConsentPoints() {
  const t = useT();
  const points = [
    [Camera, t("During a live class your webcam is read every few seconds to estimate how the lesson is going for you (for example engaged, confused or bored).")],
    [EyeOff, t("Face images are not saved. Only the emotion label is stored; your most recent frame is kept in memory for your teacher's live view and replaced every few seconds.")],
    [ShieldCheck, t("Your teacher uses this to adjust the lesson. You can change your mind at any time in Profile → Privacy.")],
  ];
  return (
    <ul className="space-y-3">
      {points.map(([Icon, text], i) => (
        <li key={i} className="flex gap-3 text-sm">
          <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span className="text-muted-foreground">{text}</span>
        </li>
      ))}
    </ul>
  );
}

// Saves the student's webcam choice and keeps the signed-in user in step.
function useWebcamConsent() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const save = useCallback(
    async (webcam) => {
      setSaving(true);
      try {
        const res = await platformApi.setWebcamConsent(webcam);
        if (res?.user) updateUser?.(res.user);
        return true;
      } catch (err) {
        toast.error(err.message || "Could not save your choice");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [updateUser]
  );
  return { consent: user?.webcamConsent ?? null, save, saving };
}

// Asked before a student's first live class. onDecide(true|false) runs
// after the choice is saved; joining continues either way.
function ConsentDialog({ open, onOpenChange, onDecide }) {
  const t = useT();
  const { save, saving } = useWebcamConsent();
  const decide = async (webcam) => {
    if (await save(webcam)) {
      toast.success(webcam ? t("Thanks - your webcam will be used in this class") : t("OK - you'll join without your webcam"));
      onDecide?.(webcam);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border rounded-3xl max-w-lg">
        <DialogHeader>
          <div className="h-12 w-12 rounded-2xl grid place-items-center bg-primary/10 border border-primary/30 mb-2">
            <Camera className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">{t("Use your webcam in live classes?")}</DialogTitle>
          <DialogDescription>{t("AdaptiveMind can read how a lesson is going for you from your webcam. It's your choice.")}</DialogDescription>
        </DialogHeader>
        <ConsentPoints />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => decide(false)}
            className="h-11 rounded-xl border border-border text-sm font-medium hover:bg-white/5 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <CameraOff className="h-4 w-4" /> {t("Join without webcam")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => decide(true)}
            className="h-11 rounded-xl text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t("I agree, use my webcam")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Shown in place of the webcam panel when the student said no.
function WebcamOffNotice({ onChange }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-center">
      <CameraOff className="h-6 w-6 mx-auto text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{t("Webcam is off")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("You chose not to share your webcam. The class works as normal.")}</p>
      {onChange && (
        <button type="button" onClick={onChange} className="mt-3 text-xs font-semibold text-primary hover:underline">
          {t("Turn webcam on")}
        </button>
      )}
    </div>
  );
}

const DATA_ROWS = [
  ["quizSessions", "Quiz sessions"],
  ["loScores", "Learning-outcome scores"],
  ["emotionReadings", "Emotion readings (labels only)"],
  ["recommendations", "Recommendations"],
  ["liveClasses", "Live classes attended"],
  ["notifications", "Notifications"],
  ["surveys", "Survey answers"],
];

// Profile → Privacy: consent switch, what is stored, download, delete.
function PrivacyPanel() {
  const t = useT();
  const { user, logout } = useAuth();
  const { consent, save, saving } = useWebcamConsent();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteScope, setDeleteScope] = useState(null);
  const isStudent = user?.role === "student";

  const load = useCallback(() => {
    setLoading(true);
    platformApi
      .privacySummary()
      .then(setSummary)
      .catch((err) => toast.error(t("Couldn't load your data summary"), { description: err.message }))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(load, [load]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFromAccount("/privacy/export", "adaptivemind-my-data.json");
      toast.success(t("Your data was downloaded"), { description: t("A JSON file with everything stored about you.") });
    } catch (err) {
      toast.error(t("Download failed"), { description: err.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isStudent && (
        <section className="glass rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> {t("Webcam & emotion recognition")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {consent === null ? t("You haven't been asked yet - you'll be asked before your first live class.") : consent ? t("On - your webcam is used during live classes.") : t("Off - your webcam is never switched on.")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(consent)}
              disabled={saving}
              onClick={async () => {
                const next = !consent;
                if (await save(next)) toast.success(next ? t("Webcam consent given") : t("Webcam consent withdrawn"));
              }}
              className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${consent ? "" : "bg-secondary border border-border"}`}
              style={consent ? { background: "var(--gradient-primary)" } : undefined}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-foreground shadow transition-all duration-300 ${consent ? "left-6" : "left-1"}`} />
              <span className="sr-only">{t("Use my webcam in live classes")}</span>
            </button>
          </div>
          <div className="mt-5">
            <ConsentPoints />
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <FileJson className="h-5 w-5 text-primary" /> {t("What we store about you")}
        </h2>
        {loading ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
        ) : summary ? (
          <div className="cascade mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DATA_ROWS.filter(([key]) => isStudent || ["notifications", "surveys"].includes(key)).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border/60 p-3">
                <div className="text-xl font-bold tnum">{summary.counts?.[key] ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">{t(label)}</div>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-xs text-muted-foreground">{t("Plus your account details (name, e-mail, role). Your password is stored only as a secure hash.")}</p>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-primary/60 hover:bg-white/5 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("Download my data")}
        </button>
      </section>

      <section className="glass rounded-2xl p-6 border border-destructive/30">
        <h2 className="font-display text-lg font-bold flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" /> {t("Delete data")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Deleting can't be undone. Download your data first if you want a copy.")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isStudent && (
            <button type="button" onClick={() => setDeleteScope("learning")} className="rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
              {t("Delete my learning data")}
            </button>
          )}
          <button type="button" onClick={() => setDeleteScope("account")} className="rounded-xl bg-destructive/90 px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive">
            {t("Delete my account")}
          </button>
        </div>
      </section>

      <DeleteDialog
        scope={deleteScope}
        onClose={() => setDeleteScope(null)}
        onDeleted={(scope) => {
          if (scope === "account") {
            toast.success(t("Your account was deleted"), { description: t("All your data has been removed.") });
            logout();
          } else {
            toast.success(t("Your learning data was deleted"));
            load();
          }
        }}
      />
    </div>
  );
}

function DeleteDialog({ scope, onClose, onDeleted }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const word = "DELETE";
  useEffect(() => {
    setPassword("");
    setConfirmText("");
    setError("");
  }, [scope]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return setError(t("Enter your password"));
    if (confirmText.trim().toUpperCase() !== word) return setError(t('Type "{word}" to confirm', { word }));
    setBusy(true);
    setError("");
    try {
      await platformApi.deleteMyData(scope, password);
      onClose();
      onDeleted(scope);
    } catch (err) {
      setError(err.message || t("Could not delete your data"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(scope)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="glass-strong border-border rounded-3xl max-w-md">
        <DialogHeader>
          <div className="h-12 w-12 rounded-2xl grid place-items-center bg-destructive/10 border border-destructive/30 mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-xl">{scope === "account" ? t("Delete your account?") : t("Delete your learning data?")}</DialogTitle>
          <DialogDescription>
            {scope === "account"
              ? t("Your account and everything linked to it - quiz results, emotion readings, recommendations, progress, notifications and survey answers - will be permanently removed.")
              : t("Your quiz results, emotion readings, recommendations, lesson progress and live-class attendance will be permanently removed. Your account stays, and locked quizzes will need a live class again.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div>
            <label htmlFor="delete-password" className="text-sm font-medium">{t("Your password")}</label>
            <input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border px-3 text-sm" />
          </div>
          <div>
            <label htmlFor="delete-confirm" className="text-sm font-medium">{t('Type "{word}" to confirm', { word })}</label>
            <input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="mt-1.5 h-11 w-full rounded-xl border border-border px-3 text-sm tracking-widest" />
          </div>
          {error && <p key={error} className="field-error text-xs text-destructive" role="alert">{error}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-border text-sm font-medium hover:bg-white/5">
              {t("Cancel")}
            </button>
            <button type="submit" disabled={busy} className="h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("Delete permanently")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ConsentDialog, PrivacyPanel, WebcamOffNotice, useWebcamConsent };
