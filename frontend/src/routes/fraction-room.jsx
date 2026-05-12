import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getRecommendation, getAnalyticsCurrent } from "@/services/analyticsApi";
import {
  Loader2,
  Clock3,
  Puzzle,
  Sparkles,
  Key,
  Search,
  Smile,
  Frown,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const QUESTIONS = [
  {
    id: "paper-1",
    question: "(2/3 + 1/6) * 6",
    answer: 5,
    hint: "Solve inside brackets first, then multiply.",
  },
  {
    id: "paper-2",
    question: "3/4 ÷ (1/2 - 1/4)",
    answer: 3,
    hint: "Simplify the bracket part before dividing.",
  },
  {
    id: "paper-3",
    question: "(5/6 - 1/3) * 18",
    answer: 9,
    hint: "Use common denominators, then multiply.",
  },
  {
    id: "paper-4",
    question: "1/2 * (7/4 + 1/4)",
    answer: 1,
    hint: "Add fractions inside brackets first.",
  },
  {
    id: "paper-5",
    question: "(3/5 + 2/5) ÷ 1/2",
    answer: 2,
    hint: "Add the fractions, then divide by one half.",
  },
];

const START_SECONDS = 5 * 60;
const MAX_WRONG = 3;

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function parseNumericAnswer(value) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.includes("/")) {
    const [num, den] = normalized.split("/").map((part) => part.trim());
    const numerator = Number(num);
    const denominator = Number(den);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAnswerCorrect(value, expected) {
  const parsed = parseNumericAnswer(value);
  if (parsed === null) return false;
  return Math.abs(parsed - expected) < 0.001;
}

const Route = createFileRoute("/fraction-room")({
  head: () => ({
    meta: [
      { title: "Fraction Room — AdaptiveMind" },
      {
        name: "description",
        content: "Fraction Room is a grade 9 fraction adventure game with BODMAS practice, engine recommendations, and emotion-aware guidance.",
      },
    ],
  }),
  component: FractionRoomPage,
});

function FractionRoomPage() {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(START_SECONDS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("Click the start button to begin the adventure.");
  const [wrongCount, setWrongCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [monsterMood, setMonsterMood] = useState("watching");
  const [recommendation, setRecommendation] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingRec, setLoadingRec] = useState(true);
  const [recError, setRecError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRecommendation() {
      try {
        setLoadingRec(true);
        const [rec, current] = await Promise.all([
          getRecommendation(),
          getAnalyticsCurrent(),
        ]);
        if (cancelled) return;
        setRecommendation(rec);
        setAnalytics(current);
      } catch (error) {
        if (cancelled) return;
        setRecError("Could not load emotion recommendation. The game still works offline.");
      } finally {
        if (!cancelled) setLoadingRec(false);
      }
    }
    loadRecommendation();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!started || completed || gameOver) return undefined;
    if (timeLeft <= 0) {
      setGameOver(true);
      setFeedback("Time is up! The monster catches the boy if the door is not unlocked.");
      setMonsterMood("angry");
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, timeLeft, completed, gameOver]);

  useEffect(() => {
    if (wrongCount >= MAX_WRONG) {
      setGameOver(true);
      setFeedback("The monster swallows the boy after too many mistakes. Try again.");
      setMonsterMood("angry");
    } else if (wrongCount > 0) {
      setMonsterMood("annoyed");
    }
  }, [wrongCount]);

  useEffect(() => {
    if (currentIndex >= QUESTIONS.length && started) {
      setCompleted(true);
      setFeedback("Great job! The monster gives the key and the door opens.");
      setMonsterMood("happy");
    }
  }, [currentIndex, started]);

  const currentQuestion = QUESTIONS[currentIndex];
  const remainingQuestions = Math.max(QUESTIONS.length - currentIndex, 0);
  const currentPaper = useMemo(
    () => QUESTIONS.map((question, index) => ({
      ...question,
      position: [
        0 + index * 12,
        12 + (index % 2) * 9,
      ],
      solved: solvedIds.includes(question.id),
      active: index === currentIndex && started && !completed && !gameOver,
    })),
    [currentIndex, solvedIds, started, completed, gameOver]
  );

  const doorStatus = completed ? "Door unlocked" : gameOver ? "Door locked" : "Door sealed";

  const monsterIcon = monsterMood === "happy" ? <Smile className="h-8 w-8 text-emerald-600" /> : monsterMood === "angry" ? <Frown className="h-8 w-8 text-destructive" /> : <Search className="h-8 w-8 text-yellow-500" />;

  const startGame = () => {
    setStarted(true);
    setTimeLeft(START_SECONDS);
    setCurrentIndex(0);
    setSolvedIds([]);
    setAnswer("");
    setWrongCount(0);
    setCompleted(false);
    setGameOver(false);
    setMonsterMood("watching");
    setFeedback("The game begins! Find the first hidden paper and solve the fraction with BODMAS.");
  };

  const restartGame = () => {
    startGame();
  };

  const submitAnswer = (event) => {
    event.preventDefault();
    if (!started || gameOver || completed) return;
    if (!currentQuestion) return;
    const isCorrect = isAnswerCorrect(answer, currentQuestion.answer);
    if (isCorrect) {
      setSolvedIds((prev) => [...prev, currentQuestion.id]);
      setCurrentIndex((value) => value + 1);
      setAnswer("");
      setFeedback("Nice! The monster retreats and gives a new clue.");
    } else {
      setWrongCount((value) => value + 1);
      setFeedback("Wrong answer. Recheck the brackets and BODMAS order.");
    }
  };

  const activeTarget = currentPaper[currentIndex];
  const boyLeft = activeTarget ? `${10 + activeTarget.position[0]}%` : "10%";
  const boyTop = activeTarget ? `${18 + activeTarget.position[1]}%` : "18%";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Puzzle className="h-4 w-4" />
            Fraction Room
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Escape the messy room with grade 9 fractions</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Find 5 hidden papers in the room, solve each fractional expression using BODMAS, and earn the key from the monster before time runs out.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Time left</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">{formatDuration(timeLeft)}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Remaining</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">{remainingQuestions}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Door</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground">
              <Key className="h-5 w-5 text-primary" />
              {doorStatus}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-3xl border border-border/70 bg-slate-950/5 p-6 shadow-xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-100 shadow-[inset_0_0_120px_rgba(15,23,42,0.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.15),_transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_30%)]" />
            <div
              className="relative h-[420px] rounded-[32px] border border-white/10 bg-cover p-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1' d='M0 80h160M80 0v160'/%3E%3C/svg%3E")`,
              }}
            >
              <div
                className="absolute left-6 top-10 rounded-full border border-white/10 bg-slate-950/90 p-3 text-center shadow-lg shadow-black/20"
                style={{ width: 120 }}
              >
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Messy Room</div>
                <div className="mt-3 text-xs text-slate-500">Find the floating fraction papers around the room</div>
              </div>

              <div className="absolute right-6 top-6 flex flex-col items-end gap-1 text-right text-xs text-slate-300">
                <div>Monster mood</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-2">
                  {monsterIcon}
                  <span>{monsterMood === "happy" ? "Friendly" : monsterMood === "angry" ? "Dangerous" : "Watching"}</span>
                </div>
              </div>

              <div className="absolute right-8 bottom-8 flex items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-4 shadow-2xl shadow-black/40">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-red-500 to-fuchsia-500 p-1 shadow-inner shadow-black/40">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-3xl">👾</div>
                </div>
                <div className="max-w-xs text-sm text-slate-100">
                  The room monster watches over the door. Solve every hidden paper and it will hand you the key.
                </div>
              </div>

              {currentPaper.map((paper, index) => (
                <button
                  key={paper.id}
                  type="button"
                  onClick={() => {
                    if (!started || gameOver || completed) return;
                    if (index !== currentIndex) return;
                    setFeedback("Solve the current paper by applying BODMAS to the expression.");
                  }}
                  className={`absolute rounded-2xl border border-white/10 bg-white/90 px-3 py-2 text-left text-xs font-semibold text-slate-900 shadow-lg transition-all ${paper.solved ? "opacity-30" : paper.active ? "scale-105 border-primary/80 ring-2 ring-primary/20" : "hover:-translate-y-0.5 hover:shadow-2xl"}`}
                  style={{ left: `${10 + index * 13}%`, top: `${22 + (index % 2) * 10}%`, width: 108, minHeight: 56 }}
                >
                  <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-slate-500">Hidden paper</div>
                  <div className="text-sm">
                    {paper.solved ? "Solved" : paper.active ? "Tap to answer" : "Hidden"}
                  </div>
                </button>
              ))}

              <div
                className="absolute rounded-full border-2 border-primary/20 bg-primary/20 p-4 text-center text-slate-100 shadow-xl shadow-cyan-500/20 transition-all"
                style={{ left: boyLeft, top: boyTop, width: 76, height: 76, transform: "translate(-50%, -50%)" }}
              >
                <div className="text-2xl">🧒</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-slate-200">Boy</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Game recommendation</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">Emotion-driven choice</h2>
                </div>
                {loadingRec ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />}
              </div>
              <div className="mt-4 text-sm text-slate-500">
                {recError ? recError : recommendation ? (
                  <>
                    <div className="font-semibold text-foreground">{recommendation.recommendation.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">Reason</div>
                    <p className="mt-1 text-sm text-slate-600">{recommendation.trigger_reason}</p>
                  </>
                ) : (
                  "Loading recommendation from the emotion engine..."
                )}
              </div>
              {analytics?.distribution?.BORED != null && (
                <div className="mt-4 rounded-2xl bg-primary/5 p-3 text-sm text-slate-700">
                  Current boredom level: <span className="font-semibold text-foreground">{analytics.distribution.BORED.toFixed(1)}%</span>. When boredom exceeds 30%, this escape-room challenge helps re-engage learners.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Adventure guide</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">How to win</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. Click Start to enter the room.</li>
                <li>2. Find the active fractional paper and solve it using brackets + BODMAS.</li>
                <li>3. Correct answers make the monster step back and unlock the door.</li>
                <li>4. If time runs out or too many mistakes happen, the monster swallows the boy.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <span>Key status</span>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                {completed ? (
                  <span className="font-semibold text-emerald-600">Key received! The door is open.</span>
                ) : gameOver ? (
                  <span className="font-semibold text-destructive">Game over — the monster blocked the escape.</span>
                ) : (
                  <span>The monster will give the key once all papers are solved.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current task</div>
                <h2 className="mt-1 text-xl font-semibold text-foreground">Paper {currentIndex + 1}</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                BODMAS + Brackets
              </div>
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-600">
              {started ? (
                completed ? (
                  "All papers solved. Claim your reward from the monster."
                ) : gameOver ? (
                  "The door remains closed. Restart to try again.") : (
                  <>
                    <div className="rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-100 shadow-inner">
                      <div className="font-semibold">{currentQuestion.question}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-400">Hint</div>
                      <p className="mt-1 text-sm text-slate-300">{currentQuestion.hint}</p>
                    </div>
                    <form onSubmit={submitAnswer} className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-slate-700">Answer</label>
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        disabled={gameOver || completed}
                        placeholder="Enter a number or fraction, e.g. 5 or 3/4"
                        className="w-full rounded-2xl border border-border/80 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/10"
                      />
                      <button
                        type="submit"
                        disabled={gameOver || completed}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Submit answer
                      </button>
                    </form>
                  </>
                )
              ) : (
                <p className="text-sm text-slate-500">Press Start to wake up the boy, open the first paper, and begin the fraction rescue challenge.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Atmosphere</div>
                <h2 className="mt-1 text-xl font-semibold text-foreground">Story status</h2>
              </div>
              {completed ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : gameOver ? <Frown className="h-6 w-6 text-destructive" /> : <Smile className="h-6 w-6 text-primary" />}
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-600">
              <p>{feedback}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">Wrong answers</p>
              <p className="text-sm text-slate-500">{wrongCount} of {MAX_WRONG} allowed</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Play controls</div>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={startGame}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <ArrowRight className="h-4 w-4" />
                Start Fraction Room
              </button>
              <button
                type="button"
                onClick={restartGame}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/80"
              >
                <Sparkles className="h-4 w-4" />
                Restart challenge
              </button>
              <Link
                to="/adaptive"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                <Puzzle className="h-4 w-4" />
                Back to adaptive menu
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
