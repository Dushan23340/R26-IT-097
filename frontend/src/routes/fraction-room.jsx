import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getRecommendation, getAnalyticsCurrent } from "@/services/analyticsApi";
import { useGameSession } from "@/hooks/useGameSession";
import {
  Loader2,
  Clock3,
  Puzzle,
  Sparkles,
  Key,
  Search,
  Smile,
  Frown,
  Meh,
  ArrowRight,
  CheckCircle2,
  XCircle,
  PartyPopper,
  SkullIcon,
  RotateCcw,
} from "lucide-react";

const QUESTIONS = [
  {
    id: "paper-1",
    question: "1/2 + 1/4",
    answer: 0.75,
    hint: "Convert to quarters, then add the fractions.",
  },
  {
    id: "paper-2",
    question: "2/3 + 1/3",
    answer: 1,
    hint: "Add the two fractions with the same denominator.",
  },
  {
    id: "paper-3",
    question: "3/4 - 1/2",
    answer: 0.25,
    hint: "Subtract half from three quarters.",
  },
  {
    id: "paper-4",
    question: "1 - 2/5",
    answer: 0.6,
    hint: "Take two fifths away from the whole.",
  },
  {
    id: "paper-5",
    question: "2/5 + 3/5",
    answer: 1,
    hint: "Add two fifths and three fifths together.",
  },
];

// Percent-of-room positions for each hidden paper - kept as percentages so
// the room stays responsive, converted to real pixel rects at hit-test time
// (see toPixelRect) instead of being compared against pixel player
// coordinates directly, which is what silently broke discovery before.
const HIDDEN_PAPER_POSITIONS = [
  { left: 16, top: 62 },
  { left: 66, top: 20 },
  { left: 42, top: 52 },
  { left: 14, top: 18 },
  { left: 70, top: 68 },
];

// Purely decorative furniture, rendered with CSS instead of missing image
// assets (public/images/messy-room.png and boy-sprite.png never existed -
// the room and hero rendered as blank space before this rewrite).
const FURNITURE = [
  { emoji: "\u{1F6CF}\u{FE0F}", left: "2%", top: "8%", size: 72, rotate: -4 },
  { emoji: "\u{1F4DA}", left: "84%", top: "6%", size: 48, rotate: 3 },
  { emoji: "\u{1F9F8}", left: "6%", top: "78%", size: 36, rotate: -8 },
  { emoji: "\u{1F5C3}\u{FE0F}", left: "48%", top: "6%", size: 40, rotate: 5 },
  { emoji: "\u{1F97E}", left: "88%", top: "80%", size: 44, rotate: 10 },
  { emoji: "\u{1F9FA}", left: "30%", top: "82%", size: 38, rotate: -3 },
];

const START_SECONDS = 5 * 60;
const MAX_WRONG = 3;
const ROOM_WIDTH = 840;
const ROOM_HEIGHT = 420;
const HERO_SIZE = 56;
const PAPER_HITBOX = { width: 96, height: 64 };

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

// Percent position -> real pixel rect at the room's actual rendered size,
// so hit-testing against the hero's pixel coordinates is meaningful. The
// previous version compared parseFloat("16%") (=16) directly against
// pixel coordinates up to 840 - the hitbox was effectively stuck in a
// ~90x60px corner regardless of where the paper visually appeared.
function toPixelRect(position) {
  return {
    left: (position.left / 100) * ROOM_WIDTH - PAPER_HITBOX.width / 2,
    top: (position.top / 100) * ROOM_HEIGHT - PAPER_HITBOX.height / 2,
    width: PAPER_HITBOX.width,
    height: PAPER_HITBOX.height,
  };
}

function overlapRect(a, b) {
  return !(
    a.left + a.width < b.left ||
    a.left > b.left + b.width ||
    a.top + a.height < b.top ||
    a.top > b.top + b.height
  );
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
  const { reportFinish } = useGameSession("fraction_room");
  const reportedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(START_SECONDS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("Click Start Game to begin the adventure.");
  const [feedbackTone, setFeedbackTone] = useState("neutral");
  const [wrongCount, setWrongCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [monsterMood, setMonsterMood] = useState("watching");
  const [discovered, setDiscovered] = useState(false);
  const [shake, setShake] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingRec, setLoadingRec] = useState(true);
  const [recError, setRecError] = useState("");

  const answerInputRef = useRef(null);
  const moveTimerRef = useRef(null);

  const [playerX, setPlayerX] = useState(() => Math.floor(ROOM_WIDTH / 2 - HERO_SIZE / 2));
  const [playerY, setPlayerY] = useState(() => Math.floor(ROOM_HEIGHT - HERO_SIZE - 20));
  const [playerDirection, setPlayerDirection] = useState("right");
  const [isMoving, setIsMoving] = useState(false);

  const clampToRoom = (x, y) => ({
    x: Math.max(0, Math.min(ROOM_WIDTH - HERO_SIZE, x)),
    y: Math.max(0, Math.min(ROOM_HEIGHT - HERO_SIZE, y)),
  });

  const getPlayerRect = () => ({
    left: playerX,
    top: playerY,
    width: HERO_SIZE,
    height: HERO_SIZE,
  });

  const currentQuestion = QUESTIONS[currentIndex];
  const remainingQuestions = Math.max(QUESTIONS.length - currentIndex, 0);
  const progressPct = Math.round((solvedIds.length / QUESTIONS.length) * 100);

  const papers = useMemo(
    () => QUESTIONS.map((question, index) => ({
      ...question,
      position: HIDDEN_PAPER_POSITIONS[index % HIDDEN_PAPER_POSITIONS.length],
      solved: solvedIds.includes(question.id),
      current: index === currentIndex && started && !completed && !gameOver,
      locked: index > currentIndex,
    })),
    [currentIndex, solvedIds, started, completed, gameOver]
  );

  const doorStatus = completed ? "Door unlocked" : gameOver ? "Door locked" : "Door sealed";

  const monsterIcon = monsterMood === "happy"
    ? <Smile className="h-8 w-8 text-success" />
    : monsterMood === "angry"
      ? <Frown className="h-8 w-8 text-error" />
      : monsterMood === "annoyed"
        ? <Meh className="h-8 w-8 text-warning" />
        : <Search className="h-8 w-8 text-yellow-500" />;

  const refreshRecommendation = async () => {
    try {
      setLoadingRec(true);
      setRecError("");
      const [rec, current] = await Promise.all([
        getRecommendation(),
        getAnalyticsCurrent(),
      ]);
      setRecommendation(rec);
      setAnalytics(current);
    } catch {
      setRecError("Could not load emotion recommendation. The game still works offline.");
    } finally {
      setLoadingRec(false);
    }
  };

  useEffect(() => {
    refreshRecommendation();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!started || gameOver || completed) return;
      let dx = 0;
      let dy = 0;
      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          dx = -10;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dx = 10;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          dy = -10;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dy = 10;
          break;
        default:
          return;
      }
      event.preventDefault();
      const newPos = clampToRoom(playerX + dx, playerY + dy);
      setPlayerX(newPos.x);
      setPlayerY(newPos.y);
      setPlayerDirection((currentDirection) =>
        dx < 0 ? "left" : dx > 0 ? "right" : currentDirection
      );
      setIsMoving(true);
      window.clearTimeout(moveTimerRef.current);
      moveTimerRef.current = window.setTimeout(() => setIsMoving(false), 150);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, gameOver, completed, playerX, playerY]);

  useEffect(() => {
    if (!started || completed || gameOver) return undefined;
    if (timeLeft <= 0) {
      setGameOver(true);
      setFeedback("Time is up! The monster catches the hero before the door opens.");
      setFeedbackTone("bad");
      setMonsterMood("angry");
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, timeLeft, completed, gameOver]);

  // Walking onto the current paper's spot just reveals/focuses it - solving
  // it still strictly requires typing the correct answer below. Walking
  // over it used to silently mark the question solved with no answer
  // check at all, which meant the fraction practice could be skipped
  // entirely just by moving around the room.
  useEffect(() => {
    if (!started || completed || gameOver) return;
    const activePaper = papers.find((paper) => paper.current);
    if (!activePaper) return;

    const overlapping = overlapRect(getPlayerRect(), toPixelRect(activePaper.position));
    if (overlapping && !discovered) {
      setDiscovered(true);
      setFeedback("You found the hidden paper! Solve the fraction on the right to pick it up.");
      setFeedbackTone("neutral");
      answerInputRef.current?.focus();
    } else if (!overlapping && discovered) {
      setDiscovered(false);
    }
  }, [playerX, playerY, papers, started, completed, gameOver, discovered]);

  useEffect(() => {
    if (!started || gameOver) return;
    const overlapping = overlapRect(getPlayerRect(), {
      left: (ROOM_WIDTH * 82) / 100,
      top: (ROOM_HEIGHT * 40) / 100,
      width: 110,
      height: 170,
    });
    if (overlapping) {
      setFeedback(completed ? "The door is unlocked - step through to escape!" : "The door is sealed until every paper is solved.");
      setFeedbackTone(completed ? "good" : "neutral");
    }
  }, [playerX, playerY, completed, gameOver, started]);

  useEffect(() => {
    if (wrongCount >= MAX_WRONG) {
      setGameOver(true);
      setFeedback("The monster catches the hero after too many mistakes. Try again!");
      setFeedbackTone("bad");
      setMonsterMood("angry");
    } else if (wrongCount > 0) {
      setMonsterMood("annoyed");
    }
  }, [wrongCount]);

  useEffect(() => {
    if (currentIndex >= QUESTIONS.length && started) {
      setCompleted(true);
      setFeedback("Every paper is solved! The monster hands over the key.");
      setFeedbackTone("good");
      setMonsterMood("happy");
    }
  }, [currentIndex, started]);

  // Report the outcome to the teacher's live session panel exactly once
  // per attempt (completed/gameOver are set from three separate effects
  // above, so a ref guard is simpler than trying to report inline at each
  // call site).
  useEffect(() => {
    if (reportedRef.current) return;
    if (completed) {
      reportedRef.current = true;
      reportFinish("win", Math.round((solvedIds.length / QUESTIONS.length) * 100), {
        correctCount: solvedIds.length,
        totalCount: QUESTIONS.length,
      });
    } else if (gameOver) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((solvedIds.length / QUESTIONS.length) * 100), {
        correctCount: solvedIds.length,
        totalCount: QUESTIONS.length,
      });
    }
  }, [completed, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const startGame = () => {
    reportedRef.current = false;
    setStarted(true);
    setTimeLeft(START_SECONDS);
    setCurrentIndex(0);
    setSolvedIds([]);
    setAnswer("");
    setWrongCount(0);
    setCompleted(false);
    setGameOver(false);
    setMonsterMood("watching");
    setDiscovered(false);
    setFeedback("The adventure begins! Move with the arrow keys or WASD to explore the messy room and find the first hidden paper.");
    setFeedbackTone("neutral");
  };

  const restartGame = () => {
    startGame();
  };

  const submitAnswer = (event) => {
    event.preventDefault();
    if (!started || gameOver || completed) return;
    if (!currentQuestion) return;
    const isCorrect = isAnswerCorrect(answer, currentQuestion.answer);
    setAnswer("");
    if (isCorrect) {
      setSolvedIds((prev) => [...prev, currentQuestion.id]);
      setCurrentIndex((value) => value + 1);
      setDiscovered(false);
      setFeedback("Correct! The paper glows and vanishes into your collection.");
      setFeedbackTone("good");
    } else {
      setWrongCount((value) => value + 1);
      setFeedback("Not quite - recheck the brackets and BODMAS order, then try again.");
      setFeedbackTone("bad");
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    }
  };

  const feedbackColor = feedbackTone === "good" ? "text-success" : feedbackTone === "bad" ? "text-error" : "text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Puzzle className="h-4 w-4" />
            FRACTION ROOM
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Escape the Messy Room Challenge</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            Guide the hero through a cluttered bedroom, solve fraction equations with BODMAS, collect hidden papers, and unlock the door before the monster catches you!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card rounded-2xl">
            <div className="flex items-center gap-1.5 text-label-md text-text-muted"><Clock3 className="h-3.5 w-3.5" /> TIME LEFT</div>
            <div className={`mt-2 text-display-sm font-bold ${timeLeft <= 30 && started ? "text-error animate-pulse" : "text-accent"}`}>{formatDuration(timeLeft)}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">REMAINING</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">{remainingQuestions}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">DOOR STATUS</div>
            <div className="mt-2 flex items-center gap-2 text-xl font-bold text-foreground">
              <Key className={`h-5 w-5 ${completed ? "text-success" : "text-accent"}`} />
              <span className="text-sm">{doorStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress stepper - one dot per paper, so progress is visible at a
          glance without counting solvedIds mentally. */}
      <div className="flex items-center gap-2">
        {QUESTIONS.map((q, index) => {
          const isSolved = solvedIds.includes(q.id);
          const isCurrent = index === currentIndex && started && !completed && !gameOver;
          return (
            <div
              key={q.id}
              className={`flex h-8 flex-1 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                isSolved
                  ? "border-success/40 bg-success/15 text-success"
                  : isCurrent
                    ? "border-accent bg-accent/15 text-accent animate-pulse-glow"
                    : "border-border bg-bg-secondary text-text-muted"
              }`}
            >
              {isSolved ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1033] via-[#241a45] to-[#160f2b] p-6 text-slate-100 shadow-[inset_0_0_120px_rgba(15,23,42,0.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,139,250,0.18),_transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_30%)]" />
            <div
              className="relative mx-auto w-full max-w-[840px] rounded-[32px] border border-white/10 overflow-hidden"
              style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}`, background: "linear-gradient(160deg, #2a1f4d 0%, #1c1438 55%, #150f2b 100%)" }}
            >
              {/* Floor rug */}
              <div
                className="absolute rounded-3xl opacity-30"
                style={{ left: "20%", top: "70%", width: "60%", height: "22%", background: "radial-gradient(ellipse, rgba(250,204,21,0.35), transparent 70%)" }}
              />

              {/* Decorative furniture (emoji-based - no external art assets needed) */}
              {FURNITURE.map((item, i) => (
                <div
                  key={i}
                  className="absolute select-none opacity-70"
                  style={{ left: item.left, top: item.top, fontSize: item.size, transform: `rotate(${item.rotate}deg)`, filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.4))" }}
                >
                  {item.emoji}
                </div>
              ))}

              {/* Door */}
              <div
                className={`absolute flex flex-col items-center justify-center rounded-2xl border-2 text-3xl transition-all ${
                  completed ? "border-success bg-success/20 shadow-[0_0_30px_rgba(34,197,94,0.5)]" : "border-white/20 bg-black/30"
                }`}
                style={{ left: "82%", top: "40%", width: 110, height: 170 }}
              >
                <span>{completed ? "\u{1F6AA}" : "\u{1F512}"}</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/60">{completed ? "Open" : "Locked"}</span>
              </div>

              {/* Hero */}
              <div
                className="absolute flex items-center justify-center transition-[left,top] duration-100 ease-out"
                style={{
                  left: `${(playerX / ROOM_WIDTH) * 100}%`,
                  top: `${(playerY / ROOM_HEIGHT) * 100}%`,
                  width: HERO_SIZE,
                  height: HERO_SIZE,
                }}
              >
                <div
                  className={`flex h-full w-full items-center justify-center rounded-full border-2 border-accent/60 bg-gradient-to-br from-accent/30 to-accent/10 text-3xl shadow-[0_0_16px_rgba(168,139,250,0.5)] ${isMoving ? "scale-105" : ""}`}
                  style={{ transform: playerDirection === "left" ? "scaleX(-1)" : "none", transition: "transform 0.15s ease" }}
                  role="img"
                  aria-label="Hero"
                >
                  {"\u{1F9D2}"}
                </div>
              </div>

              {/* Hidden papers */}
              {papers.map((paper, index) => {
                if (paper.locked || !started) return null;
                const posStyle = { left: `${paper.position.left}%`, top: `${paper.position.top}%`, transform: "translate(-50%, -50%)" };

                if (paper.solved) {
                  return (
                    <div
                      key={paper.id}
                      className="absolute flex h-12 w-12 items-center justify-center rounded-xl border border-success/40 bg-success/10 text-success"
                      style={posStyle}
                      title={`Paper ${index + 1}: solved`}
                    >
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                  );
                }

                if (!paper.current) return null;

                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => {
                      setFeedback("Solve the fraction shown here using BODMAS, then submit your answer.");
                      setFeedbackTone("neutral");
                      answerInputRef.current?.focus();
                    }}
                    className={`absolute z-10 rounded-xl border-2 bg-yellow-100/95 px-3 py-2 text-left text-xs font-bold text-slate-900 shadow-glow transition-all hover:scale-110 hover:shadow-glow-intense ${
                      discovered ? "border-success animate-pulse-glow scale-105" : "border-accent/60 animate-pulse-glow"
                    }`}
                    style={{ ...posStyle, width: 104, minHeight: 60 }}
                  >
                    <div className="text-[9px] uppercase tracking-widest text-slate-700 font-extrabold">
                      {discovered ? "Found! Solve it →" : "Hidden Paper"}
                    </div>
                    <div className="mt-1 text-sm text-slate-800 leading-tight font-black">{paper.question}</div>
                  </button>
                );
              })}

              {/* Win / lose overlay */}
              {(completed || gameOver) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm text-center px-6">
                  {completed ? (
                    <>
                      <PartyPopper className="h-14 w-14 text-success animate-bounce" />
                      <h3 className="text-2xl font-black text-success">You Escaped!</h3>
                      <p className="max-w-xs text-sm text-slate-300">
                        Solved {solvedIds.length}/{QUESTIONS.length} papers with {wrongCount} mistake{wrongCount === 1 ? "" : "s"}, {formatDuration(timeLeft)} left on the clock.
                      </p>
                    </>
                  ) : (
                    <>
                      <SkullIcon className="h-14 w-14 text-error" />
                      <h3 className="text-2xl font-black text-error">The Monster Got You!</h3>
                      <p className="max-w-xs text-sm text-slate-300">
                        {timeLeft <= 0 ? "Time ran out" : "Too many wrong answers"} - {solvedIds.length}/{QUESTIONS.length} papers solved.
                      </p>
                    </>
                  )}
                  <button type="button" onClick={restartGame} className="btn btn-primary btn-md mt-2">
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </button>
                </div>
              )}

              {/* Not-started overlay */}
              {!started && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm text-center px-6">
                  <div className="text-5xl">{"\u{1F9D2}"}</div>
                  <p className="max-w-xs text-sm text-slate-300">Move with arrow keys or WASD, find the glowing paper, and solve the fraction before time runs out.</p>
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <ArrowRight className="h-4 w-4" />
                    Start Game
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card rounded-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-label-md text-text-muted">EMOTION RECOMMENDATION</p>
                  <h2 className="mt-2 text-heading-lg text-foreground">AI-Driven Guidance</h2>
                </div>
                {loadingRec ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Sparkles className="h-6 w-6 text-accent" />}
              </div>
              <div className="mt-4 text-body-md text-text-secondary">
                {recError ? <span className="text-error">{recError}</span> : recommendation ? (
                  <>
                    <div className="font-semibold text-accent">{recommendation.recommendation.title}</div>
                    <div className="mt-2 text-label-md text-text-muted">Reason</div>
                    <p className="mt-1 text-body-sm text-text-secondary">{recommendation.trigger_reason}</p>
                  </>
                ) : (
                  <span className="text-text-muted">Loading recommendation from emotion engine...</span>
                )}
              </div>
              <button
                type="button"
                onClick={refreshRecommendation}
                className="mt-4 btn btn-secondary btn-md"
              >
                <Sparkles className="h-4 w-4" />
                Refresh
              </button>
              {analytics?.distribution?.BORED != null && (
                <div className="mt-4 rounded-2xl bg-accent/10 p-3 text-body-sm text-accent border border-accent/20">
                  Boredom: <span className="font-bold">{analytics.distribution.BORED.toFixed(1)}%</span>. This challenge helps re-engage when above 30%.
                </div>
              )}
            </div>

            <div className="card rounded-2xl">
              <p className="text-label-md text-text-muted">HOW TO WIN</p>
              <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
              <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
                <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Click Start to enter the room</li>
                <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Walk to the glowing paper to reveal it</li>
                <li className="flex gap-3"><span className="text-accent font-bold">3.</span> Solve the fraction correctly to collect it</li>
                <li className="flex gap-3"><span className="text-error font-bold">4.</span> {MAX_WRONG} wrong answers or running out of time ends the run</li>
              </ul>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-label-md text-text-muted">CURRENT CHALLENGE</div>
                <h2 className="mt-1 text-heading-lg text-foreground">Paper #{Math.min(currentIndex + 1, QUESTIONS.length)}</h2>
              </div>
              <div className="badge badge-primary">
                BODMAS
              </div>
            </div>
            <div className="mt-4 text-body-md leading-7 text-text-secondary">
              {started ? (
                completed || !currentQuestion ? (
                  <p className="text-success font-semibold">All papers solved! Claim your reward on the left.</p>
                ) : gameOver ? (
                  <p className="text-error font-semibold">Door locked. Restart to try again.</p>
                ) : (
                  <>
                    <div className={`rounded-2xl bg-accent/10 p-4 text-body-md text-foreground shadow-inner border transition-all ${discovered ? "border-success/50" : "border-accent/20"} ${shake ? "animate-shake" : ""}`}>
                      <div className="font-bold text-accent text-2xl">{currentQuestion.question}</div>
                      <div className="mt-3 text-label-md text-text-muted">HINT</div>
                      <p className="mt-1 text-body-sm text-text-secondary">{currentQuestion.hint}</p>
                    </div>
                    <form onSubmit={submitAnswer} className="mt-4 space-y-3">
                      <label className="block text-label-md font-bold text-foreground">Your Answer</label>
                      <input
                        ref={answerInputRef}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        disabled={gameOver || completed}
                        placeholder="e.g. 3/4 or 0.75"
                        className="input-field w-full"
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        disabled={gameOver || completed || !answer.trim()}
                        className="btn btn-primary btn-lg w-full disabled:opacity-50"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Submit answer
                      </button>
                    </form>
                  </>
                )
              ) : (
                <p className="text-body-md text-text-secondary">Press Start to begin the adventure and help the hero escape!</p>
              )}
            </div>
          </div>

          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-label-md text-text-muted">ATMOSPHERE</div>
                <h2 className="mt-1 text-heading-lg text-foreground">Story Status</h2>
              </div>
              {monsterIcon}
            </div>
            <div className="mt-4 text-body-md leading-7">
              <p className={`font-semibold ${feedbackColor}`}>{feedback}</p>
              <p className="mt-3 text-label-md text-text-muted">MISTAKES</p>
              <div className="mt-1 flex items-center gap-1.5">
                {Array.from({ length: MAX_WRONG }).map((_, i) => (
                  i < wrongCount
                    ? <XCircle key={i} className="h-5 w-5 text-error" />
                    : <div key={i} className="h-5 w-5 rounded-full border-2 border-border" />
                ))}
                <span className="ml-2 text-body-sm text-text-muted">{wrongCount} of {MAX_WRONG}</span>
              </div>
            </div>
          </div>

          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted mb-4">GAME CONTROLS</div>
            <div className="flex flex-col gap-3">
              {!started || completed || gameOver ? (
                <button
                  type="button"
                  onClick={startGame}
                  className="btn btn-primary btn-lg"
                >
                  <ArrowRight className="h-4 w-4" />
                  {started ? "Play Again" : "Start Game"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={restartGame}
                  className="btn btn-secondary btn-lg"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
              )}
              <Link
                to="/"
                className="btn btn-md rounded-lg bg-bg-secondary border border-accent/20 text-foreground hover:bg-accent/10 inline-flex items-center justify-center gap-2"
              >
                <Puzzle className="h-4 w-4" />
                Back to Menu
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
