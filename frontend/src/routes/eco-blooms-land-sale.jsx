import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sprout,
  Ruler,
  RotateCcw,
  ArrowRight,
  PartyPopper,
  Frown,
  Volume2,
  VolumeX,
  Lightbulb,
  Calculator,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// Grade-9 area practice: Square = side x side, Rectangle = length x breadth,
// Triangle = 0.5 x base x height. 12 land plots, every area value unique
// (no two plots share an area) so there's exactly one correct plot per
// customer request - the challenge is calculating correctly, not guessing
// among ties.
const LAND_PLOTS = [
  { id: "p1", shape: "square", side: 3, area: 9, pos: { left: "6%", top: "12%" } },
  { id: "p2", shape: "square", side: 4, area: 16, pos: { left: "30%", top: "10%" } },
  { id: "p3", shape: "square", side: 5, area: 25, pos: { left: "54%", top: "14%" } },
  { id: "p4", shape: "square", side: 6, area: 36, pos: { left: "78%", top: "10%" } },
  { id: "p5", shape: "rectangle", length: 9, breadth: 2, area: 18, pos: { left: "6%", top: "42%" } },
  { id: "p6", shape: "rectangle", length: 6, breadth: 4, area: 24, pos: { left: "30%", top: "40%" } },
  { id: "p7", shape: "rectangle", length: 8, breadth: 5, area: 40, pos: { left: "54%", top: "42%" } },
  { id: "p8", shape: "rectangle", length: 7, breadth: 6, area: 42, pos: { left: "78%", top: "40%" } },
  { id: "p9", shape: "triangle", base: 10, height: 6, area: 30, pos: { left: "6%", top: "72%" } },
  { id: "p10", shape: "triangle", base: 8, height: 5, area: 20, pos: { left: "30%", top: "72%" } },
  { id: "p11", shape: "triangle", base: 14, height: 4, area: 28, pos: { left: "54%", top: "72%" } },
  { id: "p12", shape: "triangle", base: 9, height: 6, area: 27, pos: { left: "78%", top: "72%" } },
];

const CUSTOMERS = [
  { id: "c1", name: "Mia", emoji: "\u{1F469}", targetPlotId: "p6", ask: "Hello! I want a land of 24 square meters, please." },
  { id: "c2", name: "Raj", emoji: "\u{1F468}\u{200D}\u{1F9B1}", targetPlotId: "p3", ask: "Hi there! I'm looking for exactly 25 square meters for my eco farm." },
  { id: "c3", name: "Grandma Lin", emoji: "\u{1F475}", targetPlotId: "p9", ask: "Good day! I need a plot of 30 square meters, please." },
  { id: "c4", name: "Tomas", emoji: "\u{1F474}", targetPlotId: "p8", ask: "Hello! Can you show me a land of 42 square meters?" },
  { id: "c5", name: "Aisha", emoji: "\u{1F9D5}", targetPlotId: "p10", ask: "Hi! I'd like a land of 20 square meters, please." },
];

const OWNER_HOME = { left: "42%", top: "94%" };

function plotDimensionLabel(plot) {
  if (plot.shape === "square") return `Side: ${plot.side}m`;
  if (plot.shape === "rectangle") return `L: ${plot.length}m, B: ${plot.breadth}m`;
  return `Base: ${plot.base}m, H: ${plot.height}m`;
}

function plotShapeLabel(plot) {
  return plot.shape === "square" ? "Square" : plot.shape === "rectangle" ? "Rectangle" : "Triangle";
}

// ---------- Web Audio synthesis (no external sound files needed) ----------

function useLandSounds() {
  const ctxRef = useRef(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (freq, startOffset, duration, type = "sine", peakGain = 0.15) => {
      if (mutedRef.current) return;
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    },
    [getCtx]
  );

  const playClick = useCallback(() => playTone(600, 0, 0.06, "sine", 0.08), [playTone]);
  const playWalk = useCallback(() => {
    playTone(220, 0, 0.05, "square", 0.04);
    playTone(180, 0.08, 0.05, "square", 0.04);
  }, [playTone]);
  const playCorrect = useCallback(() => {
    [523.25, 659.25, 783.99].forEach((f, i) => playTone(f, i * 0.09, 0.22, "triangle", 0.16));
  }, [playTone]);
  const playWrong = useCallback(() => playTone(180, 0, 0.3, "sawtooth", 0.12), [playTone]);
  const playVictory = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, i * 0.13, 0.35, "triangle", 0.18));
  }, [playTone]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      return !m;
    });
  }, []);

  return { playClick, playWalk, playCorrect, playWrong, playVictory, muted, toggleMute };
}

// ---------- Web Speech API (falls back to subtitle-only text if unsupported) ----------

function speak(text, { rate = 1, pitch = 1, enabled = true } = {}) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  } catch {
    // best-effort - subtitles already cover this case
  }
}

const Route = createFileRoute("/eco-blooms-land-sale")({
  head: () => ({
    meta: [
      { title: "Eco Blooms Land Sale — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 area-of-shapes simulation - calculate square, rectangle, and triangle areas to sell customers the matching eco-friendly land plot.",
      },
    ],
  }),
  component: EcoBloomsLandSalePage,
});

function EcoBloomsLandSalePage() {
  const { reportFinish } = useGameSession("eco_blooms_land");
  const sounds = useLandSounds();
  const reportedRef = useRef(false);

  const [screen, setScreen] = useState("start"); // start | playing | done
  const [customerIndex, setCustomerIndex] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [mistakesByShape, setMistakesByShape] = useState({ square: 0, rectangle: 0, triangle: 0 });
  const [ownerPos, setOwnerPos] = useState(OWNER_HOME);
  const [feedback, setFeedback] = useState(null); // {text, tone}
  const [subtitle, setSubtitle] = useState("");
  const [showFormulas, setShowFormulas] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [awaitingNext, setAwaitingNext] = useState(false);

  const customer = CUSTOMERS[customerIndex];
  const targetPlot = useMemo(() => LAND_PLOTS.find((p) => p.id === customer?.targetPlotId), [customer]);

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setCustomerIndex(0);
    setSolvedCount(0);
    setMistakesByShape({ square: 0, rectangle: 0, triangle: 0 });
    setOwnerPos(OWNER_HOME);
    setFeedback(null);
    setConfetti(false);
    setAwaitingNext(false);
  };

  // Speak + subtitle the current customer's request whenever they change.
  useEffect(() => {
    if (screen !== "playing" || !customer) return;
    setSubtitle(`${customer.name}: "${customer.ask}"`);
    setFeedback(null);
    const timer = window.setTimeout(() => speak(customer.ask, { rate: 1, pitch: 1.1, enabled: voiceEnabled }), 400);
    return () => window.clearTimeout(timer);
  }, [screen, customerIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToNextCustomer = () => {
    if (customerIndex + 1 < CUSTOMERS.length) {
      setCustomerIndex((i) => i + 1);
      setOwnerPos(OWNER_HOME);
      setAwaitingNext(false);
    } else {
      reportedRef.current = true;
      const outcome = solvedCount >= 3 ? "win" : "loss";
      reportFinish(outcome, Math.round((solvedCount / CUSTOMERS.length) * 100), {
        correctCount: solvedCount,
        totalCount: CUSTOMERS.length,
      });
      setScreen("done");
    }
  };

  const selectPlot = (plot) => {
    if (screen !== "playing" || awaitingNext || !customer) return;
    sounds.playClick();
    sounds.playWalk();
    setOwnerPos(plot.pos);

    const isCorrect = plot.id === customer.targetPlotId;
    window.setTimeout(() => {
      if (isCorrect) {
        setSolvedCount((c) => c + 1);
        setFeedback({ text: "Perfect! Thank you!", tone: "good" });
        setSubtitle(`${customer.name}: "Perfect! Thank you!"`);
        speak("Perfect! Thank you!", { rate: 1, pitch: 1.1, enabled: voiceEnabled });
        sounds.playCorrect();
        setConfetti(true);
        window.setTimeout(() => setConfetti(false), 1200);
        setAwaitingNext(true);
      } else {
        setMistakesByShape((prev) => ({ ...prev, [plot.shape]: prev[plot.shape] + 1 }));
        const line = `That area is ${plot.area} sqm, not ${targetPlot?.area} sqm. Try again!`;
        setFeedback({ text: line, tone: "bad" });
        setSubtitle(`Owner: "${line}"`);
        speak(line, { rate: 1, pitch: 0.9, enabled: voiceEnabled });
        sounds.playWrong();
      }
    }, 500);
  };

  const totalMistakes = mistakesByShape.square + mistakesByShape.rectangle + mistakesByShape.triangle;
  const weakestShape = totalMistakes > 0
    ? Object.entries(mistakesByShape).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  useEffect(() => {
    if (screen === "done" && solvedCount >= 3) sounds.playVictory();
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Sprout className="h-4 w-4" />
            GAME 8 · ECO BLOOMS LAND SALE
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Eco Blooms Lands - Sustainable Plots</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            You're the Land Owner. Customers will ask for a plot by area (square meters) - calculate each
            land's area (Square, Rectangle, or Triangle) and click the matching plot to sell it.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SOLD</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{solvedCount}/{CUSTOMERS.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">CUSTOMER</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">
              {screen === "playing" ? customerIndex + 1 : screen === "done" ? CUSTOMERS.length : 0}/{CUSTOMERS.length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className="card rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-accent/40 transition-colors"
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5 text-accent" /> : <VolumeX className="h-5 w-5 text-text-muted" />}
            <span className="text-[10px] text-text-muted">{voiceEnabled ? "Voice On" : "Muted"}</span>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${(solvedCount / CUSTOMERS.length) * 100}%`, background: "var(--gradient-primary)" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#bdeaff] via-[#a8e6a1] to-[#6fbf6f] p-4 min-h-[480px]">
            {/* Fence border decoration */}
            <div className="absolute inset-3 border-4 border-dashed border-amber-700/30 rounded-2xl pointer-events-none" />
            {["\u{1F333}", "\u{1F332}", "\u{1F333}", "\u{1F332}"].map((tree, i) => (
              <div
                key={i}
                className="absolute text-3xl select-none pointer-events-none opacity-80"
                style={{ left: `${2 + i * 32}%`, top: i % 2 === 0 ? "0%" : "94%" }}
              >
                {tree}
              </div>
            ))}

            {/* Signboard */}
            <div className="relative z-10 mx-auto mb-3 w-fit rounded-lg bg-amber-800 px-4 py-1.5 text-center shadow-md">
              <span className="text-xs font-bold text-amber-50 tracking-wide">Eco Blooms Lands - Sustainable Plots</span>
            </div>

            {/* Land plots */}
            <div className="relative h-[420px]">
              {LAND_PLOTS.map((plot) => {
                const isTarget = screen === "playing" && plot.id === customer?.targetPlotId;
                return (
                  <button
                    key={plot.id}
                    type="button"
                    onClick={() => selectPlot(plot)}
                    disabled={screen !== "playing" || awaitingNext}
                    className="absolute flex flex-col items-center gap-1 group disabled:cursor-not-allowed"
                    style={{ left: plot.pos.left, top: plot.pos.top, width: "18%" }}
                    title={`${plotShapeLabel(plot)} plot`}
                  >
                    <div
                      className={`w-full aspect-square flex items-center justify-center border-2 transition-all group-hover:scale-105 group-hover:shadow-lg ${
                        plot.shape === "triangle" ? "bg-transparent border-none" : "bg-lime-300/70 border-lime-700/60"
                      } ${plot.shape === "square" ? "rounded-md" : plot.shape === "rectangle" ? "rounded-md !aspect-[1.6/1]" : ""}`}
                      style={
                        plot.shape === "triangle"
                          ? {
                              width: 0,
                              height: 0,
                              borderLeft: "26px solid transparent",
                              borderRight: "26px solid transparent",
                              borderBottom: "46px solid rgba(190,242,100,0.8)",
                              margin: "0 auto",
                            }
                          : undefined
                      }
                    />
                    <div className="rounded bg-amber-50 border border-amber-700/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 shadow-sm whitespace-nowrap">
                      {plotDimensionLabel(plot)}
                    </div>
                  </button>
                );
              })}

              {/* Owner sprite */}
              <div
                className="absolute flex flex-col items-center transition-[left,top] duration-500 ease-in-out z-20"
                style={{ left: ownerPos.left, top: ownerPos.top, width: 48, transform: "translate(-50%, -50%)" }}
              >
                <div className="text-3xl drop-shadow" role="img" aria-label="Land owner">
                  {"\u{1F468}\u{200D}\u{1F4BC}"}
                </div>
              </div>

              {/* Customer */}
              {screen === "playing" && customer && (
                <div className="absolute z-20" style={{ left: "42%", top: "2%", transform: "translate(-50%, 0)" }}>
                  <div className="text-3xl text-center drop-shadow" role="img" aria-label={customer.name}>
                    {customer.emoji}
                  </div>
                </div>
              )}

              {/* Confetti */}
              {confetti && (
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute text-lg animate-bounce"
                      style={{
                        left: `${(i * 41) % 100}%`,
                        top: `${(i * 17) % 60}%`,
                        animationDelay: `${(i % 6) * 0.08}s`,
                        animationDuration: "0.9s",
                      }}
                    >
                      {["\u{1F389}", "\u{1F38A}", "✨"][i % 3]}
                    </span>
                  ))}
                </div>
              )}

              {/* Start overlay */}
              {screen === "start" && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm rounded-2xl text-center px-6">
                  <Sprout className="h-14 w-14 text-lime-300" />
                  <h2 className="text-2xl font-black text-white">Welcome to Eco Blooms Land Sale!</h2>
                  <p className="max-w-xs text-sm text-slate-100">
                    5 customers are coming. Calculate each land's area and click the plot that matches what they ask for.
                  </p>
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <ArrowRight className="h-4 w-4" />
                    Start Game
                  </button>
                </div>
              )}

              {/* End overlay */}
              {screen === "done" && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm rounded-2xl text-center px-6">
                  {solvedCount >= 3 ? (
                    <PartyPopper className="h-14 w-14 text-lime-300 animate-bounce" />
                  ) : (
                    <Frown className="h-14 w-14 text-slate-300" />
                  )}
                  <h2 className="text-2xl font-black text-white">You sold {solvedCount}/{CUSTOMERS.length} lands!</h2>
                  <p className="text-sm text-slate-100">
                    {solvedCount >= 3 ? "Great job, Land Owner!" : "Review the formulas and give it another shot."}
                  </p>
                  {weakestShape && (
                    <p className="max-w-xs text-xs text-amber-200">
                      Most mistakes were on <span className="font-bold capitalize">{weakestShape}</span> plots
                      ({mistakesByShape[weakestShape]}) - worth practicing that shape's formula more.
                    </p>
                  )}
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                    <RotateCcw className="h-4 w-4" />
                    Play Again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Subtitle bar - always shown, doubles as the Web Speech API fallback */}
          <div className="mt-4 card rounded-2xl min-h-[64px] flex items-center">
            <p className={`text-body-md font-medium ${feedback?.tone === "good" ? "text-success" : feedback?.tone === "bad" ? "text-error" : "text-foreground"}`}>
              {subtitle || "Click Start Game to begin."}
            </p>
          </div>

          {awaitingNext && (
            <button type="button" onClick={goToNextCustomer} className="mt-4 btn btn-primary btn-lg w-full">
              <ArrowRight className="h-4 w-4" />
              {customerIndex + 1 < CUSTOMERS.length ? "Next Customer" : "See Results"}
            </button>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted mb-4">GAME CONTROLS</div>
            <div className="flex flex-col gap-3">
              {screen !== "playing" ? (
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  {screen === "start" ? "Start Game" : "Play Again"}
                </button>
              ) : (
                <button type="button" onClick={startGame} className="btn btn-secondary btn-lg">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              )}
              <button type="button" onClick={() => setShowHint((h) => !h)} className="btn btn-secondary btn-md">
                <Lightbulb className="h-4 w-4" />
                Hint
              </button>
              <button type="button" onClick={() => setShowFormulas((f) => !f)} className="btn btn-secondary btn-md">
                <Calculator className="h-4 w-4" />
                Area Formula Reminder
              </button>
              <Link
                to="/"
                className="btn btn-md rounded-lg bg-bg-secondary border border-accent/20 text-foreground hover:bg-accent/10 inline-flex items-center justify-center gap-2"
              >
                Back to Dashboard
              </Link>
            </div>

            {showHint && screen === "playing" && (
              <div className="mt-4 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm text-text-secondary">
                Check every plot's shape and dimensions, apply the right formula, and look for the one whose
                area equals what {customer?.name ?? "the customer"} asked for. Not all plots use the same shape!
              </div>
            )}

            {showFormulas && (
              <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-body-sm space-y-1.5">
                <div className="flex items-center gap-2"><Ruler className="h-3.5 w-3.5 text-accent" /> Square = side x side (a<sup>2</sup>)</div>
                <div className="flex items-center gap-2"><Ruler className="h-3.5 w-3.5 text-accent" /> Rectangle = length x breadth (l x b)</div>
                <div className="flex items-center gap-2"><Ruler className="h-3.5 w-3.5 text-accent" /> Triangle = 0.5 x base x height</div>
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Listen to (or read) each customer's requested area</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Calculate every plot's area from its shown dimensions</li>
              <li className="flex gap-3"><span className="text-accent font-bold">3.</span> Click the one matching plot to sell it</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Sell at least 3 of 5 lands for a great result</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
