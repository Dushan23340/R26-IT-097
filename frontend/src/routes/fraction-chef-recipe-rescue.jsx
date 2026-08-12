import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChefHat,
  Flame,
  Heart,
  ArrowRight,
  PartyPopper,
  Skull,
  Volume2,
  VolumeX,
  Lightbulb,
  BookOpen,
  Timer,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// ---------- Fraction math + free-text answer parsing ----------
// Verified standalone before wiring into the UI: gcd/reduce against the
// game's own 5 answers (8/12->2/3, 3/4-1/2->1/4, 2/3*3/2->1, 5/6/(1/3)->5/2,
// 7/8-3/4->1/8, all matching the spec), plus 12 normalizeFraction parsing
// cases (equivalent-but-unreduced fractions like "8/12" and "4/6" are
// accepted as correct - same input-format leniency used by the other
// fraction/algebra games this session, e.g. normalizeExpression).
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
function reduce(num, den) {
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(Math.abs(num), Math.abs(den));
  return { num: num / g, den: den / g };
}
function normalizeFraction(input) {
  const cleaned = String(input ?? "").trim();
  if (!cleaned) return null;
  let m = cleaned.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const whole = Number(m[1]), num = Number(m[2]), den = Number(m[3]);
    if (den === 0) return null;
    return reduce(whole * den + num, den);
  }
  m = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const num = Number(m[1]), den = Number(m[2]);
    if (den === 0) return null;
    return reduce(num, den);
  }
  m = cleaned.match(/^(\d+)$/);
  if (m) return reduce(Number(m[1]), 1);
  return null;
}
function fractionsEqual(a, b) {
  if (!a || !b) return false;
  return a.num === b.num && a.den === b.den;
}
function formatFraction(f) {
  if (!f) return "";
  if (f.den === 1) return `${f.num}`;
  if (f.num > f.den) {
    const whole = Math.floor(f.num / f.den);
    const rem = f.num % f.den;
    return rem === 0 ? `${whole}` : `${whole} ${rem}/${f.den}`;
  }
  return `${f.num}/${f.den}`;
}

// ---------- 5 ovens, 1 per fraction skill from the spec ----------
const LEVELS = [
  {
    id: "l1",
    skill: "Simplify",
    oven: "Pepperoni Pizza Oven",
    dishEmoji: "\u{1F355}",
    prompt: "A pizza is cut into 12 equal slices. 8 slices have pepperoni. What fraction of the pizza is pepperoni? Simplify your answer!",
    visual: { type: "pizza", total: 12, filled: 8 },
    answer: { num: 2, den: 3 },
    hint: "Divide both the top and bottom by their greatest common factor (4): 8/12 -> 2/3.",
    judgeLine: "Chef! The pizza's ready - figure out that pepperoni fraction, quick!",
    botHint: "Try finding a common factor for 8 and 12!",
  },
  {
    id: "l2",
    skill: "Add/Subtract",
    oven: "Golden Sugar Cookie Oven",
    dishEmoji: "\u{1F36A}",
    prompt: "The cookie recipe needs 3/4 cup sugar in total. You've already added 1/2 cup. How much MORE sugar do you need?",
    visual: { type: "cups", a: { num: 3, den: 4 }, b: { num: 1, den: 2 } },
    answer: { num: 1, den: 4 },
    hint: "Convert 1/2 to 2/4 (same denominator as 3/4), then subtract: 3/4 - 2/4 = 1/4.",
    judgeLine: "Chef! We need three-fourths cup of sugar total - how much more do we add?",
    botHint: "Try finding a common denominator first!",
  },
  {
    id: "l3",
    skill: "Multiply",
    oven: "Fluffy Flour Cake Oven",
    dishEmoji: "\u{1F382}",
    prompt: "One tray of cake needs 2/3 cup flour. You're baking 3/2 trays for the festival. How much flour do you need in total?",
    visual: { type: "bars", a: { num: 2, den: 3 }, b: { num: 3, den: 2 } },
    answer: { num: 1, den: 1 },
    hint: "Multiply numerators together, then denominators together, then simplify: (2x3)/(3x2) = 6/6 = 1.",
    judgeLine: "Chef! Scale up that flour for the tray order, now!",
    botHint: "Multiply the numerators, then multiply the denominators!",
  },
  {
    id: "l4",
    skill: "Divide",
    oven: "Sparkling Juice Fountain",
    dishEmoji: "\u{1F9C3}",
    prompt: "You have 5/6 liter of juice. Each glass needs 1/3 liter. How many glasses can you pour (a part-filled glass still counts)?",
    visual: { type: "jug", amount: { num: 5, den: 6 }, glassSize: { num: 1, den: 3 } },
    answer: { num: 5, den: 2 },
    hint: "Dividing by a fraction means multiplying by its reciprocal: 5/6 / (1/3) = 5/6 x 3/1 = 15/6 = 2 1/2.",
    judgeLine: "Chef! Pour the juice - how many glasses can we fill?",
    botHint: "Flip the second fraction and multiply!",
  },
  {
    id: "l5",
    skill: "Compare",
    oven: "Royal Rice Scale Oven",
    dishEmoji: "\u{1F35A}",
    prompt: "Recipe A uses 7/8 kg rice. Recipe B uses 3/4 kg rice. Which recipe needs MORE rice, and by how much?",
    visual: { type: "scale", a: { num: 7, den: 8 }, b: { num: 3, den: 4 } },
    answer: { winner: "A", diff: { num: 1, den: 8 } },
    hint: "Convert both to eighths: 3/4 = 6/8. Then compare: 7/8 is bigger than 6/8 by 1/8.",
    judgeLine: "Chef! The judges are comparing rice recipes - which one wins, and by how much?",
    botHint: "Convert both fractions to the same denominator before comparing!",
    isCompare: true,
  },
];

const RULES = [
  { title: "Simplify", example: "8/12 pizza slices -> divide top & bottom by their GCF (4) -> 2/3" },
  { title: "Add / Subtract", example: "3/4 cup - 1/2 cup -> convert to 3/4 - 2/4 -> 1/4" },
  { title: "Multiply", example: "2/3 x 3/2 -> multiply tops, multiply bottoms -> 6/6 -> 1" },
  { title: "Divide", example: "5/6 / (1/3) -> flip and multiply -> 5/6 x 3/1 -> 2 1/2" },
  { title: "Compare", example: "7/8 vs 3/4 -> convert to 7/8 vs 6/8 -> 7/8 is bigger by 1/8" },
];

const QUESTION_SECONDS = 45;
const HINT_COST_SECONDS = 10;
const MAX_HEARTS = 3;

const CHEF = { emoji: "\u{1F9D1}‍\u{1F373}" };
const JUDGE = { emoji: "\u{1F9D0}" };
const SOUS_BOT = { emoji: "\u{1F916}" };

// ---------- Visual models: pizza (conic-gradient), fraction bars, jug ----------

function pizzaGradient(total, filled) {
  const step = 100 / total;
  const stops = [];
  for (let i = 0; i < total; i++) {
    const start = (i * step).toFixed(3);
    const end = ((i + 1) * step).toFixed(3);
    const isFilled = i < filled;
    const color = isFilled ? (i % 2 === 0 ? "#dc2626" : "#ef4444") : i % 2 === 0 ? "#fef3c7" : "#fde68a";
    stops.push(`${color} ${start}% ${end}%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function PizzaVisual({ total, filled }) {
  return (
    <div className="relative mx-auto h-36 w-36">
      <div
        className="h-36 w-36 rounded-full border-4 border-amber-900/50 shadow-xl"
        style={{ background: pizzaGradient(total, filled) }}
      />
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-[72px] w-[1px] origin-top bg-amber-950/30"
          style={{ transform: `rotate(${(360 / total) * i}deg)` }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center text-3xl">{"\u{1F355}"}</div>
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-amber-200">
        8 of 12 slices
      </div>
    </div>
  );
}

function FractionBar({ num, den, color = "#f97316", label }) {
  const wholeBars = Math.max(1, Math.ceil(num / den));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1">
        {Array.from({ length: wholeBars }).map((_, barIdx) => {
          const segStart = barIdx * den;
          return (
            <div key={barIdx} className="flex h-8 w-20 overflow-hidden rounded border border-white/20">
              {Array.from({ length: den }).map((_, segIdx) => {
                const segNum = segStart + segIdx;
                const filled = segNum < num;
                return (
                  <div
                    key={segIdx}
                    className="flex-1 border-r border-white/20 last:border-r-0"
                    style={{ background: filled ? color : "rgba(255,255,255,0.08)" }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      {label && <span className="text-[10px] text-white/70">{label}</span>}
    </div>
  );
}

function JuiceJug({ amount, glassSize }) {
  const fillPct = Math.min((amount.num / amount.den) * 100, 100);
  const glassPct = (glassSize.num / glassSize.den) * 100;
  const ticks = [];
  for (let t = glassPct; t < 100; t += glassPct) ticks.push(t);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-32 w-14 overflow-hidden rounded-b-xl rounded-t-md border-2 border-cyan-200/50 bg-white/5">
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500 to-amber-300 transition-all"
          style={{ height: `${fillPct}%` }}
        />
        {ticks.map((t, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-dashed border-white/60" style={{ bottom: `${t}%` }} />
        ))}
      </div>
      <span className="text-[10px] text-white/70">5/6 liter juice</span>
    </div>
  );
}

// ---------- Web Audio synthesis (real SFX, no recorded clips available) ----------

function useChefSounds() {
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

  const playChop = useCallback(() => playTone(900, 0, 0.05, "square", 0.08), [playTone]);
  const playDing = useCallback(() => {
    [1046.5, 1318.5, 1568].forEach((f, i) => playTone(f, i * 0.09, 0.3, "triangle", 0.16));
  }, [playTone]);
  const playBurn = useCallback(() => {
    [220, 180, 160].forEach((f, i) => playTone(f, i * 0.08, 0.2, "sawtooth", 0.12));
  }, [playTone]);
  const playTick = useCallback(() => playTone(1200, 0, 0.04, "square", 0.06), [playTone]);
  const playVictory = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => playTone(f, i * 0.12, 0.35, "triangle", 0.17));
  }, [playTone]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      return !m;
    });
  }, []);

  return { playChop, playDing, playBurn, playTick, playVictory, muted, toggleMute };
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
    // best-effort - subtitles/feedback text already cover this case
  }
}

const Route = createFileRoute("/fraction-chef-recipe-rescue")({
  head: () => ({
    meta: [
      { title: "Fraction Chef: The Recipe Rescue — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 fraction game - simplify, add, subtract, multiply, divide, and compare fractions across 5 magical ovens to recover the Master Recipe Scrolls.",
      },
    ],
  }),
  component: FractionChefPage,
});

function FractionChefPage() {
  const { reportFinish } = useGameSession("fraction_chef_recipe_rescue");
  const sounds = useChefSounds();
  const reportedRef = useRef(false);
  const inputRef = useRef(null);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [ovenIndex, setOvenIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [scrolls, setScrolls] = useState(0);
  const [answer, setAnswer] = useState("");
  const [compareWinner, setCompareWinner] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [dishState, setDishState] = useState("cooking"); // cooking | perfect | burnt
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [showRules, setShowRules] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mistakesBySkill, setMistakesBySkill] = useState({});
  const [confetti, setConfetti] = useState(false);
  const [freedScrollIds, setFreedScrollIds] = useState([]);
  const [awaitingNext, setAwaitingNext] = useState(false);

  const level = LEVELS[ovenIndex];

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setOvenIndex(0);
    setHearts(MAX_HEARTS);
    setScrolls(0);
    setAnswer("");
    setCompareWinner(null);
    setFeedback(null);
    setDishState("cooking");
    setTimeLeft(QUESTION_SECONDS);
    setShowHint(false);
    setMistakesBySkill({});
    setConfetti(false);
    setFreedScrollIds([]);
    setAwaitingNext(false);
  };

  useEffect(() => {
    if (screen !== "playing" || !level) return undefined;
    setFeedback(null);
    setShowHint(false);
    setDishState("cooking");
    setCompareWinner(null);
    const speakTimer = window.setTimeout(() => {
      speak(level.judgeLine, { rate: 1.05, pitch: 0.85, enabled: voiceEnabled });
    }, 350);
    return () => window.clearTimeout(speakTimer);
  }, [screen, ovenIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen !== "playing" || awaitingNext) return undefined;
    if (timeLeft <= 0) {
      handleTimeout();
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((t) => Math.max(t - 1, 0));
      if (timeLeft <= 8) sounds.playTick();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, timeLeft, awaitingNext]); // eslint-disable-line react-hooks/exhaustive-deps

  function loseHeart(reason) {
    setMistakesBySkill((prev) => ({ ...prev, [level.skill]: (prev[level.skill] || 0) + 1 }));
    const newHearts = hearts - 1;
    setHearts(newHearts);
    setDishState("burnt");
    sounds.playBurn();
    if (newHearts <= 0) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((scrolls / LEVELS.length) * 100), {
        correctCount: scrolls,
        totalCount: LEVELS.length,
      });
      setScreen("lost");
      return;
    }
    speak("Oh no, it's burnt! Try again, Chef!", { rate: 1, pitch: 0.8, enabled: voiceEnabled });
    setFeedback({ text: reason, tone: "bad" });
    window.setTimeout(() => setDishState("cooking"), 700);
    setTimeLeft(QUESTION_SECONDS);
  }

  function handleTimeout() {
    loseHeart("Time's up! The dish burned. Try again!");
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (screen !== "playing" || awaitingNext || !level) return;

    let correct = false;
    let spokenAnswer = answer;

    if (level.isCompare) {
      if (!compareWinner || !answer.trim()) return;
      const parsedDiff = normalizeFraction(answer);
      correct = compareWinner === level.answer.winner && fractionsEqual(parsedDiff, level.answer.diff);
      spokenAnswer = `Recipe ${compareWinner}, by ${answer}`;
    } else {
      if (!answer.trim()) return;
      const parsed = normalizeFraction(answer);
      correct = fractionsEqual(parsed, level.answer);
    }

    speak(`Order up! ${spokenAnswer}!`, { rate: 1.05, pitch: 1.1, enabled: voiceEnabled });

    if (correct) {
      setAwaitingNext(true);
      setDishState("perfect");
      sounds.playDing();
      const scrollId = level.id;
      window.setTimeout(() => {
        setFreedScrollIds((prev) => [...prev, scrollId]);
        setScrolls((s) => s + 1);
        speak(`Recipe Scroll ${ovenIndex + 1} recovered!`, { rate: 0.95, pitch: 0.7, enabled: voiceEnabled });
        setFeedback({ text: `Perfect! The oven dings and Recipe Scroll ${ovenIndex + 1} flies out!`, tone: "good" });
      }, 500);
    } else {
      loseHeart("Not quite right - the dish burned. Check your fraction and try again!");
    }
    setAnswer("");
  }

  function goToNext() {
    if (ovenIndex + 1 < LEVELS.length) {
      setOvenIndex((i) => i + 1);
      setTimeLeft(QUESTION_SECONDS);
      setAwaitingNext(false);
    } else {
      reportedRef.current = true;
      reportFinish("win", 100, { correctCount: LEVELS.length, totalCount: LEVELS.length });
      setScreen("won");
      setConfetti(true);
      sounds.playVictory();
    }
  }

  function useHint() {
    setShowHint(true);
    setTimeLeft((t) => Math.max(t - HINT_COST_SECONDS, 1));
    speak(level.botHint, { rate: 1.05, pitch: 1.3, enabled: voiceEnabled });
  }

  const weakestSkill = Object.entries(mistakesBySkill).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <ChefHat className="h-4 w-4" />
            GAME 13 · FRACTION CHEF
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Fraction Chef: The Recipe Rescue</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            5 Master Recipe Scrolls are locked behind magical ovens. Simplify, add, subtract, multiply, divide, and
            compare fractions to unlock each one before the National Food Festival!
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SCROLLS</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{scrolls}/{LEVELS.length}</div>
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
          style={{ width: `${(scrolls / LEVELS.length) * 100}%`, background: "linear-gradient(90deg,#f97316,#facc15)" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#1c1206] via-[#2a1a08] to-[#120a03] p-4 min-h-[560px]">
            {/* Steel counter shimmer */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-500/20 to-transparent pointer-events-none" />

            {/* Judge */}
            <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
              <span className="text-2xl" role="img" aria-label="Food Critic Judge">{JUDGE.emoji}</span>
              <div className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] text-amber-100 max-w-[140px]">
                {level ? level.judgeLine.split("-")[0] : "The festival needs those scrolls!"}
              </div>
            </div>

            {/* Sous Chef Bot */}
            <div className="absolute top-3 right-4 flex items-center gap-2 z-10">
              <div className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] text-cyan-100 max-w-[140px] text-right">
                {showHint && level ? level.botHint : "Ask for a Hint if you're stuck!"}
              </div>
              <span className="text-2xl" role="img" aria-label="Sous Chef Bot">{SOUS_BOT.emoji}</span>
            </div>

            {/* 5 ovens row */}
            <div className="relative z-10 mx-auto mt-16 grid grid-cols-5 gap-2 max-w-lg">
              {LEVELS.map((lvl, idx) => {
                const isCurrent = idx === ovenIndex && screen === "playing";
                const isFreed = freedScrollIds.includes(lvl.id);
                return (
                  <div key={lvl.id} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-16 w-14 items-center justify-center rounded-lg border-2 text-xl transition-all ${
                        isFreed
                          ? "border-emerald-300/60 bg-emerald-400/10"
                          : isCurrent
                          ? "border-amber-300 bg-amber-500/20 shadow-[0_0_14px_rgba(251,191,36,0.6)]"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      {isFreed ? "\u{1F4DC}" : isCurrent ? <Flame className="h-6 w-6 text-amber-400 animate-pulse" /> : "\u{1F373}"}
                    </div>
                    <span className="text-[8px] text-amber-100/70 text-center leading-tight">{lvl.skill}</span>
                  </div>
                );
              })}
            </div>

            {/* Current problem + visual model */}
            {screen === "playing" && level && (
              <div className="relative z-10 mx-auto mt-5 max-w-md rounded-2xl border-2 border-amber-400/50 bg-amber-950/40 p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">
                  {level.oven} · {level.skill}
                </div>
                <p className="text-sm text-amber-50">{level.prompt}</p>

                <div className="mt-4 flex items-center justify-center gap-6">
                  {level.visual.type === "pizza" && <PizzaVisual total={level.visual.total} filled={level.visual.filled} />}
                  {level.visual.type === "cups" && (
                    <>
                      <FractionBar num={level.visual.a.num} den={level.visual.a.den} color="#facc15" label="Total needed: 3/4" />
                      <FractionBar num={level.visual.b.num} den={level.visual.b.den} color="#38bdf8" label="Added so far: 1/2" />
                    </>
                  )}
                  {level.visual.type === "bars" && (
                    <>
                      <FractionBar num={level.visual.a.num} den={level.visual.a.den} color="#f97316" label="Per tray: 2/3" />
                      <FractionBar num={level.visual.b.num} den={level.visual.b.den} color="#c084fc" label="Trays needed: 3/2" />
                    </>
                  )}
                  {level.visual.type === "jug" && <JuiceJug amount={level.visual.amount} glassSize={level.visual.glassSize} />}
                  {level.visual.type === "scale" && (
                    <>
                      <FractionBar num={level.visual.a.num} den={level.visual.a.den} color="#f472b6" label="Recipe A: 7/8" />
                      <span className="text-2xl">{"⚖️"}</span>
                      <FractionBar num={level.visual.b.num} den={level.visual.b.den} color="#34d399" label="Recipe B: 3/4" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Dish state overlay */}
            {screen === "playing" && level && (
              <div className="relative z-10 mx-auto mt-3 flex items-center justify-center gap-2 text-3xl">
                {dishState === "burnt" ? "\u{1F4A8}" : dishState === "perfect" ? "✨" : ""}
                <span className={dishState === "burnt" ? "grayscale" : ""}>{level.dishEmoji}</span>
                {dishState === "burnt" ? "\u{1F525}" : dishState === "perfect" ? "✨" : ""}
              </div>
            )}

            {/* Chef 9 */}
            <div className="absolute bottom-3 right-4 text-3xl z-10" role="img" aria-label="Chef 9">
              {CHEF.emoji}
            </div>

            {confetti && (
              <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-lg animate-bounce"
                    style={{ left: `${(i * 31) % 100}%`, top: `${(i * 13) % 60}%`, animationDelay: `${(i % 6) * 0.08}s`, animationDuration: "0.9s" }}
                  >
                    {["\u{1F389}", "✨", "\u{1F386}"][i % 3]}
                  </span>
                ))}
              </div>
            )}

            {screen === "start" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <ChefHat className="h-14 w-14 text-amber-300" />
                <h2 className="text-2xl font-black text-white">Fraction Chef: The Recipe Rescue</h2>
                <p className="max-w-xs text-sm text-slate-200">
                  The Grand Royal Kitchen lost 5 Master Recipe Scrolls. Solve the fraction code at each oven to
                  recover them before the National Food Festival begins!
                </p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Start Game
                </button>
              </div>
            )}

            {screen === "won" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <PartyPopper className="h-14 w-14 text-amber-300 animate-bounce" />
                <h2 className="text-2xl font-black text-white">Festival Saved!</h2>
                <div className="flex gap-1 text-2xl">
                  {LEVELS.map((lvl, i) => (
                    <span key={lvl.id} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                      {"\u{1F4DC}"}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-200">
                  All 5 recipe scrolls recovered with {hearts} heart{hearts === 1 ? "" : "s"} remaining. Chef 9 bows
                  as the crowd cheers!
                </p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <ChefHat className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            )}

            {screen === "lost" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <Skull className="h-14 w-14 text-red-400" />
                <h2 className="text-2xl font-black text-white">The Kitchen Went Cold!</h2>
                <p className="text-sm text-slate-200">You recovered {scrolls} of {LEVELS.length} scrolls before running out of hearts.</p>
                {weakestSkill && (
                  <p className="max-w-xs text-xs text-amber-200">
                    Most mistakes were on <span className="font-bold">{weakestSkill}</span> - worth practicing that skill more.
                  </p>
                )}
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <ChefHat className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 card rounded-2xl min-h-[56px] flex items-center">
            <p className={`text-body-sm font-medium ${feedback?.tone === "good" ? "text-success" : feedback?.tone === "bad" ? "text-error" : "text-text-secondary"}`}>
              {feedback?.text || (screen === "playing" ? "Solve the fraction problem to unlock the oven." : "Click Start Game to begin.")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-label-md text-text-muted">OVEN {Math.min(ovenIndex + 1, LEVELS.length)}/{LEVELS.length}</div>
                <div className="badge badge-primary mt-1">{level?.skill ?? "-"}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 12 ? "text-error animate-pulse" : "text-foreground"}`}>
                <Timer className="h-4 w-4" />
                {timeLeft}s
              </div>
            </div>

            {screen === "playing" && level ? (
              awaitingNext ? (
                <div className="space-y-3">
                  <p className="text-success font-semibold text-body-sm">Order up! The scroll flew free!</p>
                  <button type="button" onClick={goToNext} className="btn btn-primary btn-lg w-full">
                    <ArrowRight className="h-4 w-4" />
                    {ovenIndex + 1 < LEVELS.length ? "Next Oven" : "See Results"}
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={submitAnswer} className="space-y-3">
                    {level.isCompare && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCompareWinner("A")}
                          className={`btn btn-md flex-1 ${compareWinner === "A" ? "btn-primary" : "btn-secondary"}`}
                        >
                          Recipe A
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareWinner("B")}
                          className={`btn btn-md flex-1 ${compareWinner === "B" ? "btn-primary" : "btn-secondary"}`}
                        >
                          Recipe B
                        </button>
                      </div>
                    )}
                    <label className="block text-label-md font-bold text-foreground">
                      {level.isCompare ? "By how much? (fraction)" : "Fraction Answer"}
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="e.g. 2/3 or 1 1/2"
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={!answer.trim() || (level.isCompare && !compareWinner)}
                      className="btn btn-primary btn-lg w-full disabled:opacity-50"
                    >
                      <Flame className="h-4 w-4" />
                      Cook!
                    </button>
                  </form>
                  {showHint && (
                    <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm text-text-secondary">
                      {level.hint}
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
                  <ChefHat className="h-4 w-4" />
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
              <button type="button" onClick={() => setShowRules((r) => !r)} className="btn btn-secondary btn-md">
                <BookOpen className="h-4 w-4" />
                Fraction Rules
              </button>
              <Link
                to="/"
                className="btn btn-md rounded-lg bg-bg-secondary border border-accent/20 text-foreground hover:bg-accent/10 inline-flex items-center justify-center gap-2"
              >
                Back to Dashboard
              </Link>
            </div>

            {showRules && (
              <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-body-sm space-y-2">
                {RULES.map((r) => (
                  <div key={r.title}>
                    <span className="font-bold text-accent">{r.title}:</span>{" "}
                    <span className="text-text-secondary text-xs">{r.example}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Solve each oven's fraction problem correctly</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> You have 45 seconds per oven</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> Wrong answers or running out of time burn the dish and cost a heart</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Lose all 3 hearts and the festival is lost</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
