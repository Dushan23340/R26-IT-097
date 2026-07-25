import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DoorClosed,
  DoorOpen,
  Lock,
  Sun,
  Skull,
  RotateCcw,
  ArrowRight,
  BedDouble,
  BookOpen,
  Archive,
  LampDesk,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// Grade-9 algebraic fraction questions, one per furniture item. Answers
// verified by hand:
//   Q1: 3/(2x) + 5/(3x)  -> LCD 6x -> 9/(6x) + 10/(6x) = 19/(6x)
//   Q2: (2 1/3) * (6/7)  -> (7/3)*(6/7) = 42/21 = 2
//   Q3: (4a/5) / (2a/15) -> (4a/5)*(15/2a) = 60a/10a = 6
//   Q4: spends 1/3 + 1/4 = 7/12, remaining 5/12 = 50 -> total = 50*12/5 = 120
const FURNITURE = [
  {
    id: "desk",
    label: "Desk",
    icon: LampDesk,
    prompt: "Simplify: 3/(2x) + 5/(3x)",
    options: ["19/(6x)", "8/(5x)", "3/(6x)", "19/(5x)"],
    answer: "19/(6x)",
  },
  {
    id: "bed",
    label: "Bed",
    icon: BedDouble,
    prompt: "Solve: (2 1/3) x (6/7)",
    options: ["2", "1 5/7", "14/21", "3"],
    answer: "2",
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    icon: BookOpen,
    prompt: "Simplify: (4a/5) divided by (2a/15)",
    options: ["6", "2a", "1/6", "30"],
    answer: "6",
  },
  {
    id: "closet",
    label: "Closet",
    icon: Archive,
    prompt: "A student spends 1/3 of their allowance on books, 1/4 on food, and has $50 left. Find the total allowance.",
    options: ["$120", "$100", "$150", "$144"],
    answer: "$120",
  },
];

const MAX_WRONG = 2; // 2 or more wrong -> fail, per spec (need >=3/4 correct to pass)

const Route = createFileRoute("/dark-room-escape")({
  head: () => ({
    meta: [
      { title: "Escape the Dark Room — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 algebraic fractions escape room - inspect furniture for hidden question scrolls before the glowing eyes catch you.",
      },
    ],
  }),
  component: DarkRoomEscapePage,
});

function DarkRoomEscapePage() {
  const { reportFinish } = useGameSession("dark_room");

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [solvedIds, setSolvedIds] = useState([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [activeFurniture, setActiveFurniture] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null

  const correctCount = solvedIds.length;
  const answeredCount = correctCount + wrongCount;

  useEffect(() => {
    if (screen !== "playing" || answeredCount < FURNITURE.length) return;
    const won = correctCount >= 3;
    reportFinish(won ? "win" : "loss", Math.round((correctCount / FURNITURE.length) * 100), {
      correctCount,
      totalCount: FURNITURE.length,
    });
    setScreen(won ? "won" : "lost");
  }, [answeredCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    setScreen("playing");
    setSolvedIds([]);
    setWrongCount(0);
    setActiveFurniture(null);
    setSelectedOption(null);
    setFeedback(null);
  }

  function openFurniture(item) {
    if (screen !== "playing" || solvedIds.includes(item.id)) return;
    setActiveFurniture(item);
    setSelectedOption(null);
    setFeedback(null);
  }

  function submitAnswer() {
    if (!activeFurniture || selectedOption == null) return;
    const correct = selectedOption === activeFurniture.answer;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setSolvedIds((prev) => [...prev, activeFurniture.id]);
    } else {
      setWrongCount((prev) => prev + 1);
    }
    setTimeout(() => {
      setActiveFurniture(null);
      setFeedback(null);
    }, 1100);
  }

  const doorUnlocked = screen === "won";
  const roomBlackout = screen === "lost";
  const eyesCount = roomBlackout ? 8 : Math.min(2 + wrongCount * 2, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Lock className="h-4 w-4" />
            GAME 3 · ESCAPE THE DARK ROOM
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Escape the Dark Room</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            Inspect the furniture to find hidden fraction question scrolls. Answer 3 of 4 correctly
            to unlock the door before the eyes in the dark find you.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SOLVED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{correctCount}/{FURNITURE.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">MISSED</div>
            <div className="mt-2 text-display-sm font-bold text-error">{wrongCount}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">DOOR</div>
            <div className="mt-2 flex items-center gap-2 text-foreground">
              {doorUnlocked ? <DoorOpen className="h-5 w-5 text-success" /> : <DoorClosed className="h-5 w-5 text-error" />}
              <span className="text-sm">{doorUnlocked ? "Unlocked" : "Locked"}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="container-game rounded-3xl relative">
        <div
          className="relative overflow-hidden rounded-3xl p-8 min-h-[480px] transition-colors duration-700"
          style={{
            background: roomBlackout
              ? "#000000"
              : doorUnlocked
              ? "linear-gradient(180deg, #fef9e7 0%, #fde9b8 40%, #2a2418 100%)"
              : "linear-gradient(180deg, #0a0a12 0%, #1a1626 55%, #14101c 100%)",
          }}
        >
          {/* Glowing red eyes in the dark corners */}
          {!doorUnlocked &&
            Array.from({ length: eyesCount }).map((_, i) => (
              <div
                key={i}
                className="absolute flex gap-1.5 animate-pulse"
                style={{
                  top: `${8 + ((i * 37) % 75)}%`,
                  left: i % 2 === 0 ? `${4 + (i % 3) * 4}%` : undefined,
                  right: i % 2 !== 0 ? `${4 + (i % 3) * 4}%` : undefined,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 shadow-[0_0_10px_3px_rgba(220,38,38,0.8)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 shadow-[0_0_10px_3px_rgba(220,38,38,0.8)]" />
              </div>
            ))}

          {doorUnlocked && (
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,247,200,0.9), transparent 60%)" }}
            />
          )}

          {/* Scared student + door */}
          {!roomBlackout && (
            <div className="relative z-10 flex items-center justify-center gap-10 mb-8">
              <div className="text-6xl select-none" role="img" aria-label="Scared student">
                {doorUnlocked ? "🙂" : "😨"}
              </div>
              <div className="flex flex-col items-center gap-1">
                {doorUnlocked ? (
                  <DoorOpen className="h-16 w-16 text-amber-300" />
                ) : (
                  <DoorClosed className="h-16 w-16 text-slate-400" />
                )}
                <span className="text-xs text-slate-300">{doorUnlocked ? "Door unlocked" : "Locked door"}</span>
              </div>
            </div>
          )}

          {roomBlackout && (
            <div className="relative z-10 flex flex-col items-center justify-center h-[380px] text-center">
              <Skull className="h-16 w-16 text-red-600 mb-4" />
              <h2 className="text-2xl font-bold text-red-500">Caught in the Dark!</h2>
              <p className="mt-2 text-slate-300">Try again to escape!</p>
            </div>
          )}

          {screen === "start" && !roomBlackout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20 rounded-3xl">
              <div className="max-w-sm text-center px-6">
                <Lock className="mx-auto h-12 w-12 text-red-500" />
                <h2 className="mt-4 text-heading-lg text-white">The door is locked...</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Search the room for hidden question scrolls. Get 3 of 4 right before something in the
                  dark notices you.
                </p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Enter the Room
                </button>
              </div>
            </div>
          )}

          {screen === "playing" && (
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {FURNITURE.map((item) => {
                const Icon = item.icon;
                const solved = solvedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openFurniture(item)}
                    disabled={solved}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                      solved
                        ? "border-success/50 bg-success/10 opacity-70"
                        : "border-white/15 bg-white/5 hover:border-accent/60 hover:bg-white/10"
                    }`}
                  >
                    <Icon className={`h-8 w-8 ${solved ? "text-success" : "text-slate-200"}`} />
                    <span className="text-xs font-semibold text-slate-100">{item.label}</span>
                    <span className="text-[10px] text-slate-400">{solved ? "Searched" : "Inspect"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {screen === "won" && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6 rounded-2xl bg-white/80 backdrop-blur-sm py-8">
                <Sun className="mx-auto h-14 w-14 text-amber-500" />
                <h2 className="mt-4 text-heading-lg text-amber-900 font-bold">Escaped!</h2>
                <p className="mt-2 text-amber-800">Excellent Fraction Mastery!</p>
                <p className="mt-1 text-sm text-amber-700">{correctCount} of {FURNITURE.length} scrolls solved.</p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <RotateCcw className="h-4 w-4" />
                    Play Again
                  </button>
                  <Link to="/" className="btn btn-secondary btn-lg">
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}

          {screen === "lost" && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6">
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </button>
                  <Link to="/" className="btn btn-secondary btn-lg">
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Question modal */}
      {activeFurniture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card rounded-2xl max-w-md w-full">
            <div className="text-label-md text-text-muted">HIDDEN SCROLL - {activeFurniture.label.toUpperCase()}</div>
            <h3 className="mt-2 text-heading-lg text-foreground">{activeFurniture.prompt}</h3>
            <div className="mt-4 space-y-2">
              {activeFurniture.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedOption(opt)}
                  disabled={feedback != null}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-body-sm font-semibold transition-colors ${
                    feedback != null && opt === activeFurniture.answer
                      ? "border-success bg-success/10 text-success"
                      : feedback === "wrong" && opt === selectedOption
                      ? "border-error bg-error/10 text-error"
                      : selectedOption === opt
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-white/10 hover:border-accent/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {feedback == null ? (
              <button
                type="button"
                onClick={submitAnswer}
                disabled={selectedOption == null}
                className="mt-4 btn btn-primary btn-lg w-full"
              >
                <ArrowRight className="h-4 w-4" />
                Submit Answer
              </button>
            ) : (
              <div className={`mt-4 rounded-xl p-3 text-body-sm font-semibold ${feedback === "correct" ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                {feedback === "correct" ? "Correct! The scroll crumbles to dust." : `Not quite - the answer was ${activeFurniture.answer}.`}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card rounded-2xl">
        <p className="text-label-md text-text-muted">HOW TO WIN</p>
        <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
        <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
          <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Inspect all 4 furniture items to find hidden fraction questions</li>
          <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Answer 3 or 4 correctly to unlock the door and escape</li>
          <li className="flex gap-3"><span className="text-error font-bold">3.</span> 2 or more wrong answers and the dark catches you</li>
        </ul>
      </div>
    </div>
  );
}

export { Route };
