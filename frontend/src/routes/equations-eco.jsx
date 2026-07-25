import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Droplets,
  Trees,
  Rainbow,
  RotateCcw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// Grade-9 linear equation questions, one per pond. Answers verified by hand:
//   Q1: 3(x-4)=15 -> x-4=5 -> x=9
//   Q2: (2x+1)/3=5 -> 2x+1=15 -> x=7
//   Q3: 5x-7=2x+8 -> 3x=15 -> x=5
//   Q4: x/2 + x/4 = 9 -> 3x/4=9 -> x=12
//   Q5: twice a number added to 7 gives 25 -> 2n+7=25 -> n=9
const PONDS = [
  {
    id: "pond-1",
    label: "Pond 1",
    prompt: "Solve for x: 3(x - 4) = 15",
    options: ["x = 9", "x = 5", "x = 13", "x = 1"],
    answer: "x = 9",
  },
  {
    id: "pond-2",
    label: "Pond 2",
    prompt: "Solve for x: (2x + 1) / 3 = 5",
    options: ["x = 7", "x = 6", "x = 8", "x = 2"],
    answer: "x = 7",
  },
  {
    id: "pond-3",
    label: "Pond 3",
    prompt: "Solve for x: 5x - 7 = 2x + 8",
    options: ["x = 5", "x = 3", "x = -5", "x = 1"],
    answer: "x = 5",
  },
  {
    id: "pond-4",
    label: "Pond 4",
    prompt: "Solve for x: x/2 + x/4 = 9",
    options: ["x = 12", "x = 9", "x = 6", "x = 36"],
    answer: "x = 12",
  },
  {
    id: "pond-5",
    label: "Pond 5",
    prompt: "Twice a number added to 7 gives 25. Find the number.",
    options: ["n = 9", "n = 8", "n = 18", "n = 16"],
    answer: "n = 9",
  },
];

const WIN_THRESHOLD = 4; // must solve at least 4 of 5 to restore the forest

const Route = createFileRoute("/equations-eco")({
  head: () => ({
    meta: [
      { title: "Equations Eco: Forest Restoration — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 linear equations game - clear the polluted ponds by solving for x and restore the forest.",
      },
    ],
  }),
  component: EquationsEcoPage,
});

function EquationsEcoPage() {
  const { reportFinish } = useGameSession("equations_eco");

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [solvedIds, setSolvedIds] = useState([]);
  const [wrongIds, setWrongIds] = useState([]);
  const [activePond, setActivePond] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null

  const correctCount = solvedIds.length;
  const answeredCount = correctCount + wrongIds.length;

  useEffect(() => {
    if (screen !== "playing" || answeredCount < PONDS.length) return;
    const won = correctCount >= WIN_THRESHOLD;
    reportFinish(won ? "win" : "loss", Math.round((correctCount / PONDS.length) * 100), {
      correctCount,
      totalCount: PONDS.length,
    });
    setScreen(won ? "won" : "lost");
  }, [answeredCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    setScreen("playing");
    setSolvedIds([]);
    setWrongIds([]);
    setActivePond(null);
    setSelectedOption(null);
    setFeedback(null);
  }

  function openPond(pond) {
    if (screen !== "playing" || solvedIds.includes(pond.id) || wrongIds.includes(pond.id)) return;
    setActivePond(pond);
    setSelectedOption(null);
    setFeedback(null);
  }

  function submitAnswer() {
    if (!activePond || selectedOption == null) return;
    const correct = selectedOption === activePond.answer;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setSolvedIds((prev) => [...prev, activePond.id]);
    } else {
      setWrongIds((prev) => [...prev, activePond.id]);
    }
    setTimeout(() => {
      setActivePond(null);
      setFeedback(null);
    }, 1300);
  }

  const restored = screen === "won";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Trees className="h-4 w-4" />
            GAME 5 · EQUATIONS ECO
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Equations Eco: Forest Restoration</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            Solve for x at each polluted pond to clear the water and bring the forest back to life.
            Restore at least 4 of the 5 ponds to save the ecosystem.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">CLEARED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{correctCount}/{PONDS.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">MISSED</div>
            <div className="mt-2 text-display-sm font-bold text-error">{wrongIds.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">ECOSYSTEM</div>
            <div className="mt-2 flex items-center gap-2 text-foreground">
              {restored ? <Rainbow className="h-5 w-5 text-success" /> : <Droplets className="h-5 w-5 text-error" />}
              <span className="text-sm">{restored ? "Restored" : "Polluted"}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="container-game rounded-3xl relative">
        <div
          className="relative overflow-hidden rounded-3xl p-8 min-h-[480px] transition-colors duration-700"
          style={{
            background: screen === "lost"
              ? "linear-gradient(180deg, #4b3f2a 0%, #2e2a1c 60%, #1a1810 100%)"
              : restored
              ? "linear-gradient(180deg, #bdeaff 0%, #9ee6a0 45%, #4caf50 100%)"
              : "linear-gradient(180deg, #cdeccb 0%, #7fc57f 50%, #3f7d3f 100%)",
          }}
        >
          {restored && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-6xl select-none" role="img" aria-label="Rainbow">
              🌈
            </div>
          )}

          {/* Character */}
          {screen !== "lost" && (
            <div className="relative z-10 flex justify-center mb-6">
              <div className="text-6xl select-none" role="img" aria-label="Boy in blue shorts and yellow t-shirt">
                🧒
              </div>
            </div>
          )}

          {screen === "start" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 rounded-3xl">
              <div className="max-w-sm text-center px-6">
                <Trees className="mx-auto h-12 w-12 text-white" />
                <h2 className="mt-4 text-heading-lg text-white">The forest needs you</h2>
                <p className="mt-2 text-sm text-slate-100">
                  Walk to each polluted pond and solve for x. Clear 4 of 5 ponds to restore the ecosystem.
                </p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Enter the Forest
                </button>
              </div>
            </div>
          )}

          {screen === "playing" && (
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
              {PONDS.map((pond) => {
                const solved = solvedIds.includes(pond.id);
                const missed = wrongIds.includes(pond.id);
                const done = solved || missed;
                return (
                  <button
                    key={pond.id}
                    type="button"
                    onClick={() => openPond(pond)}
                    disabled={done}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-white/20 p-4 transition-all hover:scale-105 disabled:hover:scale-100"
                    style={{
                      background: solved
                        ? "radial-gradient(circle, #7fd8ff 0%, #2f8fd6 100%)"
                        : missed
                        ? "radial-gradient(circle, #3a3a3a 0%, #161616 100%)"
                        : "radial-gradient(circle, #2b2b2b 0%, #0a0a0a 100%)",
                    }}
                  >
                    <span className="text-3xl select-none" role="img" aria-label={solved ? "Lotus flower" : "Polluted pond"}>
                      {solved ? "🪷" : "🟤"}
                    </span>
                    <span className="text-xs font-semibold text-white drop-shadow">{pond.label}</span>
                    <span className="text-[10px] text-white/70">{solved ? "Clear" : missed ? "Missed" : "Inspect"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {screen === "won" && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6 rounded-2xl bg-white/85 backdrop-blur-sm py-8">
                <Sparkles className="mx-auto h-14 w-14 text-emerald-500" />
                <h2 className="mt-4 text-heading-lg text-emerald-900 font-bold">Ecosystem Saved!</h2>
                <p className="mt-2 text-emerald-800">You are an Eco-Math Hero!</p>
                <p className="mt-1 text-sm text-emerald-700">{correctCount} of {PONDS.length} ponds restored.</p>
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
            <div className="relative z-10 flex flex-col items-center justify-center h-[380px] text-center">
              <Droplets className="h-16 w-16 text-slate-400 mb-4" />
              <h2 className="text-2xl font-bold text-slate-200">Ecosystem Still Polluted</h2>
              <p className="mt-2 text-slate-400">Re-try to bring back nature!</p>
              <p className="mt-1 text-sm text-slate-500">{correctCount} of {PONDS.length} ponds restored.</p>
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
          )}
        </div>
      </section>

      {/* Question modal */}
      {activePond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card rounded-2xl max-w-md w-full">
            <div className="text-label-md text-text-muted">{activePond.label.toUpperCase()} - LINEAR EQUATION</div>
            <h3 className="mt-2 text-heading-lg text-foreground">{activePond.prompt}</h3>
            <div className="mt-4 space-y-2">
              {activePond.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedOption(opt)}
                  disabled={feedback != null}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-body-sm font-semibold transition-colors ${
                    feedback != null && opt === activePond.answer
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
                {feedback === "correct" ? "Correct! A lotus blooms on the clear water." : `Not quite - the answer was ${activePond.answer}.`}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card rounded-2xl">
        <p className="text-label-md text-text-muted">HOW TO WIN</p>
        <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
        <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
          <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Inspect all 5 polluted ponds to find hidden linear equations</li>
          <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Solve for x correctly to clear a pond and bloom a lotus</li>
          <li className="flex gap-3"><span className="text-error font-bold">3.</span> Restore at least 4 of 5 ponds to save the ecosystem</li>
        </ul>
      </div>
    </div>
  );
}

export { Route };
