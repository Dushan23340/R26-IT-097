import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Waves,
  TreePalm,
  Footprints,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Milestone,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// Grade-9 number patterns: General Term Tn for n = 1..5. Sequences and
// distractors are exactly as specified - each verified by hand:
//   Island 1: Tn = 3n+2  -> 5, 8, 11, 14, 17
//   Island 2: Tn = 4n-1  -> 3, 7, 11, 15, 19
//   Island 3: Tn = 5-2n  -> 3, 1, -1, -3, -5
//   Island 4: Tn = n^2+1 -> 2, 5, 10, 17, 26
// "bridgeTiles" mixes the 5 correct stepping stones with 3 decoy values
// interleaved near their real counterpart - the player must click the
// tile matching the CURRENT step's value; any other tile (a decoy, or a
// correct value visited out of order) is a fall.
const ISLANDS = [
  {
    id: "island-1",
    formula: "Tn = 3n + 2",
    correctSequence: [5, 8, 11, 14, 17],
    bridgeTiles: [6, 5, 9, 8, 12, 11, 14, 17],
  },
  {
    id: "island-2",
    formula: "Tn = 4n - 1",
    correctSequence: [3, 7, 11, 15, 19],
    bridgeTiles: [4, 3, 8, 7, 10, 11, 15, 19],
  },
  {
    id: "island-3",
    formula: "Tn = 5 - 2n",
    correctSequence: [3, 1, -1, -3, -5],
    bridgeTiles: [2, 3, 0, 1, -2, -1, -3, -5],
  },
  {
    id: "island-4",
    formula: "Tn = n^2 + 1",
    correctSequence: [2, 5, 10, 17, 26],
    bridgeTiles: [3, 2, 6, 5, 12, 10, 17, 26],
  },
];

const MAX_FALLS_PER_ISLAND = 3; // 3 strikes on one island and the run ends

const Route = createFileRoute("/pattern-islands")({
  head: () => ({
    meta: [
      { title: "Pattern Islands — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 number patterns platformer - jump only on stepping stones matching each island's General Term Tn.",
      },
    ],
  }),
  component: PatternIslandsPage,
});

function PatternIslandsPage() {
  const { reportFinish } = useGameSession("pattern_islands");

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [islandIndex, setIslandIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0); // which n (0-4) is next on this island
  const [islandFalls, setIslandFalls] = useState(0); // falls on the CURRENT island
  const [totalFalls, setTotalFalls] = useState(0);
  const [splashed, setSplashed] = useState(false);
  const [justJumped, setJustJumped] = useState(null);
  const [finalCleared, setFinalCleared] = useState(0);

  const island = ISLANDS[islandIndex];
  const islandsCleared = islandIndex; // fully-crossed islands before the current one

  function startGame() {
    setScreen("playing");
    setIslandIndex(0);
    setStepIndex(0);
    setIslandFalls(0);
    setTotalFalls(0);
    setSplashed(false);
    setJustJumped(null);
    setFinalCleared(0);
  }

  function reportAndEnd(outcome, clearedCount) {
    setFinalCleared(clearedCount);
    reportFinish(outcome, Math.round((clearedCount / ISLANDS.length) * 100), {
      correctCount: clearedCount,
      totalCount: ISLANDS.length,
    });
    setScreen(outcome === "win" ? "won" : "lost");
  }

  function jumpTo(value) {
    if (screen !== "playing" || splashed) return;
    const target = island.correctSequence[stepIndex];

    if (value === target) {
      setJustJumped(value);
      const nextStep = stepIndex + 1;
      window.setTimeout(() => setJustJumped(null), 500);

      if (nextStep >= island.correctSequence.length) {
        // Island cleared
        const nextIslandIndex = islandIndex + 1;
        if (nextIslandIndex >= ISLANDS.length) {
          reportAndEnd("win", ISLANDS.length);
        } else {
          setIslandIndex(nextIslandIndex);
          setStepIndex(0);
          setIslandFalls(0);
        }
      } else {
        setStepIndex(nextStep);
      }
    } else {
      setSplashed(true);
      const newIslandFalls = islandFalls + 1;
      const newTotalFalls = totalFalls + 1;
      setTotalFalls(newTotalFalls);

      window.setTimeout(() => {
        setSplashed(false);
        if (newIslandFalls >= MAX_FALLS_PER_ISLAND) {
          reportAndEnd("loss", islandsCleared);
        } else {
          setIslandFalls(newIslandFalls);
          setStepIndex(0); // restart this island's path from the beginning
        }
      }, 900);
    }
  }

  const won = screen === "won";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <TreePalm className="h-4 w-4" />
            GAME 7 · PATTERN ISLANDS
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Pattern Islands</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            Jump from island to island across floating tiles - but only the tiles that match each
            island's General Term Tn are safe. Step wrong and you'll splash back to the start of that path.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">ISLAND</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{Math.min(islandIndex + 1, ISLANDS.length)}/{ISLANDS.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">STEP</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">{Math.min(stepIndex + 1, island.correctSequence.length)}/{island.correctSequence.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">FALLS</div>
            <div className="mt-2 text-display-sm font-bold text-error">{totalFalls}</div>
          </div>
        </div>
      </div>

      <section className="container-game rounded-3xl relative">
        <div
          className="relative overflow-hidden rounded-3xl p-8 min-h-[480px] transition-colors duration-500"
          style={{
            background: splashed
              ? "linear-gradient(180deg, #1a5c8a 0%, #0d3a5c 100%)"
              : "linear-gradient(180deg, #7fd4e8 0%, #2fa8c9 55%, #1a7a9e 100%)",
          }}
        >
          {screen === "start" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 rounded-3xl">
              <div className="max-w-sm text-center px-6">
                <TreePalm className="mx-auto h-12 w-12 text-emerald-200" />
                <h2 className="mt-4 text-heading-lg text-white">4 islands await</h2>
                <p className="mt-2 text-sm text-slate-100">
                  Each island has its own General Term. Jump only on tiles that belong to the pattern -
                  {MAX_FALLS_PER_ISLAND} falls on one island and the crossing ends.
                </p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Start Crossing
                </button>
              </div>
            </div>
          )}

          {screen === "playing" && (
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3 justify-center">
                {ISLANDS.map((isl, idx) => (
                  <div key={isl.id} className="flex items-center gap-2">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                        idx < islandIndex
                          ? "bg-success/80 border-success text-white"
                          : idx === islandIndex
                          ? "bg-amber-400 border-amber-200 text-slate-900"
                          : "bg-white/20 border-white/30 text-white/70"
                      }`}
                    >
                      <TreePalm className="h-5 w-5" />
                    </div>
                    {idx < ISLANDS.length - 1 && <div className="h-0.5 w-6 bg-white/40" />}
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-2">
                <Milestone className="h-8 w-8 text-amber-200" />
                <div className="rounded-xl bg-white/90 px-5 py-2 text-slate-900 font-bold text-lg shadow-lg">
                  {island.formula}
                </div>
                <p className="text-xs text-slate-100">Find n = {stepIndex + 1}: what is T{stepIndex + 1}?</p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl select-none" role="img" aria-label="Hero">
                  {splashed ? "💦" : "🏃"}
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {island.bridgeTiles.map((value, idx) => {
                    const stepPosition = island.correctSequence.indexOf(value);
                    const alreadyCrossed = stepPosition !== -1 && stepPosition < stepIndex;
                    const isBouncing = justJumped === value;
                    return (
                      <button
                        key={`${island.id}-${idx}`}
                        type="button"
                        onClick={() => jumpTo(value)}
                        disabled={alreadyCrossed || splashed}
                        className={`h-14 w-14 rounded-lg border-2 flex items-center justify-center font-bold text-lg transition-all ${
                          alreadyCrossed
                            ? "bg-success/70 border-success text-white opacity-60"
                            : isBouncing
                            ? "bg-success border-success text-white scale-110"
                            : "bg-amber-200 border-amber-500 text-amber-900 hover:scale-105"
                        }`}
                        style={{ boxShadow: "0 3px 0 rgba(120,80,20,0.5)" }}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>

                {splashed && (
                  <p className="text-sm font-semibold text-red-100 bg-red-900/40 rounded-lg px-3 py-1.5">
                    Splash! That tile wasn't part of the pattern - back to the start of this island.
                  </p>
                )}
              </div>
            </div>
          )}

          {(screen === "won" || screen === "lost") && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6 rounded-2xl bg-white/90 backdrop-blur-sm py-8">
                {won ? (
                  <Sparkles className="mx-auto h-14 w-14 text-emerald-500" />
                ) : (
                  <Waves className="mx-auto h-14 w-14 text-slate-400" />
                )}
                <h2 className={`mt-4 text-heading-lg font-bold ${won ? "text-emerald-900" : "text-slate-700"}`}>
                  {won ? "All Islands Crossed!" : "Swept Out to Sea"}
                </h2>
                <p className={`mt-2 ${won ? "text-emerald-800" : "text-slate-600"}`}>
                  {won
                    ? "You mastered every General Term along the way!"
                    : `Too many falls on island ${islandIndex + 1} - review the pattern rule and try again.`}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {finalCleared}/{ISLANDS.length} islands crossed - {totalFalls} total falls.
                </p>
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

      <div className="card rounded-2xl">
        <p className="text-label-md text-text-muted">HOW TO WIN</p>
        <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
        <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
          <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Each island shows a General Term Tn - work out T1, T2, T3... in order</li>
          <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Click the tile matching the next value in the sequence to jump safely</li>
          <li className="flex gap-3"><span className="text-error font-bold">3.</span> A wrong tile splashes you back to the start of that island's path</li>
          <li className="flex gap-3"><span className="text-error font-bold">4.</span> {MAX_FALLS_PER_ISLAND} falls on one island ends the crossing</li>
        </ul>
      </div>
    </div>
  );
}

export { Route };
