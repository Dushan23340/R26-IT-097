import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { platformApi } from "@/lib/platformApi";
import { replayAnimation } from "@/components/AuthFields";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { useT } from "@/lib/i18n";

const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Usability survey — AdaptiveMind" }] }),
  component: FeedbackPage,
});

// The ten System Usability Scale statements (Brooke, 1996), with the
// common plain-language wording ("awkward" for "cumbersome", the product's
// name for "this system"). Order and polarity must not change: odd items
// are positive, even items negative - the server scores them that way.
const STATEMENTS = [
  "I think that I would like to use AdaptiveMind frequently.",
  "I found AdaptiveMind unnecessarily complex.",
  "I thought AdaptiveMind was easy to use.",
  "I think that I would need the support of a technical person to be able to use AdaptiveMind.",
  "I found the various functions in AdaptiveMind were well integrated.",
  "I thought there was too much inconsistency in AdaptiveMind.",
  "I would imagine that most people would learn to use AdaptiveMind very quickly.",
  "I found AdaptiveMind very awkward to use.",
  "I felt very confident using AdaptiveMind.",
  "I needed to learn a lot of things before I could get going with AdaptiveMind.",
];
const SCALE = [
  [1, "Strongly disagree"],
  [2, "Disagree"],
  [3, "Neutral"],
  [4, "Agree"],
  [5, "Strongly agree"],
];

function FeedbackPage() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [answers, setAnswers] = useState(Array(10).fill(null));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [previous, setPrevious] = useState(null);
  const [done, setDone] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    platformApi.mySurvey().then(setPrevious).catch(() => {});
  }, []);

  const answered = answers.filter(Boolean).length;
  const setAnswer = (i, v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const submit = async (e) => {
    e.preventDefault();
    const firstBlank = answers.findIndex((a) => !a);
    if (firstBlank !== -1) {
      setMissing(true);
      replayAnimation(formRef.current);
      document.getElementById(`sus-${firstBlank + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.warning(t("Please answer all 10 statements"), { description: t("{n} still need an answer.", { n: 10 - answered }) });
      return;
    }
    setBusy(true);
    try {
      const res = await platformApi.submitSurvey(answers, comment);
      setDone(res);
      toast.success(t("Thank you for your feedback"), { description: t("Your answers have been saved.") });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(t("Your answers weren't saved"), { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="glass rounded-3xl p-10 text-center animate-pop-in">
          <div className="mx-auto h-16 w-16 rounded-2xl grid place-items-center bg-emotion-happy/15 border border-emotion-happy/40">
            <CheckCircle2 className="h-8 w-8 text-emotion-happy" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">{t("Thank you!")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("Your answers help the team measure how easy AdaptiveMind is to use, and what to improve.")}</p>
          <button
            type="button"
            onClick={() => router.navigate({ to: homeFor(user?.role) })}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            {t("Back to home")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <Link to={homeFor(user?.role)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("Back")}
        </Link>
        <p className="eyebrow mt-4 flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5" /> {t("Usability survey · 2 minutes")}
        </p>
        <h1 className="mt-2 text-3xl font-bold">{t("How easy is AdaptiveMind to use?")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("For each statement, choose how much you agree. There are no right or wrong answers - your honest opinion helps us improve the platform. Your name is never shown with your answers.")}
        </p>
        {previous?.submitted && (
          <p className="mt-3 text-xs text-primary">{t("You answered this before. Answering again replaces your earlier answers.")}</p>
        )}
        <div className="mt-5 h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={answered}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${answered * 10}%`, background: "var(--gradient-primary)" }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground tnum">{t("{n} of 10 answered", { n: answered })}</p>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-3">
        {STATEMENTS.map((statement, i) => {
          const blank = missing && !answers[i];
          return (
            <fieldset key={i} id={`sus-${i + 1}`} className={`glass rounded-2xl p-5 scroll-mt-28 border ${answers[i] ? "border-primary/35" : "border-border/60"} ${blank ? "needs-answer" : ""}`}>
              <legend className="sr-only">{t(statement)}</legend>
              <p className="text-sm font-medium">
                <span className="text-primary tnum mr-2">{i + 1}.</span>
                {t(statement)}
              </p>
              <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
                {SCALE.map(([value, label]) => {
                  const selected = answers[i] === value;
                  return (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border px-1 py-2.5 text-center transition-all ${selected ? "border-primary text-primary bg-primary/10 scale-[1.02]" : "border-border/60 hover:border-primary/40"}`}
                    >
                      <input type="radio" name={`sus-${i}`} value={value} checked={selected} onChange={() => setAnswer(i, value)} className="sr-only" />
                      <span className="block text-base font-bold tnum">{value}</span>
                      <span className="block text-[10px] sm:text-[11px] leading-tight text-muted-foreground">{t(label)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="glass rounded-2xl p-5">
          <label htmlFor="sus-comment" className="text-sm font-medium">
            {t("Anything else you'd like to tell us? (optional)")}
          </label>
          <textarea
            id="sus-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            className="mt-2 w-full rounded-xl border border-border p-3 text-sm"
            placeholder={t("What did you like? What was confusing?")}
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground tnum">{comment.length}/1000</p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-12 rounded-xl text-base font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-60"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? t("Sending...") : t("Submit my answers")}
        </button>
      </form>
    </div>
  );
}

export { Route };
