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

  // Restore any saved quiz/results/resource-completion progress once the
  // real student id is known, so a refresh doesn't drop back to "select".
  useEffect(() => {
    if (!user || hydrationRanRef.current) return;
    hydrationRanRef.current = true;
    const saved = loadProgress(studentId);
    if (saved) {
      setScreen(saved.screen ?? "select");
      setQuiz(saved.quiz ?? null);
      setAnswers(saved.answers ?? {});
      setResult(saved.result ?? null);
      setPreviousResult(saved.previousResult ?? null);
      setCompletedResourceIds(saved.completedResourceIds ?? new Set());
    }
    setHydrated(true);
  }, [user, studentId]);

  // Only persist once hydration has run (and applied) so we never overwrite
  // saved progress with the pre-hydration default/empty state.
  useEffect(() => {
    if (!hydrated) return;
    if (screen === "select") {
      clearProgress(studentId);
      return;
    }
    saveProgress(studentId, { screen, quiz, answers, result, previousResult, completedResourceIds });
  }, [hydrated, studentId, screen, quiz, answers, result, previousResult, completedResourceIds]);

  // quizSet 1 = first attempt at this lesson; 2 = every retake thereafter
  // (retakeLesson always requests 2 - a different set of questions per LO
  // so answers can't just be remembered from the first attempt).
  async function startLesson(lessonId, quizSet = 1) {
    setError(null);
    setLoadingQuiz(true);
    setAnswers({});
    setResult(null);
    try {
      const res = await adaptiveApiService.getLessonQuiz(lessonId, quizSet);
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
      setScreen("results");
    } catch (e) {
      setError(e.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  function backToLessons() {
    setScreen("select");
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setPreviousResult(null);
    setCompletedResourceIds(new Set());
    clearProgress(studentId);
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
    await startLesson(quiz.lesson_id, 2);
  }

  const answeredCount = quiz
    ? quiz.questions.filter((q) => answers[q.id] != null && String(answers[q.id]).trim() !== "").length
    : 0;

  const allResourceIds = result
    ? (result.weak_los || []).flatMap((lo) => (result.recommendations[lo] || []).map((r) => r.id))
    : [];
  const allResourcesCompleted =
    allResourceIds.length > 0 && allResourceIds.every((id) => completedResourceIds.has(id));

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
              {lessons.map((lesson) => (
                <button
                  key={lesson.lesson_id}
                  type="button"
                  onClick={() => startLesson(lesson.lesson_id)}
                  disabled={loadingQuiz}
                  className="text-left p-4 rounded-xl border border-border/60 hover:border-primary/60 transition-colors disabled:opacity-50"
                >
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{lesson.subject}</div>
                  <div className="font-semibold mt-1">{lesson.title}</div>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    {lesson.question_count} questions <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
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
              <div className="space-y-4">
                {result.weak_los.map((lo) => (
                  <div key={lo}>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      {LO_LABELS[lo] || lo}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(result.recommendations[lo] || []).map((res) => {
                        const TypeIcon = RESOURCE_TYPE_ICONS[res.type] || FileText;
                        const done = completedResourceIds.has(res.id);
                        return (
                          <div
                            key={res.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              done ? "border-emotion-happy/40 bg-emotion-happy/5" : "border-border/60 hover:border-primary/60"
                            }`}
                          >
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
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {result.weak_los.length > 0 ? (
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
            ) : (
              <div className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-emotion-happy/10 text-emotion-happy border border-emotion-happy/30 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> All Learning Outcomes mastered
              </div>
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
