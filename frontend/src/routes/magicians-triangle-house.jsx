import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Heart,
  Clock3,
  RotateCcw,
  ArrowRight,
  PartyPopper,
  Skull,
  Volume2,
  VolumeX,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";
import { randInt, randChoice } from "@/lib/gameRandom";

// Grade-9 triangle angle theorems:
//   Theorem 1: interior angles of a triangle sum to 180 degrees.
//   Theorem 2 (exterior angle theorem): an exterior angle equals the sum
//   of the two remote (non-adjacent) interior angles.
// Every question's `layout` uses the REAL answer to lay out a
// geometrically accurate triangle diagram (see computeTriangle below) -
// the diagram isn't just decorative, the angles shown genuinely match the
// stated numbers.
//
// Freshly randomized per game start (generateQuestions below) - same 3
// templates (angle-sum x2, exterior-angle x2, isosceles x1) every time so
// the UI's fixed theorem badges/labels stay meaningful, but different
// angle values per play so concurrent students get different puzzles.
// Verified against 20,000 generated sets (100,000 questions) in a
// standalone script - every angle stays in a valid, non-degenerate range,
// the angle-sum/exterior-angle theorem identities hold exactly, and the
// value hidden behind "unknown" always matches the stated answer.
function genAngleSum() {
  let angleA, angleB, angleC;
  do {
    angleA = randInt(20, 110, 5);
    angleB = randInt(20, 110, 5);
    angleC = 180 - angleA - angleB;
  } while (angleC < 30 || angleC > 120);
  return {
    id: `sum-${angleA}-${angleB}`,
    theorem: 1,
    prompt: `Two interior angles of a triangle are ${angleA} degrees and ${angleB} degrees. What is the third angle?`,
    answer: angleC,
    layout: { angleA, angleB, unknown: "C", exterior: null },
  };
}

function genIsosceles() {
  const b = randInt(30, 80, 5);
  const vertex = 180 - 2 * b;
  return {
    id: `iso-${b}`,
    theorem: 1,
    prompt: `An isosceles triangle has two equal base angles of ${b} degrees each. What is the vertex angle?`,
    answer: vertex,
    layout: { angleA: b, angleB: b, unknown: "C", exterior: null },
  };
}

function genExterior() {
  let r1, ext, r2;
  do {
    r1 = randInt(20, 100, 5);
    ext = randInt(100, 160, 5);
    r2 = ext - r1;
  } while (r2 < 20 || r2 > 120);
  const unknownSlot = randChoice(["A", "B"]);
  const layout =
    unknownSlot === "A"
      ? { angleA: r2, angleB: r1, unknown: "A", exterior: { atVertex: "C", value: ext } }
      : { angleA: r1, angleB: r2, unknown: "B", exterior: { atVertex: "C", value: ext } };
  return {
    id: `ext-${r1}-${ext}`,
    theorem: 2,
    prompt: `An exterior angle of a triangle is ${ext} degrees. One remote interior angle is ${r1} degrees. What is the other one, x?`,
    answer: r2,
    layout,
  };
}

function generateQuestions() {
  return [genAngleSum(), genAngleSum(), genExterior(), genExterior(), genIsosceles()];
}

const QUESTION_SECONDS = 120;
const HINT_COST_SECONDS = 10;
const MAX_HEARTS = 3;

const KIDS = [
  { id: "k1", emoji: "\u{1F467}", color: "#f472b6", line: "Help us! Please hurry!" },
  { id: "k2", emoji: "\u{1F466}", color: "#60a5fa", line: "You can do it! We believe in you!" },
  { id: "k3", emoji: "\u{1F9D2}", color: "#facc15", line: "The magician trapped us in here!" },
  { id: "k4", emoji: "\u{1F467}\u{200D}\u{1F9B1}", color: "#34d399", line: "Solve the triangle! Save us!" },
  { id: "k5", emoji: "\u{1F466}\u{200D}\u{1F9B0}", color: "#a78bfa", line: "We're counting on you!" },
];

const HERO = { emoji: "\u{1F9D9}", label: "Hero" };

// ---------- Triangle geometry (real trigonometry, not decorative) ----------
// Places A at the origin, B along a horizontal baseline, and derives C via
// the law of sines - so any two given interior angles produce a
// geometrically valid, correctly-proportioned triangle.
function computeTriangle(angleA_deg, angleB_deg, baseline) {
  const angleC_deg = 180 - angleA_deg - angleB_deg;
  const toRad = (d) => (d * Math.PI) / 180;
  const A = { x: 0, y: 0 };
  const B = { x: baseline, y: 0 };
  const AC = (baseline * Math.sin(toRad(angleB_deg))) / Math.sin(toRad(angleC_deg));
  const C = { x: AC * Math.cos(toRad(angleA_deg)), y: -AC * Math.sin(toRad(angleA_deg)) };
  return { A, B, C, angleC_deg };
}

function extendBeyond(from, through, length) {
  const dx = through.x - from.x;
  const dy = through.y - from.y;
  const mag = Math.hypot(dx, dy) || 1;
  return { x: through.x + (dx / mag) * length, y: through.y + (dy / mag) * length };
}

function lerp(p1, p2, t) {
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

function TriangleDiagram({ layout, answer }) {
  const { angleA, angleB, unknown, exterior } = layout;
  const { A, B, C, angleC_deg } = useMemo(() => computeTriangle(angleA, angleB, 180), [angleA, angleB]);
  const centroid = useMemo(() => ({ x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 }), [A, B, C]);
  const D = useMemo(() => (exterior ? extendBeyond(B, C, 90) : null), [exterior, B, C]);

  const points = [A, B, C, D].filter(Boolean);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const pad = 40;
  const offset = { x: -minX + pad, y: -minY + pad };
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const tr = (p) => ({ x: p.x + offset.x, y: p.y + offset.y });

  const labelFor = (vertexKey, numericValue) => (unknown === vertexKey ? "?" : `${Math.round(numericValue)}°`);
  const labelPos = (vertex) => lerp(vertex, centroid, 0.28);

  const tA = tr(A);
  const tB = tr(B);
  const tC = tr(C);
  const tD = D ? tr(D) : null;
  const lA = tr(labelPos(A));
  const lB = tr(labelPos(B));
  const lC = exterior ? null : tr(labelPos(C));
  const extLabelPos = D ? tr(extendBeyond(C, D, 24)) : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-64" role="img" aria-label="Triangle diagram">
      {tD && (
        <>
          <line x1={tB.x} y1={tB.y} x2={tD.x} y2={tD.y} stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" />
          <text x={extLabelPos.x} y={extLabelPos.y} fontSize="14" fontWeight="bold" fill="#fbbf24" textAnchor="middle">
            {exterior.value}&#176;
          </text>
        </>
      )}
      <polygon points={`${tA.x},${tA.y} ${tB.x},${tB.y} ${tC.x},${tC.y}`} fill="rgba(167,139,250,0.25)" stroke="#c4b5fd" strokeWidth="2.5" />
      <text x={lA.x} y={lA.y} fontSize="15" fontWeight="bold" fill="#fef3c7" textAnchor="middle">
        {labelFor("A", angleA)}
      </text>
      <text x={lB.x} y={lB.y} fontSize="15" fontWeight="bold" fill="#fef3c7" textAnchor="middle">
        {labelFor("B", angleB)}
      </text>
      {lC && (
        <text x={lC.x} y={lC.y} fontSize="15" fontWeight="bold" fill="#fef3c7" textAnchor="middle">
          {labelFor("C", angleC_deg)}
        </text>
      )}
    </svg>
  );
}

// ---------- Web Audio synthesis (real SFX, no recorded clips available) ----------

function useMagicSounds() {
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

  const playChime = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, i * 0.1, 0.3, "triangle", 0.15));
  }, [playTone]);
  const playSting = useCallback(() => {
    [300, 220, 150].forEach((f, i) => playTone(f, i * 0.09, 0.25, "sawtooth", 0.13));
  }, [playTone]);
  const playVictory = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => playTone(f, i * 0.12, 0.35, "triangle", 0.17));
  }, [playTone]);
  const playClick = useCallback(() => playTone(700, 0, 0.06, "sine", 0.08), [playTone]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      return !m;
    });
  }, []);

  return { playChime, playSting, playVictory, playClick, muted, toggleMute };
}

function speak(text, { rate = 1, pitch = 1, enabled = true } = {}) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    window.speechSynthesis.speak(utterance);
  } catch {
    // best-effort - subtitles/speech bubbles already cover this case
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const Route = createFileRoute("/magicians-triangle-house")({
  head: () => ({
    meta: [
      { title: "The Magician's Triangle House — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 triangle angle theorems escape game - solve angle-sum and exterior-angle problems to free trapped friends from the magic house.",
      },
    ],
  }),
  component: MagiciansTriangleHousePage,
});

function MagiciansTriangleHousePage() {
  const { reportFinish } = useGameSession("magicians_triangle_house");
  const sounds = useMagicSounds();
  const reportedRef = useRef(false);
  const inputRef = useRef(null);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  // Freshly randomized on mount and again on every startGame() call - see
  // generateQuestions above.
  const [questions, setQuestions] = useState(() => generateQuestions());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [rescued, setRescued] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // {text, tone}
  const [doorState, setDoorState] = useState("closed"); // closed | opening | open
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mistakesByTheorem, setMistakesByTheorem] = useState({ 1: 0, 2: 0 });
  const [confetti, setConfetti] = useState(false);
  const [freedKidIds, setFreedKidIds] = useState([]);
  const [awaitingNext, setAwaitingNext] = useState(false);

  const question = questions[questionIndex];
  const trappedKids = KIDS.filter((k) => !freedKidIds.includes(k.id));

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setQuestions(generateQuestions());
    setQuestionIndex(0);
    setHearts(MAX_HEARTS);
    setRescued(0);
    setAnswer("");
    setFeedback(null);
    setDoorState("closed");
    setTimeLeft(QUESTION_SECONDS);
    setShowHint(false);
    setMistakesByTheorem({ 1: 0, 2: 0 });
    setConfetti(false);
    setFreedKidIds([]);
    setAwaitingNext(false);
  };

  // A trapped kid "shouts" once per new puzzle - real speechSynthesis, not
  // a literal audio loop (which would overlap badly across re-renders).
  useEffect(() => {
    if (screen !== "playing" || !question) return;
    const kid = trappedKids[questionIndex % Math.max(trappedKids.length, 1)] || trappedKids[0];
    setFeedback(null);
    setShowHint(false);
    const timer = window.setTimeout(() => {
      if (kid) speak(kid.line, { rate: 1.05, pitch: 1.3, enabled: voiceEnabled });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [screen, questionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-question countdown timer.
  useEffect(() => {
    if (screen !== "playing" || awaitingNext) return undefined;
    if (timeLeft <= 0) {
      handleTimeout();
      return undefined;
    }
    const timer = window.setInterval(() => setTimeLeft((t) => Math.max(t - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, timeLeft, awaitingNext]); // eslint-disable-line react-hooks/exhaustive-deps

  function loseHeart(reason) {
    setMistakesByTheorem((prev) => ({ ...prev, [question.theorem]: prev[question.theorem] + 1 }));
    const newHearts = hearts - 1;
    setHearts(newHearts);
    if (newHearts <= 0) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((rescued / questions.length) * 100), {
        correctCount: rescued,
        totalCount: questions.length,
      });
      setScreen("lost");
      return;
    }
    sounds.playSting();
    speak("Ha ha! Wrong! Try again!", { rate: 1, pitch: 0.7, enabled: voiceEnabled });
    setFeedback({ text: reason, tone: "bad" });
    setTimeLeft(QUESTION_SECONDS);
  }

  function handleTimeout() {
    loseHeart("Time's up! The magician cackles. Try again!");
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (screen !== "playing" || awaitingNext || !question) return;
    const parsed = Number(answer.trim());
    if (!Number.isFinite(parsed)) return;

    speak(`The answer is ${parsed} degrees!`, { rate: 1, pitch: 1.15, enabled: voiceEnabled });

    if (parsed === question.answer) {
      setAwaitingNext(true);
      setDoorState("opening");
      sounds.playChime();
      window.setTimeout(() => {
        setDoorState("open");
        const kid = trappedKids[0];
        if (kid) {
          setFreedKidIds((prev) => [...prev, kid.id]);
          speak("Yes! I'm free! Thank you!", { rate: 1.1, pitch: 1.4, enabled: voiceEnabled });
        }
        setRescued((r) => r + 1);
        setFeedback({ text: "The door glows and opens! A friend runs free!", tone: "good" });
      }, 700);
      window.setTimeout(() => setDoorState("closed"), 1800);
    } else {
      loseHeart(`Not quite - that's not correct. Try again!`);
    }
    setAnswer("");
  }

  function goToNext() {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((i) => i + 1);
      setTimeLeft(QUESTION_SECONDS);
      setAwaitingNext(false);
    } else {
      reportedRef.current = true;
      reportFinish("win", 100, { correctCount: questions.length, totalCount: questions.length });
      setScreen("won");
      setConfetti(true);
      sounds.playVictory();
    }
  }

  function useHint() {
    setShowHint(true);
    setTimeLeft((t) => Math.max(t - HINT_COST_SECONDS, 1));
  }

  const weakestTheorem = mistakesByTheorem[1] === mistakesByTheorem[2]
    ? null
    : mistakesByTheorem[1] > mistakesByTheorem[2] ? 1 : 2;

  const magicianPeeking = screen === "playing" && !awaitingNext && timeLeft <= 30;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Sparkles className="h-4 w-4" />
            GAME 9 · MAGICIAN'S TRIANGLE HOUSE
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">The Magician's Triangle House</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            5 friends are trapped in a magic glass room. Solve each triangle's angle puzzle to open the door
            and set a friend free - using the Angle Sum and Exterior Angle theorems.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SAVED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{rescued}/{questions.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">HEARTS</div>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Heart key={i} className={`h-5 w-5 ${i < hearts ? "text-error fill-error" : "text-border"}`} />
              ))}
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

      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${(rescued / questions.length) * 100}%`, background: "var(--gradient-primary)" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0d1a0f] via-[#132618] to-[#0a1510] p-4 min-h-[520px]">
            {/* Fog + fireflies (CSS only, no image assets) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.05),transparent_40%)] pointer-events-none" />
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-yellow-300 animate-pulse pointer-events-none"
                style={{
                  left: `${(i * 37) % 95}%`,
                  top: `${(i * 53) % 90}%`,
                  boxShadow: "0 0 6px 2px rgba(253,224,71,0.7)",
                  animationDelay: `${(i % 5) * 0.3}s`,
                }}
              />
            ))}
            {["\u{1F332}", "\u{1F333}", "\u{1F332}"].map((tree, i) => (
              <div key={i} className="absolute text-4xl opacity-60 pointer-events-none" style={{ left: `${4 + i * 44}%`, top: "2%" }}>
                {tree}
              </div>
            ))}

            {/* Magician peeking when time is low */}
            {magicianPeeking && (
              <div className="absolute top-3 right-4 text-3xl animate-bounce z-30" role="img" aria-label="Magician">
                {"\u{1F9D9}\u{200D}\u{2642}\u{FE0F}"}
              </div>
            )}

            {/* The magic house */}
            <div className="relative z-10 mx-auto mt-6 w-full max-w-md rounded-3xl border-2 border-purple-400/50 bg-[#1a1030]/80 p-4 shadow-[0_0_30px_rgba(168,139,250,0.35)]">
              <div className="text-center text-xs font-bold uppercase tracking-widest text-purple-200 mb-2">
                &#10024; The Magic House &#10024;
              </div>

              {/* Glass room with trapped kids */}
              <div className="rounded-2xl border border-cyan-300/40 bg-cyan-400/10 p-3 mb-3">
                <div className="flex flex-wrap justify-center gap-3">
                  {trappedKids.map((kid) => (
                    <div key={kid.id} className="relative flex flex-col items-center">
                      <div className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-cyan-100 mb-1 whitespace-nowrap max-w-[90px] truncate">
                        {"\u{1F4AC}"} {kid.line.split("!")[0]}!
                      </div>
                      <div className="text-3xl animate-pulse" role="img" aria-label="Trapped friend">
                        {kid.emoji}
                      </div>
                    </div>
                  ))}
                  {trappedKids.length === 0 && <p className="text-xs text-cyan-100 py-2">Everyone is free!</p>}
                </div>
              </div>

              {/* Door */}
              <div className="flex justify-center mb-3">
                <div
                  className={`flex h-16 w-24 items-center justify-center rounded-t-2xl border-2 text-2xl transition-all duration-700 ${
                    doorState === "open"
                      ? "border-amber-300 bg-amber-300/30 shadow-[0_0_25px_rgba(252,211,77,0.7)] scale-110"
                      : doorState === "opening"
                      ? "border-amber-300 bg-amber-300/20 animate-pulse"
                      : "border-amber-800 bg-amber-900/40"
                  }`}
                >
                  {doorState === "open" ? "\u{1F6AA}" : "\u{1F512}"}
                </div>
              </div>

              {/* Triangle diagram */}
              {screen === "playing" && question && (
                <div className="rounded-xl bg-slate-950/50 border border-purple-400/20 p-2">
                  <TriangleDiagram layout={question.layout} answer={question.answer} />
                </div>
              )}
            </div>

            {/* Hero */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-3xl z-10" role="img" aria-label="Hero">
              {HERO.emoji}
            </div>

            {/* Confetti on win */}
            {confetti && (
              <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-lg animate-bounce"
                    style={{ left: `${(i * 31) % 100}%`, top: `${(i * 13) % 60}%`, animationDelay: `${(i % 6) * 0.08}s`, animationDuration: "0.9s" }}
                  >
                    {["\u{1F389}", "\u{1F386}", "✨"][i % 3]}
                  </span>
                ))}
              </div>
            )}

            {/* Start overlay */}
            {screen === "start" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm rounded-3xl text-center px-6">
                <Sparkles className="h-14 w-14 text-purple-300" />
                <h2 className="text-2xl font-black text-white">The Magician's Triangle House</h2>
                <p className="max-w-xs text-sm text-slate-200">
                  5 friends are trapped in the jungle magic house. Solve each triangle puzzle to open the door
                  and set them free - but watch your hearts and the clock!
                </p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Start Game
                </button>
              </div>
            )}

            {/* Win overlay */}
            {screen === "won" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <PartyPopper className="h-14 w-14 text-amber-300 animate-bounce" />
                <h2 className="text-2xl font-black text-white">All friends saved! You are a Triangle Master!</h2>
                <p className="text-sm text-slate-200">All 5 puzzles solved with {hearts} heart{hearts === 1 ? "" : "s"} remaining.</p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            )}

            {/* Lose overlay */}
            {screen === "lost" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <Skull className="h-14 w-14 text-red-400" />
                <h2 className="text-2xl font-black text-white">Out of Hearts!</h2>
                <p className="text-sm text-slate-200">You freed {rescued} of {questions.length} friends before running out of hearts.</p>
                {weakestTheorem && (
                  <p className="max-w-xs text-xs text-amber-200">
                    Most mistakes were on <span className="font-bold">Theorem {weakestTheorem}</span> (
                    {weakestTheorem === 1 ? "Angle Sum" : "Exterior Angle"}) - worth reviewing that one.
                  </p>
                )}
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 card rounded-2xl min-h-[56px] flex items-center">
            <p className={`text-body-sm font-medium ${feedback?.tone === "good" ? "text-success" : feedback?.tone === "bad" ? "text-error" : "text-text-secondary"}`}>
              {feedback?.text || (screen === "playing" ? "Solve the triangle to open the door." : "Click Start Game to begin.")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-label-md text-text-muted">PUZZLE {Math.min(questionIndex + 1, questions.length)}/{questions.length}</div>
                <div className="badge badge-primary mt-1">Theorem {question?.theorem ?? "-"}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 30 ? "text-error animate-pulse" : "text-foreground"}`}>
                <Clock3 className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
            </div>

            {screen === "playing" && question ? (
              awaitingNext ? (
                <div className="space-y-3">
                  <p className="text-success font-semibold text-body-sm">Door opened! A friend is free!</p>
                  <button type="button" onClick={goToNext} className="btn btn-primary btn-lg w-full">
                    <ArrowRight className="h-4 w-4" />
                    {questionIndex + 1 < questions.length ? "Next Puzzle" : "See Results"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-body-sm text-text-secondary mb-3">{question.prompt}</p>
                  <form onSubmit={submitAnswer} className="space-y-3">
                    <label className="block text-label-md font-bold text-foreground">Your Answer (degrees)</label>
                    <input
                      ref={inputRef}
                      type="number"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="e.g. 50"
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!answer.trim()} className="btn btn-primary btn-lg w-full disabled:opacity-50">
                      <Sparkles className="h-4 w-4" />
                      Cast Spell to Open Door
                    </button>
                  </form>
                  {showHint && (
                    <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm text-text-secondary">
                      {question.theorem === 1
                        ? "Theorem 1: all three interior angles of a triangle add up to 180 degrees."
                        : "Theorem 2: an exterior angle equals the sum of the two interior angles that are NOT next to it."}
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="text-body-md text-text-secondary">Press Start Game to begin the rescue.</p>
            )}
          </div>

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
              <button
                type="button"
                onClick={useHint}
                disabled={screen !== "playing" || awaitingNext}
                className="btn btn-secondary btn-md disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4" />
                Hint (-10s)
              </button>
              <button type="button" onClick={() => setShowFormulas((f) => !f)} className="btn btn-secondary btn-md">
                <BookOpen className="h-4 w-4" />
                Formula Reminder
              </button>
              <Link
                to="/"
                className="btn btn-md rounded-lg bg-bg-secondary border border-accent/20 text-foreground hover:bg-accent/10 inline-flex items-center justify-center gap-2"
              >
                Back to Dashboard
              </Link>
            </div>

            {showFormulas && (
              <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-body-sm space-y-2">
                <div><span className="font-bold text-accent">Theorem 1 (Angle Sum):</span> A + B + C = 180&#176;</div>
                <div><span className="font-bold text-accent">Theorem 2 (Exterior Angle):</span> exterior angle = sum of the two remote interior angles</div>
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Read each triangle's known angles</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Apply Theorem 1 or 2 to find the missing angle</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> Wrong answers or running out of time cost a heart</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Lose all 3 hearts and the rescue ends</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
