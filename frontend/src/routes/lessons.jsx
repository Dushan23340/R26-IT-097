import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Trophy,
  Youtube,
  FileText,
  MousePointerClick,
  ClipboardList,
  ExternalLink,
  Circle,
  TrendingUp,
  Lock,
  Monitor,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { useAuth } from "@/lib/auth";

const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Adaptive Learning — AdaptiveMind" },
      {
        name: "description",
        content: "Take a real lesson quiz and get Bloom's-taxonomy mastery scoring with emotion-aware resource recommendations.",
      },
    ],
  }),
  // Optional ?lesson_id= - set when a student arrives here via the
  // Teacher Console's "Start Quiz" broadcast prompt (StudentDashboard.jsx),
  // so the quiz starts immediately instead of landing on the lesson list.
  validateSearch: (search) => ({
    lesson_id: typeof search.lesson_id === "string" ? search.lesson_id : undefined,
  }),
  component: LessonsPage,
});

const LO_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

const RESOURCE_TYPE_ICONS = {
  video: Youtube,
  reading: FileText,
  interactive: MousePointerClick,
  quiz: ClipboardList,
};

// In-progress/completed quiz state only ever lived in React state, so any
// page refresh silently wiped it - including resource-completion progress
// gating the retake. Persisted per-student in localStorage instead.
const PROGRESS_STORAGE_PREFIX = "adaptive-lessons-progress:";

function loadProgress(studentId) {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_PREFIX + studentId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, completedResourceIds: new Set(parsed.completedResourceIds || []) };
  } catch {
    return null;
  }
}

function saveProgress(studentId, progress) {
  try {
    localStorage.setItem(
      PROGRESS_STORAGE_PREFIX + studentId,
      JSON.stringify({ ...progress, completedResourceIds: Array.from(progress.completedResourceIds) })
    );
  } catch {
    // localStorage unavailable (private browsing / quota) - progress just won't survive a refresh
  }
}

function clearProgress(studentId) {
  localStorage.removeItem(PROGRESS_STORAGE_PREFIX + studentId);
}

function LessonsPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const autoStartRanRef = useRef(false);
  const [screen, setScreen] = useState("select"); // select | quiz | results
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState(null);

  // lesson_id -> { completed, dominant_emotion, quiz_unlocked, can_take_quiz }
  // - a lesson's quiz requires attending its live class AND a teacher
  // unlocking it. Fetched once lessons load; a lesson absent here (still
  // loading, or the fetch failed) is treated as inaccessible, not open.
  const [access, setAccess] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  // Resource completion is gated: the retake quiz only unlocks once every
  // recommended resource for this attempt's weak LOs has been marked done.
  // Session-local only (no backend persistence) - resets on a fresh lesson.
  const [completedResourceIds, setCompletedResourceIds] = useState(new Set());
  // Set right before a same-lesson retake, so the results screen can show
  // a before/after comparison instead of just the flat LO grid.
  const [previousResult, setPreviousResult] = useState(null);
  // How many times this lesson has been attempted (1 = first attempt, +1
  // per retake). Persisted alongside the rest of the progress blob so the
  // "you've tried N times, get help" escalation survives a refresh /
  // re-login. Reset when the student switches to a different lesson.
  const [attemptCount, setAttemptCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const hydrationRanRef = useRef(false);
  const studentId = String(user?.id ?? user?._id ?? user?.email ?? "anonymous");
  // Real quiz-taking duration, for the engagement metrics pushed to
  // analytics-service (time_on_task_seconds) - not persisted across a
  // refresh since it's only meaningful for the in-progress attempt.
  const quizStartedAtRef = useRef(null);

  useEffect(() => {
    adaptiveApiService
      .getLessons()
      .then((res) => setLessons(res.data || []))
      .catch((e) => setError(e.message || "Failed to load lessons"))
      .finally(() => setLoadingLessons(false));
  }, []);

  // Live-class-gated quiz access, one lookup per lesson - drives the
  // locked/unlocked state of each lesson card below. Re-fetched whenever
  // the lesson list changes; doesn't re-poll on an interval, so a teacher
  // unlocking mid-visit needs a page refresh to reflect here (acceptable -
  // this mirrors how the rest of this page already treats lesson data as
  // load-once, not live).
  useEffect(() => {
    if (lessons.length === 0) return;
    let cancelled = false;
    Promise.all(
      lessons.map((lesson) =>
        adaptiveApiService
          .getLessonAccess(lesson.lesson_id, studentId)
          .then((res) => [lesson.lesson_id, res.data])
          .catch(() => [lesson.lesson_id, null])
      )
    ).then((pairs) => {
      if (cancelled) return;
      setAccess(Object.fromEntries(pairs.filter(([, data]) => data != null)));
    });
    return () => {
      cancelled = true;
    };
  }, [lessons, studentId]);

  // Restore any saved quiz/results/resource-completion progress once the
  // real student id is known, so a refresh doesn't drop back to "select".
  // localStorage is the fast path (also the only one that can resume a
  // half-finished quiz); if it has nothing usable we fall back to the
  // server copy (adaptiveApiService.getAttemptState), which is what
  // survives logging back in on a different laptop or a cleared cache.
  useEffect(() => {
    if (!user || hydrationRanRef.current) return;
    hydrationRanRef.current = true;
    const saved = loadProgress(studentId);
    // A saved "quiz"/"results" screen with no matching quiz/result object
    // (e.g. a partial/corrupted write, or a schema from an older version
    // of this page) isn't usable - select/quiz/results render branches are
    // each gated on their own data being present, so restoring a bare
    // screen value would render nothing at all.
    const localUsable =
      saved && ((saved.screen === "quiz" && saved.quiz) || (saved.screen === "results" && saved.result));
    if (localUsable) {
      setScreen(saved.screen);
      setQuiz(saved.quiz ?? null);
      setAnswers(saved.answers ?? {});
      setResult(saved.result ?? null);
      setPreviousResult(saved.previousResult ?? null);
      setCompletedResourceIds(saved.completedResourceIds ?? new Set());
      setAttemptCount(saved.attemptCount ?? 0);
      setHydrated(true);
      return;
    }
    // No usable local progress - try the server copy. Only the completed
    // results screen is stored there (a mid-quiz attempt can't be resumed
    // cross-device anyway).
    adaptiveApiService
      .getAttemptState(studentId)
      .then((res) => {
        const remote = res?.data;
        if (remote && remote.screen === "results" && remote.result) {
          setScreen("results");
          setResult(remote.result);
          setPreviousResult(remote.previous_result ?? null);
          setCompletedResourceIds(new Set(remote.completed_resource_ids ?? []));
          setAttemptCount(remote.attempt_count ?? 0);
          // Stub so "Retake Quiz" (retakeLesson -> startLesson(quiz.lesson_id, 2))
          // still works after a cross-device restore, where the full quiz
          // object was never persisted. startLesson replaces it with the
          // real fetched quiz.
          if (remote.lesson_id) setQuiz({ lesson_id: remote.lesson_id });
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, [user, studentId]);

  // Only persist once hydration has run (and applied) so we never overwrite
  // saved progress with the pre-hydration default/empty state.
  useEffect(() => {
    if (!hydrated) return;

    // "Back to Lessons" from either the quiz or the results screen is a
    // *pause*, not an abandon - the student keeps their place so
    // re-opening the lesson resumes it (a half-finished quiz, or a results
    // screen whose recommended resources aren't all ticked off yet).
    const hasResults = !!result && !!quiz; // finished attempt + its recs
    const hasPausedQuiz = !!quiz && !result; // mid-quiz, not submitted

    if (screen === "select" && !hasResults && !hasPausedQuiz) {
      clearProgress(studentId);
      adaptiveApiService.clearAttemptState(studentId).catch(() => {});
      return;
    }

    // localStorage always stores a *resumable* screen, never bare "select".
    const resumableScreen = screen !== "select" ? screen : hasResults ? "results" : "quiz";
    saveProgress(studentId, {
      screen: resumableScreen,
      quiz,
      answers,
      result,
      previousResult,
      completedResourceIds,
      attemptCount,
    });

    // Server copy - only the results screen is worth syncing cross-device
    // (a mid-quiz attempt can't be resumed on another device anyway).
    if (hasResults) {
      adaptiveApiService
        .saveAttemptState(studentId, {
          screen: "results",
          lesson_id: quiz?.lesson_id ?? result?.lesson_id ?? null,
          result,
          previous_result: previousResult,
          completed_resource_ids: Array.from(completedResourceIds),
          attempt_count: attemptCount,
        })
        .catch(() => {});
    }
  }, [hydrated, studentId, screen, quiz, answers, result, previousResult, completedResourceIds, attemptCount]);

  // quizSet 1 = first attempt at this lesson; 2 = every retake thereafter
  // (retakeLesson always requests 2 - a different set of questions per LO
  // so answers can't just be remembered from the first attempt).
  async function startLesson(lessonId, quizSet = 1) {
    // Re-opening a lesson the student has paused work on (via "Back to
    // Lessons") resumes where they left off instead of restarting:
    //   - a finished attempt with unfinished recommendations -> results
    //   - a half-answered quiz                                -> quiz
    // quizSet === 1 only; a retake (set 2, from the results screen) always
    // pulls fresh questions.
    if (quizSet === 1 && screen === "select" && quiz?.lesson_id === lessonId) {
      setScreen(result ? "results" : "quiz");
      return;
    }
    // Any other lesson (or a forced fresh start) - drop the paused work
    // for the previous lesson first, since only one slot is tracked.
    if (quizSet === 1 && (quiz || result)) {
      setQuiz(null);
      setResult(null);
      setPreviousResult(null);
      setCompletedResourceIds(new Set());
      setAttemptCount(0);
      clearProgress(studentId);
      adaptiveApiService.clearAttemptState(studentId).catch(() => {});
    }
    setError(null);
    setLoadingQuiz(true);
    setAnswers({});
    setResult(null);
    try {
      const res = await adaptiveApiService.getLessonQuiz(lessonId, quizSet, studentId);
      setQuiz(res.data);
      setScreen("quiz");
      quizStartedAtRef.current = Date.now();
    } catch (e) {
      setError(e.message || "Failed to load quiz");
    } finally {
      setLoadingQuiz(false);
    }
  }

  // Auto-start when arriving via the Teacher Console's "Start Quiz"
  // broadcast (?lesson_id=...) - only once, and only if hydration didn't
  // already restore an in-progress/completed quiz (screen === "select"),
  // so a student who's already mid-quiz isn't yanked out of it.
  useEffect(() => {
    if (autoStartRanRef.current) return;
    if (!hydrated || loadingLessons) return;
    if (!search.lesson_id || screen !== "select") return;
    autoStartRanRef.current = true;
    startLesson(search.lesson_id);
    navigate({ search: {}, replace: true });
  }, [hydrated, loadingLessons, search.lesson_id, screen]);

  function selectAnswer(questionId, option) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  // Compares this attempt's LO tiers against previousResult (only set on a
  // retake) and surfaces a motivational/nudge toast - the LO Mastery
  // trend chart on the profile page already reflects both attempts as
  // separate points automatically (every submission pushes to
  // analytics-service regardless), this is just the in-the-moment nudge.
  function announceRetakeProgress(newResult) {
    if (!previousResult) return;
    const tierRank = { weak: 0, average: 1, good: 2 };
    const improvedLOs = [];
    const notImprovedLOs = [];
    for (const lo of previousResult.weak_los || []) {
      const before = previousResult.lo_scores[lo]?.mastery_tier;
      const after = newResult.lo_scores[lo]?.mastery_tier;
      if (before == null || after == null) continue;
      if (tierRank[after] > tierRank[before]) improvedLOs.push(lo);
      else notImprovedLOs.push(lo);
    }
    if (improvedLOs.length > 0) {
      toast.success(
        `Nice work! ${improvedLOs.map((lo) => LO_LABELS[lo] || lo).join(", ")} improved since your last attempt.`
      );
    }
    if (notImprovedLOs.length > 0) {
      toast.warning(
        `${notImprovedLOs.map((lo) => LO_LABELS[lo] || lo).join(", ")} ${
          notImprovedLOs.length === 1 ? "still needs" : "still need"
        } more work - check the recommended resources below.`
      );
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const durationSeconds = quizStartedAtRef.current
        ? Math.max(1, Math.round((Date.now() - quizStartedAtRef.current) / 1000))
        : undefined;
      const res = await adaptiveApiService.submitLessonQuiz({
        lessonId: quiz.lesson_id,
        studentId,
        studentName: user?.name ?? "",
        studentEmail: user?.email ?? "",
        answers,
        durationSeconds,
        quizSet: quiz.quiz_set ?? 1,
      });
      announceRetakeProgress(res.data);
      setResult(res.data);
      // First-ever submission for this lesson counts as attempt 1. Retakes
      // are counted in retakeLesson() (quiz.quiz_set can't be trusted -
      // quiz-gen lessons return a string instance id there, not 1/2).
      setAttemptCount((c) => (c < 1 ? 1 : c));
      setScreen("results");
    } catch (e) {
      // The generated question-set behind this attempt aged out server-side
      // (quiz_gen instances have a 6h Redis TTL) - almost always a student
      // resuming a quiz they left open overnight. Recover in place: pull a
      // fresh set for the same lesson and let them re-answer, rather than
      // dead-ending on an error they can't clear from the UI.
      if (e.reason === "quiz_instance_expired" || e.status === 410) {
        const lessonId = quiz.lesson_id;
        try {
          const fresh = await adaptiveApiService.getLessonQuiz(lessonId, 1, studentId);
          setAnswers({});
          setResult(null);
          setQuiz(fresh.data);
          setScreen("quiz");
          quizStartedAtRef.current = Date.now();
          toast.warning("This quiz set expired while it was left open - here's a fresh one. Your previous answers were cleared.");
        } catch {
          setError("This quiz expired and a fresh one couldn't be loaded. Go back to Lessons and start it again.");
        }
        return;
      }
      setError(e.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  function backToLessons() {
    // Pause, don't abandon. Whether the student is mid-quiz or on the
    // results screen with unfinished recommendations, their place is kept
    // (persist effect + startLesson handle resume). Switching to a
    // different lesson from the list is what actually clears it.
    setScreen("select");
  }

  function toggleResourceComplete(resourceId) {
    setCompletedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  }

  // Retakes the SAME lesson (quiz set 2 - different questions per LO) so
  // the results screen can compare this attempt's LO scores against the
  // one just finished.
  async function retakeLesson() {
    setPreviousResult(result);
    setCompletedResourceIds(new Set());
    // Each retake is one more attempt - counted here, not in submitQuiz,
    // since the quiz object can't tell a retake from a first attempt for
    // quiz-gen lessons.
    setAttemptCount((c) => c + 1);
    // The stored results copy is about to be superseded by this retake.
    adaptiveApiService.clearAttemptState(studentId).catch(() => {});
    await startLesson(quiz.lesson_id, 2);
  }

  // quiz can be a bare { lesson_id } stub (hydration restoring a "results"
  // screen from server attempt-state, where the full question list was
  // never persisted) - it has no .questions until startLesson() fetches
  // the real quiz, so guard the field, not just the object.
  const answeredCount = quiz?.questions
    ? quiz.questions.filter((q) => answers[q.id] != null && String(answers[q.id]).trim() !== "").length
    : 0;

  // Deduped, not flatMap - the same resource id often covers multiple weak
  // LOs at once (e.g. one teacher-validated video for the whole lesson), so
  // counting per-LO would demand completing the same card several times.
  const allResourceIds = result
    ? Array.from(
        new Set((result.weak_los || []).flatMap((lo) => (result.recommendations?.[lo] || []).map((r) => r.id)))
      )
    : [];
  const allResourcesCompleted =
    allResourceIds.length > 0 && allResourceIds.every((id) => completedResourceIds.has(id));

  // Trend-aware escalation: after a few attempts, if a weak LO is still
  // weak AND hasn't meaningfully improved since the previous attempt,
  // another quiz cycle won't move it - the student needs re-teaching or
  // their teacher, not another quiz. An LO that's still climbing keeps the
  // normal retake loop.
  const ESCALATE_AFTER_ATTEMPTS = 2;
  const STALL_GAIN_THRESHOLD = 10; // <10 mastery-% gain vs last attempt = stalled
  const stalledWeakLOs = result
    ? (result.weak_los || []).filter((lo) => {
        const cur = result.lo_scores?.[lo];
        if (!cur) return false;
        const prev = previousResult?.lo_scores?.[lo];
        if (!prev) return true; // no comparison point this deep in - treat as stalled
        const gain = (cur.percentile_mastery_score ?? 0) - (prev.percentile_mastery_score ?? 0);
        return cur.mastery_tier === prev.mastery_tier && gain < STALL_GAIN_THRESHOLD;
      })
    : [];
  const shouldEscalate =
    !!result &&
    (result.weak_los?.length ?? 0) > 0 &&
    attemptCount >= ESCALATE_AFTER_ATTEMPTS &&
    stalledWeakLOs.length > 0;
  const resultLesson = lessons.find(
    (l) => l.lesson_id === (quiz?.lesson_id ?? result?.lesson_id)
  );
  const resultLessonTitle = resultLesson?.title ?? "this lesson";

  // ---- presentation helpers ----
  // Each step is its own view, so start it at the top of the page (after
  // "Submit Quiz" the browser was otherwise left scrolled to the bottom).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);
  const LEVEL_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  const byLevel = ([a], [b]) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b);
  const STEPS = [
    { key: "select", label: "Choose a lesson" },
    { key: "quiz", label: "Take the quiz" },
    { key: "results", label: "Results and support" },
  ];
  const stepIndex = STEPS.findIndex((s) => s.key === screen);
  const LEVEL_TONE = {
    remember: "var(--teal)",
    understand: "var(--emotion-happy)",
    apply: "var(--amber)",
  };
  const toneOf = (lo) => LEVEL_TONE[lo] || "var(--chart-5)";
  const tierInfo = (tier) =>
    tier === "good"
      ? { label: "Good", colour: "var(--emotion-happy)", Icon: CheckCircle2 }
      : tier === "average"
      ? { label: "Average", colour: "var(--amber)", Icon: AlertTriangle }
      : { label: "Weak", colour: "var(--destructive)", Icon: XCircle };
  const totalQuestions = quiz?.questions?.length ?? 0;
  const answeredPct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const overall = result ? Math.round(result.overall_percentile_mastery) : 0;
  const overallColour = overall >= 75 ? "var(--emotion-happy)" : overall >= 50 ? "var(--amber)" : "var(--destructive)";
  const availableCount = lessons.filter((l) => access[l.lesson_id]?.can_take_quiz).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header with the three-step path */}
      <section className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(50% 90% at 0% 0%, color-mix(in oklab, var(--teal) 15%, transparent), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" /> Adaptive Learning
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              {screen === "quiz" && quiz ? quiz.title : screen === "results" ? `${resultLessonTitle}: your results` : "Choose a lesson"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {screen === "quiz"
                ? "Answer what you can, then submit. Each question is tagged with the level of thinking it checks."
                : screen === "results"
                ? "See how you did at each level, then work through the resources chosen for your gaps."
                : "Every quiz is made fresh for you: 12 questions across Remember, Understand and Apply."}
            </p>
          </div>
          <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progress">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li key={s.key} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                  <span
                    className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold ${done || current ? "text-primary-foreground" : "text-muted-foreground border border-border"}`}
                    style={done || current ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`hidden sm:inline ${current ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  {i < STEPS.length - 1 && <span className="h-px w-5 sm:w-8 bg-border" />}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {error && (
        <div role="alert" className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ------------------------------------------------ 1. choose a lesson */}
      {screen === "select" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Lessons</h2>
            {!loadingLessons && lessons.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> {availableCount} ready</span>
                <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> {lessons.length - availableCount} locked</span>
              </div>
            )}
          </div>
          {loadingLessons ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-40" />)}
            </div>
          ) : lessons.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No lessons available.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessons.map((lesson, i) => {
                const lessonAccess = access[lesson.lesson_id];
                const canTake = lessonAccess?.can_take_quiz ?? false;
                // Paused work for this lesson (a half-answered quiz, or a
                // results screen with recommendations still to finish) -
                // offered as "Resume" and kept clickable even if the lesson
                // has since been re-locked (the student legitimately
                // started it).
                const resumable = quiz?.lesson_id === lesson.lesson_id;
                const resumeLabel = result ? "Resume: finish recommendations" : "Resume attempt";
                const lockReason = !lessonAccess
                  ? "Checking access..."
                  : !lessonAccess.completed
                  ? "Attend the live class for this lesson first"
                  : "Waiting for your teacher to unlock this quiz";
                const open = canTake || resumable;
                return (
                  <button
                    key={lesson.lesson_id}
                    type="button"
                    onClick={() => open && startLesson(lesson.lesson_id)}
                    disabled={loadingQuiz || !open}
                    className={`group text-left flex flex-col rounded-2xl border p-5 transition-all ${
                      open ? "glass lift border-border/70" : "border-border/50 bg-background/20 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`h-11 w-11 rounded-xl grid place-items-center text-sm font-bold tnum ${open ? "text-primary-foreground" : "text-muted-foreground bg-secondary"}`}
                        style={open ? { background: "var(--gradient-primary)" } : undefined}
                      >
                        {open ? String(i + 1).padStart(2, "0") : <Lock className="h-4 w-4" />}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          resumable ? "border-amber/40 bg-amber/10 text-amber" : canTake ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        {resumable ? "In progress" : canTake ? "Ready" : "Locked"}
                      </span>
                    </div>
                    <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{lesson.subject}</div>
                    <div className={`mt-1 text-lg font-semibold leading-snug ${open ? "" : "text-muted-foreground"}`}>{lesson.title}</div>
                    <div className="mt-auto pt-4 text-sm">
                      {resumable ? (
                        <span className="flex items-center gap-1.5 font-semibold text-amber">
                          <RefreshCw className="h-3.5 w-3.5" /> {resumeLabel}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      ) : canTake ? (
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{lesson.question_count} questions</span>
                          <span className="flex items-center gap-1.5 font-semibold text-primary">
                            Start quiz <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{lockReason}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
            <Monitor className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            A quiz opens after you attend the lesson's live class and your teacher unlocks it.
          </p>
        </section>
      )}

      {/* ------------------------------------------------ 2. take the quiz */}
      {screen === "quiz" && quiz && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-4">
            {quiz.questions.map((q, idx) => {
              const answered = Boolean(answers[q.id]);
              const tone = toneOf(q.lo_level);
              return (
                <div
                  key={q.id}
                  id={`question-${idx + 1}`}
                  className={`glass rounded-2xl p-5 sm:p-6 scroll-mt-28 border ${answered ? "border-primary/35" : "border-border/60"}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`h-8 w-8 rounded-lg grid place-items-center text-xs font-bold tnum ${answered ? "text-primary-foreground" : "text-muted-foreground bg-secondary"}`}
                      style={answered ? { background: "var(--gradient-primary)" } : undefined}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ color: tone, background: `color-mix(in oklab, ${tone} 13%, transparent)`, border: `1px solid color-mix(in oklab, ${tone} 35%, transparent)` }}
                    >
                      {LO_LABELS[q.lo_level] || q.lo_level}
                    </span>
                    <span className="text-[11px] capitalize text-muted-foreground">{q.difficulty}</span>
                  </div>
                  <p className="text-base font-medium leading-relaxed mb-4">{q.question}</p>
                  {q.options ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => selectAnswer(q.id, opt)}
                          className={`text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                            answers[q.id] === opt
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border/60 hover:border-primary/40"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) => selectAnswer(q.id, e.target.value)}
                      placeholder="Type your answer"
                      aria-label={`Answer to question ${idx + 1}`}
                      className="h-12 w-full rounded-xl border border-border px-4 text-sm"
                      autoComplete="off"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress and submit: stays in view while scrolling the questions */}
          <aside className="glass-strong rounded-2xl border border-border p-5 lg:sticky lg:top-24 order-first lg:order-none">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Your progress</p>
              <span className="text-xs text-muted-foreground tnum">{answeredCount}/{totalQuestions}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={totalQuestions} aria-valuenow={answeredCount}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${answeredPct}%`, background: "var(--gradient-primary)" }} />
            </div>
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {quiz.questions.map((q, idx) => {
                const answered = Boolean(answers[q.id]);
                return (
                  <a
                    key={q.id}
                    href={`#question-${idx + 1}`}
                    title={`Question ${idx + 1}${answered ? " (answered)" : ""}`}
                    className={`h-9 rounded-lg grid place-items-center text-xs font-semibold tnum transition-colors ${
                      answered ? "text-primary-foreground" : "text-muted-foreground border border-border hover:border-primary/50"
                    }`}
                    style={answered ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {idx + 1}
                  </a>
                );
              })}
            </div>
            <div className="hairline my-5" />
            <button
              type="button"
              onClick={submitQuiz}
              disabled={submitting || answeredCount === 0}
              className="w-full h-12 rounded-xl text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-50"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Submit Quiz
            </button>
            {answeredCount > 0 && answeredCount < totalQuestions && (
              <p className="mt-2 text-xs text-muted-foreground text-center">{totalQuestions - answeredCount} unanswered. Blank answers count as wrong.</p>
            )}
            <button
              type="button"
              onClick={backToLessons}
              className="mt-3 w-full h-11 rounded-xl text-sm font-medium border border-border/60 hover:bg-secondary transition-colors"
            >
              Back to Lessons
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center">Your answers are saved. You can come back and resume.</p>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------ 3. results and support */}
      {screen === "results" && result && (
        <div className="space-y-6">
          <section className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-8">
              <div
                className="relative h-36 w-36 rounded-full grid place-items-center shrink-0"
                style={{ background: `conic-gradient(${overallColour} ${overall * 3.6}deg, var(--secondary) 0deg)` }}
                role="img"
                aria-label={`${overall}% overall mastery`}
              >
                <div className="h-[118px] w-[118px] rounded-full grid place-items-center text-center" style={{ background: "var(--card)" }}>
                  <div>
                    <div className="text-4xl font-bold tnum leading-none" style={{ color: overallColour }}>{overall}%</div>
                    <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Overall mastery</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-[240px]">
                <p className="eyebrow flex items-center gap-2"><Trophy className="h-3.5 w-3.5" /> Quiz result</p>
                <h2 className="mt-2 font-display text-2xl font-bold">
                  {result.weak_los.length === 0
                    ? "Excellent. You have mastered every level."
                    : overall >= 50
                    ? "Good progress. A few areas need another look."
                    : "This one was tough. Let's close the gaps."}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground max-w-xl">
                  {result.lo_scores.remember?.total_count === 5
                    ? "Remember and Understand have 5 questions each: 4 or 5 correct is Good, 3 is Average, 0 to 2 is Weak. Apply has 2 questions: 2 is Good, 1 is Average, 0 is Weak."
                    : result.lo_scores[Object.keys(result.lo_scores)[0]]?.total_count === 3
                      ? "3 questions per Learning Outcome: all 3 correct is Good, 2 is Average, 0 or 1 is Weak."
                      : "Percentage of questions answered correctly per Learning Outcome."}
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(result.lo_scores).sort(byLevel).map(([lo, data]) => {
                const tier = tierInfo(data.mastery_tier);
                const pct = data.total_count ? Math.round((data.correct_count / data.total_count) * 100) : 0;
                return (
                  <div
                    key={lo}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: `color-mix(in oklab, ${tier.colour} 35%, transparent)`, background: `color-mix(in oklab, ${tier.colour} 6%, transparent)` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{LO_LABELS[lo] || lo}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: tier.colour }}>
                        <tier.Icon className="h-3.5 w-3.5" /> {tier.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="font-display text-3xl font-bold tnum">{data.correct_count}<span className="text-lg text-muted-foreground">/{data.total_count}</span></span>
                      <span className="text-xs text-muted-foreground">correct</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.colour }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {previousResult && (
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Progress since your last attempt</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {previousResult.weak_los.map((lo) => {
                  const before = previousResult.lo_scores[lo]?.percentile_mastery_score ?? 0;
                  const after = result.lo_scores[lo]?.percentile_mastery_score ?? 0;
                  const improved = after > before;
                  const mastered = result.lo_scores[lo]?.mastered;
                  return (
                    <div
                      key={lo}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        mastered
                          ? "border-emotion-happy/40 bg-emotion-happy/5"
                          : improved
                          ? "border-primary/40 bg-primary/5"
                          : "border-amber/40 bg-amber/5"
                      }`}
                    >
                      <div>
                        <div className="text-xs text-muted-foreground">{LO_LABELS[lo] || lo}</div>
                        <div className="text-lg font-semibold mt-1 tnum">
                          {before}% <ArrowRight className="inline h-3.5 w-3.5 mx-1 text-muted-foreground" /> {after}%
                        </div>
                      </div>
                      {mastered ? (
                        <CheckCircle2 className="h-5 w-5 text-emotion-happy flex-shrink-0" />
                      ) : improved ? (
                        <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-amber flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {result.weak_los.length > 0 && (
            <section className="glass rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Recommended resources for your gaps</h2>
                </div>
                {allResourceIds.length > 0 && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tnum">{completedResourceIds.size} of {allResourceIds.length} completed</span>
                    <span className="h-1.5 w-28 rounded-full bg-secondary overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${(completedResourceIds.size / allResourceIds.length) * 100}%`, background: "var(--gradient-primary)" }} />
                    </span>
                  </div>
                )}
              </div>
              {(() => {
                // A given teacher-validated resource is the same for every weak LO in
                // this lesson+emotion (the source document doesn't vary by Bloom level
                // or mastery tier) - group by resource id instead of repeating an
                // identical card under every LO heading.
                const byResource = new Map();
                for (const lo of result.weak_los || []) {
                  for (const res of result.recommendations?.[lo] || []) {
                    if (!byResource.has(res.id)) byResource.set(res.id, { res, los: [] });
                    byResource.get(res.id).los.push(lo);
                  }
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from(byResource.values()).map(({ res, los }) => {
                      const TypeIcon = RESOURCE_TYPE_ICONS[res.type] || FileText;
                      const done = completedResourceIds.has(res.id);
                      return (
                        <div
                          key={res.id}
                          className={`flex flex-col rounded-2xl border p-4 transition-colors ${
                            done ? "border-emotion-happy/40 bg-emotion-happy/5" : "border-border/60 bg-background/30 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center bg-primary/10 border border-primary/30">
                              <TypeIcon className="h-4 w-4 text-primary" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-snug">{res.title}</p>
                              <p className="mt-0.5 text-xs capitalize text-muted-foreground">{res.type} · {res.difficulty}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {los.map((lo) => (
                              <span
                                key={lo}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ color: toneOf(lo), background: `color-mix(in oklab, ${toneOf(lo)} 12%, transparent)` }}
                              >
                                {LO_LABELS[lo] || lo}
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{res.rationale.join(" · ")}</p>
                          <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => toggleResourceComplete(res.id)}
                              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                done ? "text-emotion-happy" : "text-muted-foreground hover:text-primary"
                              }`}
                            >
                              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                              {done ? "Completed" : "Mark as complete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          )}

          {shouldEscalate && (
            <section className="glass rounded-2xl p-6 border border-amber/40 bg-amber/5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber" />
                <h2 className="font-semibold">Extra help needed</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                You've attempted {resultLessonTitle} {attemptCount} times and{" "}
                {stalledWeakLOs.map((lo) => LO_LABELS[lo] || lo).join(", ")}{" "}
                {stalledWeakLOs.length === 1 ? "is" : "are"} still not there (
                {stalledWeakLOs
                  .map(
                    (lo) =>
                      `${LO_LABELS[lo] || lo} ${Math.round(result.lo_scores?.[lo]?.percentile_mastery_score ?? 0)}%`
                  )
                  .join(", ")}
                ). Another quiz on its own probably won't move this. The concept needs another explanation.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/" })}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Monitor className="h-4 w-4" /> Rejoin the live class
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await adaptiveApiService.requestHelp(quiz?.lesson_id ?? result?.lesson_id, {
                        studentId,
                        studentName: user?.name ?? "",
                        stuckLos: stalledWeakLOs.map((lo) => ({
                          lo,
                          score: Math.round(result.lo_scores?.[lo]?.percentile_mastery_score ?? 0),
                        })),
                        attemptCount,
                      });
                      toast.success(
                        "Your teacher has been notified — they'll follow up in your next live class."
                      );
                    } catch {
                      toast.info(
                        "Couldn't reach your teacher's dashboard — please raise this in your next live class."
                      );
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border/60 hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" /> Ask your teacher for help
                </button>
                {allResourcesCompleted && (
                  <button
                    type="button"
                    onClick={retakeLesson}
                    disabled={loadingQuiz}
                    className="px-2 py-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors underline disabled:opacity-50"
                  >
                    Retake anyway
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            {result.weak_los.length === 0 ? (
              <div className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emotion-happy/10 text-emotion-happy border border-emotion-happy/30 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> All Learning Outcomes mastered
              </div>
            ) : shouldEscalate ? null : (
              <button
                type="button"
                onClick={retakeLesson}
                disabled={!allResourcesCompleted || loadingQuiz}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: "var(--gradient-primary)" }}
              >
                {allResourcesCompleted ? <TrendingUp className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Retake Quiz
                <span className="text-xs font-normal opacity-80">
                  ({completedResourceIds.size}/{allResourceIds.length} resources completed)
                </span>
              </button>
            )}
            {result.weak_los.length > 0 && !shouldEscalate && !allResourcesCompleted && (
              <span className="text-xs text-muted-foreground">Finish every resource above to unlock the retake.</span>
            )}
            <button
              type="button"
              onClick={backToLessons}
              className="ml-auto px-5 py-2.5 rounded-xl text-sm font-medium border border-border/60 hover:bg-secondary transition-colors"
            >
              Try Another Lesson
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Route };
