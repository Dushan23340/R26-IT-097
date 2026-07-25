import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Trophy,
} from "lucide-react";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { useAuth } from "@/lib/auth";

const Route = createFileRoute("/lessons")({
  head: () => ({
    meta: [
      { title: "Lessons — AdaptiveMind" },
      {
        name: "description",
        content: "Take a real lesson quiz and get Bloom's-taxonomy mastery scoring with emotion-aware resource recommendations.",
      },
    ],
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

function LessonsPage() {
  const { user } = useAuth();
  const [screen, setScreen] = useState("select"); // select | quiz | results
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState(null);

  const [quiz, setQuiz] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    adaptiveApiService
      .getLessons()
      .then((res) => setLessons(res.data || []))
      .catch((e) => setError(e.message || "Failed to load lessons"))
      .finally(() => setLoadingLessons(false));
  }, []);

  async function startLesson(lessonId) {
    setError(null);
    setLoadingQuiz(true);
    setAnswers({});
    setResult(null);
    try {
      const res = await adaptiveApiService.getLessonQuiz(lessonId);
      setQuiz(res.data);
      setScreen("quiz");
    } catch (e) {
      setError(e.message || "Failed to load quiz");
    } finally {
      setLoadingQuiz(false);
    }
  }

  function selectAnswer(questionId, option) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function submitQuiz() {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adaptiveApiService.submitLessonQuiz({
        lessonId: quiz.lesson_id,
        studentId: String(user?.id ?? user?._id ?? user?.email ?? "anonymous"),
        studentName: user?.name ?? "",
        studentEmail: user?.email ?? "",
        answers,
      });
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
  }

  const answeredCount = quiz ? quiz.questions.filter((q) => answers[q.id] != null).length : 0;

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
          <BookOpen className="h-4 w-4" />
          LEARNING OUTCOME ACHIEVEMENT
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Lessons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real questions, weighted mastery scoring across Bloom's Taxonomy levels, and semantic
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
                  Weighted correctness x difficulty x cognitive level, per the LO Achievement component
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(result.lo_scores).map(([lo, data]) => (
                <div
                  key={lo}
                  className={`p-3 rounded-xl border text-center ${
                    data.mastered ? "border-emotion-happy/40 bg-emotion-happy/5" : "border-amber/40 bg-amber/5"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{LO_LABELS[lo] || lo}</div>
                  <div className="font-display text-lg font-bold mt-1">{data.percentile_mastery_score}%</div>
                  <div className="flex items-center justify-center gap-1 mt-1 text-[10px]">
                    {data.mastered ? (
                      <><CheckCircle2 className="h-3 w-3 text-emotion-happy" /> Mastered</>
                    ) : (
                      <><XCircle className="h-3 w-3 text-amber" /> Below 75%</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                      {(result.recommendations[lo] || []).map((res) => (
                        <div key={res.id} className="p-3 rounded-lg border border-border/60">
                          <p className="text-sm font-medium">{res.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{res.type} - {res.difficulty}</p>
                          <p className="text-[10px] text-muted-foreground mt-2">{res.rationale.join(" - ")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={backToLessons}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
