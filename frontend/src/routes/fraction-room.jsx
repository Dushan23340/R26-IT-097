import { useEffect, useMemo, useRef, useState } from "react";
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

const HIDDEN_PAPER_POSITIONS = [
  { left: "16%", top: "62%" },
  { left: "28%", top: "74%" },
  { left: "42%", top: "52%" },
  { left: "58%", top: "66%" },
  { left: "22%", top: "69%" },
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

  const roomRef = useRef(null);
  const ROOM_WIDTH = 840;
  const ROOM_HEIGHT = 420;
  const BOY_WIDTH = 64;
  const BOY_HEIGHT = 80;
  const PLAYER_SIZE = { width: 8, height: 12 };
  const PAPER_SIZE = { width: 8, height: 6 };
  const DOOR_AREA = { left: 82, top: 48, width: 14, height: 34 };
  const KEY_AREA = { left: 76, top: 54, width: 8, height: 6 };

  const [playerX, setPlayerX] = useState(() => Math.max(0, Math.floor((ROOM_WIDTH - BOY_WIDTH) / 2)));
  const [playerY, setPlayerY] = useState(() => Math.max(0, Math.floor(ROOM_HEIGHT - BOY_HEIGHT - 20)));
  const [playerDirection, setPlayerDirection] = useState("right");

  const clampToRoom = (x, y) => ({
    x: Math.max(0, Math.min(ROOM_WIDTH - BOY_WIDTH, x)),
    y: Math.max(0, Math.min(ROOM_HEIGHT - BOY_HEIGHT, y)),
  });

  const overlapRect = (a, b) => {
    return !(
      a.left + a.width < b.left ||
      a.left > b.left + b.width ||
      a.top + a.height < b.top ||
      a.top > b.top + b.height
    );
  };

  const getPlayerRect = () => ({
    left: playerX,
    top: playerY,
    width: BOY_WIDTH,
    height: BOY_HEIGHT,
  });

  const currentQuestion = QUESTIONS[currentIndex];
  const remainingQuestions = Math.max(QUESTIONS.length - currentIndex, 0);
  const currentPaper = useMemo(
    () => QUESTIONS.map((question, index) => ({
      ...question,
      position: HIDDEN_PAPER_POSITIONS[index % HIDDEN_PAPER_POSITIONS.length],
      solved: solvedIds.includes(question.id),
      active: index === currentIndex && started && !completed && !gameOver,
    })),
    [currentIndex, solvedIds, started, completed, gameOver]
  );

  const doorStatus = completed ? "Door unlocked" : gameOver ? "Door locked" : "Door sealed";

  const monsterIcon = monsterMood === "happy" ? <Smile className="h-8 w-8 text-emerald-600" /> : monsterMood === "angry" ? <Frown className="h-8 w-8 text-destructive" /> : <Search className="h-8 w-8 text-yellow-500" />;

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
    } catch (error) {
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
          dx = -8;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dx = 8;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          dy = -8;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dy = 8;
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, gameOver, completed, playerX, playerY]);

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
    if (!started || completed || gameOver) return;
    const activePaper = currentPaper.find((paper) => paper.active && !paper.solved);
    if (!activePaper) return;

    const playerRect = getPlayerRect();
    const paperRect = {
      left: parseFloat(activePaper.position.left),
      top: parseFloat(activePaper.position.top),
      width: PAPER_SIZE.width,
      height: PAPER_SIZE.height,
    };

    if (overlapRect(playerRect, paperRect)) {
      setSolvedIds((prev) => (prev.includes(activePaper.id) ? prev : [...prev, activePaper.id]));
      setCurrentIndex((value) => value + 1);
      setFeedback("You found the paper by moving the hero over it. Now solve the next fraction.");
    }
  }, [playerX, playerY, currentPaper, started, completed, gameOver]);

  useEffect(() => {
    if (!started || gameOver) return;

    const playerRect = getPlayerRect();
    if (overlapRect(playerRect, DOOR_AREA)) {
      if (completed) {
        setFeedback("The door is unlocked and ready to open.");
      } else {
        setFeedback("The door is sealed until all papers are solved.");
      }
    }
  }, [playerX, playerY, completed, gameOver, started]);

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
    setFeedback("The game begins! The boy is searching the messy room for the first hidden paper. Move to find it and solve the fraction with BODMAS.");
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
      setFeedback("Nice! The boy moves to the next hidden paper beneath the clutter.");
    } else {
      setWrongCount((value) => value + 1);
      setFeedback("Wrong answer. Recheck the brackets and BODMAS order.");
    }
  };

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
            <div className="text-label-md text-text-muted">TIME LEFT</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{formatDuration(timeLeft)}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">REMAINING</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">{remainingQuestions}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">DOOR STATUS</div>
            <div className="mt-2 flex items-center gap-2 text-xl font-bold text-foreground">
              <Key className="h-5 w-5 text-accent" />
              <span className="text-sm">{doorStatus}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1929] via-[#162444] to-[#0f1f3a] p-6 text-slate-100 shadow-[inset_0_0_120px_rgba(15,23,42,0.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.15),_transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_30%)]" />
            <div
              ref={roomRef}
              className="relative h-[420px] w-[840px] rounded-[32px] border border-white/10 bg-cover bg-center overflow-hidden"
              style={{
                backgroundImage: `url('/images/messy-room.png')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div
                role="img"
                aria-label="Boy"
                className="absolute transition-transform"
                style={{
                  left: `${playerX}px`,
                  top: `${playerY}px`,
                  width: `${BOY_WIDTH}px`,
                  height: `${BOY_HEIGHT}px`,
                  backgroundImage: `url('/images/boy-sprite.png')`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  transform: playerDirection === 'left' ? 'scaleX(-1)' : 'none',
                  willChange: 'transform, left, top',
                }}
              />

              {/* HIDDEN PAPERS - behind/under furniture */}
              {currentPaper.map((paper, index) => {
                if (!paper.active) return null;
                const pos = paper.position;

                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => {
                      if (!started || gameOver || completed) return;
                      if (index !== currentIndex) return;
                      setFeedback("Solve the current paper by applying BODMAS to the expression.");
                    }}
                    className="absolute rounded-xl border-3 border-accent/60 bg-yellow-100/95 px-3 py-2 text-left text-xs font-bold text-slate-900 shadow-glow transition-all hover:scale-110 hover:shadow-glow-intense z-10 animate-pulse-glow"
                    style={{ left: pos.left, top: pos.top, width: 90, minHeight: 56 }}
                  >
                    <div className="text-[9px] uppercase tracking-widest text-slate-700 font-extrabold">Paper</div>
                    <div className="mt-1 text-xs text-slate-800 leading-tight font-semibold">Tap to solve</div>
                  </button>
                );
              })}
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
                <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Click Start to enter</li>
                <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Move hero to papers and solve with BODMAS</li>
                <li className="flex gap-3"><span className="text-accent font-bold">3.</span> Correct answers unlock the door</li>
                <li className="flex gap-3"><span className="text-error font-bold">4.</span> Avoid timeout and too many errors</li>
              </ul>
            </div>

            <div className="card rounded-2xl">
              <div className="flex items-center gap-2 text-label-md text-text-muted">
                <Key className="h-4 w-4" />
                <span>KEY STATUS</span>
              </div>
              <div className="mt-4 text-body-md font-semibold">
                {completed ? (
                  <span className="text-success">✓ Key received! Door open.</span>
                ) : gameOver ? (
                  <span className="text-error">✗ Game over — monster blocked escape.</span>
                ) : (
                  <span className="text-text-secondary">Monster will give key after solving all papers.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-label-md text-text-muted">CURRENT CHALLENGE</div>
                <h2 className="mt-1 text-heading-lg text-foreground">Paper #{currentIndex + 1}</h2>
              </div>
              <div className="badge badge-primary">
                BODMAS
              </div>
            </div>
            <div className="mt-4 text-body-md leading-7 text-text-secondary">
              {started ? (
                completed ? (
                  <p className="text-success font-semibold">✓ All papers solved! Claim your reward.</p>
                ) : gameOver ? (
                  <p className="text-error font-semibold">✗ Door locked. Restart to try again.</p>
                ) : (
                  <>
                    <div className="rounded-2xl bg-accent/10 p-4 text-body-md text-foreground shadow-inner border border-accent/20">
                      <div className="font-bold text-accent text-2xl">{currentQuestion.question}</div>
                      <div className="mt-3 text-label-md text-text-muted">HINT</div>
                      <p className="mt-1 text-body-sm text-text-secondary">{currentQuestion.hint}</p>
                    </div>
                    <div className="mt-4 rounded-2xl border border-accent/30 bg-slate-900/50 p-4 shadow-lg">
                      <div className="text-label-md text-text-muted">WHITEBOARD</div>
                      <div className="mt-3 min-h-[96px] rounded-lg bg-slate-800/50 p-4 text-2xl font-bold text-accent shadow-inner">
                        {currentQuestion.question}
                      </div>
                    </div>
                    <form onSubmit={submitAnswer} className="mt-4 space-y-3">
                      <label className="block text-label-md font-bold text-foreground">Your Answer</label>
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        disabled={gameOver || completed}
                        placeholder="Type your answer here..."
                        className="input-field w-full"
                      />
                      <button
                        type="submit"
                        disabled={gameOver || completed}
                        className="btn btn-primary btn-lg w-full"
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
              {completed ? <CheckCircle2 className="h-6 w-6 text-success" /> : gameOver ? <Frown className="h-6 w-6 text-error" /> : <Smile className="h-6 w-6 text-accent" />}
            </div>
            <div className="mt-4 text-body-md leading-7">
              <p className="text-foreground font-semibold">{feedback}</p>
              <p className="mt-3 text-label-md text-text-muted">MISTAKES</p>
              <p className="text-body-md font-bold">{wrongCount} <span className="text-text-muted font-normal">of {MAX_WRONG}</span></p>
            </div>
          </div>

          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted mb-4">GAME CONTROLS</div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={startGame}
                className="btn btn-primary btn-lg"
              >
                <ArrowRight className="h-4 w-4" />
                Start Game
              </button>
              <button
                type="button"
                onClick={restartGame}
                className="btn btn-secondary btn-lg"
              >
                <Sparkles className="h-4 w-4" />
                Restart
              </button>
              <Link
                to="/adaptive"
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
