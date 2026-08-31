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

  const answeredCount = quiz
    ? quiz.questions.filter((q) => answers[q.id] != null && String(answers[q.id]).trim() !== "").length
    : 0;

  // Deduped, not flatMap - the same resource id often covers multiple weak
  // LOs at once (e.g. one teacher-validated video for the whole lesson), so
  // counting per-LO would demand completing the same card several times.
  const allResourceIds = result
    ? Array.from(
        new Set((result.weak_los || []).flatMap((lo) => (result.recommendations[lo] || []).map((r) => r.id)))
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

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
          <BookOpen className="h-4 w-4" />
          LEARNING OUTCOME ACHIEVEMENT
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Adaptive Learning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real questions, good/average/weak mastery scoring across Bloom's Taxonomy levels, and semantic
          resource recommendations for anything you haven't mastered yet.
        </p>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {screen === "select" && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold mb-4">Choose a lesson</h2>
          {loadingLessons ? (
            <div className="py-8 flex justify-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lessons.map((lesson) => {
                const lessonAccess = access[lesson.lesson_id];
                const canTake = lessonAccess?.can_take_quiz ?? false;
                // Paused work for this lesson (a half-answered quiz, or a
                // results screen with recommendations still to finish) -
                // offered as "Resume" and kept clickable even if the lesson
                // has since been re-locked (the student legitimately
                // started it).
                const resumable = quiz?.lesson_id === lesson.lesson_id;
                const resumeLabel = result ? "Resume — finish recommendations" : "Resume attempt";
                const lockReason = !lessonAccess
                  ? "Checking access..."
                  : !lessonAccess.completed
                  ? "Attend the live class for this lesson first"
                  : "Waiting for your teacher to unlock this quiz";
                return (
                  <button
                    key={lesson.lesson_id}
                    type="button"
                    onClick={() => (canTake || resumable) && startLesson(lesson.lesson_id)}
                    disabled={loadingQuiz || (!canTake && !resumable)}
                    className="text-left p-4 rounded-xl border border-border/60 hover:border-primary/60 transition-colors disabled:opacity-50 disabled:hover:border-border/60"
                  >
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{lesson.subject}</div>
                    <div className="font-semibold mt-1">{lesson.title}</div>
                    {resumable ? (
                      <div className="text-xs text-primary mt-2 flex items-center gap-1 font-medium">
                        <RefreshCw className="h-3 w-3" /> {resumeLabel} <ArrowRight className="h-3 w-3" />
                      </div>
                    ) : canTake ? (
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        {lesson.question_count} questions <ArrowRight className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> {lockReason}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {screen === "quiz" && quiz && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{quiz.subject}</div>
              <h2 className="font-display text-xl font-bold">{quiz.title}</h2>
            </div>
            <div className="text-sm text-muted-foreground">{answeredCount}/{quiz.questions.length} answered</div>
          </div>

          <div className="space-y-5">
            {quiz.questions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-xl border border-border/60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {LO_LABELS[q.lo_level] || q.lo_level}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{q.difficulty}</span>
                </div>
                <p className="text-sm font-medium mb-3">{q.question}</p>
                {q.options ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => selectAnswer(q.id, opt)}
                        className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
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
                    placeholder="Type your answer..."
                    className="input-field w-full"
                    autoComplete="off"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={submitQuiz}
              disabled={submitting || answeredCount === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Submit Quiz
            </button>
            <button
              type="button"
              onClick={backToLessons}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-border/60 hover:bg-secondary transition-colors"
            >
              Back to Lessons
            </button>
          </div>
        </div>
      )}

      {screen === "results" && result && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <h2 className="font-display text-xl font-bold">
                  {result.overall_percentile_mastery}% overall mastery
                </h2>
                <p className="text-xs text-muted-foreground">
                  {result.lo_scores[Object.keys(result.lo_scores)[0]]?.total_count === 3
                    ? "3 questions per Learning Outcome - all 3 correct is Good, 2 is Average, 0-1 is Weak"
                    : "Percentage of questions answered correctly per Learning Outcome"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(result.lo_scores).map(([lo, data]) => (
                <div
                  key={lo}
                  className={`p-3 rounded-xl border text-center ${
                    data.mastery_tier === "good"
                      ? "border-emotion-happy/40 bg-emotion-happy/5"
                      : data.mastery_tier === "average"
                      ? "border-amber/40 bg-amber/5"
                      : "border-error/40 bg-error/5"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{LO_LABELS[lo] || lo}</div>
                  <div className="font-display text-lg font-bold mt-1">
                    {data.correct_count}/{data.total_count}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1 text-[10px]">
                    {data.mastery_tier === "good" ? (
                      <><CheckCircle2 className="h-3 w-3 text-emotion-happy" /> Good</>
                    ) : data.mastery_tier === "average" ? (
                      <><AlertTriangle className="h-3 w-3 text-amber" /> Average</>
                    ) : (
                      <><XCircle className="h-3 w-3 text-error" /> Weak</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {previousResult && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Progress since your last attempt</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previousResult.weak_los.map((lo) => {
                  const before = previousResult.lo_scores[lo]?.percentile_mastery_score ?? 0;
                  const after = result.lo_scores[lo]?.percentile_mastery_score ?? 0;
                  const improved = after > before;
                  const mastered = result.lo_scores[lo]?.mastered;
                  return (
                    <div
                      key={lo}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        mastered
                          ? "border-emotion-happy/40 bg-emotion-happy/5"
                          : improved
                          ? "border-primary/40 bg-primary/5"
                          : "border-amber/40 bg-amber/5"
                      }`}
                    >
                      <div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">{LO_LABELS[lo] || lo}</div>
                        <div className="text-sm font-semibold mt-1">
                          {before}% <ArrowRight className="inline h-3 w-3 mx-1" /> {after}%
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
            </div>
          )}

          {result.weak_los.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Recommended resources for your gaps</h2>
              </div>
              {(() => {
                // A given teacher-validated resource is the same for every weak LO in
                // this lesson+emotion (the source document doesn't vary by Bloom level
                // or mastery tier) - group by resource id instead of repeating an
                // identical card under every LO heading.
                const byResource = new Map();
                for (const lo of result.weak_los) {
                  for (const res of result.recommendations[lo] || []) {
                    if (!byResource.has(res.id)) byResource.set(res.id, { res, los: [] });
                    byResource.get(res.id).los.push(lo);
                  }
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Array.from(byResource.values()).map(({ res, los }) => {
                      const TypeIcon = RESOURCE_TYPE_ICONS[res.type] || FileText;
                      const done = completedResourceIds.has(res.id);
                      return (
                        <div
                          key={res.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            done ? "border-emotion-happy/40 bg-emotion-happy/5" : "border-border/60 hover:border-primary/60"
                          }`}
                        >
                          <div className="flex flex-wrap gap-1 mb-2">
                            {los.map((lo) => (
                              <span
                                key={lo}
                                className="text-[9px] uppercase tracking-widest text-muted-foreground px-1.5 py-0.5 rounded bg-white/5 border border-border/60"
                              >
                                {LO_LABELS[lo] || lo}
                              </span>
                            ))}
                          </div>
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="block">
                            <div className="flex items-start gap-2">
                              <TypeIcon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                              <p className="text-sm font-medium flex-1">{res.title}</p>
                              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-1" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-6">{res.type} - {res.difficulty}</p>
                            <p className="text-[10px] text-muted-foreground mt-2 ml-6">{res.rationale.join(" - ")}</p>
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleResourceComplete(res.id)}
                            className={`mt-3 ml-6 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                              done ? "text-emotion-happy" : "text-muted-foreground hover:text-primary"
                            }`}
                          >
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                            {done ? "Completed" : "Mark as complete"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {shouldEscalate && (
            <div className="glass rounded-2xl p-6 border border-amber/40">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber" />
                <h2 className="text-sm font-semibold">Extra help needed</h2>
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
                ). Another quiz on its own probably won't move this — the concept needs another
                explanation.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/" })}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
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
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border/60 hover:bg-secondary transition-colors flex items-center gap-2"
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
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {result.weak_los.length === 0 ? (
              <div className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-emotion-happy/10 text-emotion-happy border border-emotion-happy/30 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> All Learning Outcomes mastered
              </div>
            ) : shouldEscalate ? null : (
              <button
                type="button"
                onClick={retakeLesson}
                disabled={!allResourcesCompleted || loadingQuiz}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {allResourcesCompleted ? <TrendingUp className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Retake Quiz
                <span className="text-xs font-normal opacity-80">
                  ({completedResourceIds.size}/{allResourceIds.length} resources completed)
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={backToLessons}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-border/60 hover:bg-secondary transition-colors"
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
