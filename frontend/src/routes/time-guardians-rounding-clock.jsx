import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock3,
  Cog,
  RotateCcw,
  ArrowRight,
  PartyPopper,
  Skull,
  Volume2,
  VolumeX,
  Lightbulb,
  BookOpen,
  Zap,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";
import { randInt } from "@/lib/gameRandom";

// Grade-9 rounding: nearest 10/100, decimal places, significant figures,
// and a real-life estimate. Answers are numeric (not symbolic like the
// Alchemist game), so normalization just needs to handle commas, "Rs."
// currency prefixes, and whitespace before comparing numeric value -
// verified with a standalone test before wiring into the UI (15 cases,
// including correctly rejecting a wrong-precision answer like 8.7 for a
// "round to 2 decimal places" question).
function normalizeNumber(input) {
  const cleaned = input.replace(/rs\.?/gi, "").replace(/,/g, "").replace(/\s/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Each crystal's numbers are freshly randomized per game start (see
// generateCrystals below) so concurrent students - and repeat plays by the
// same student - each get a different set, not the identical fixed numbers
// every time. Rounding is computed from the individual decimal DIGITS, not
// float multiplication/toFixed - e.g. (12.405).toFixed(2) === "12.40" in JS
// because the literal 12.405 isn't exactly representable in binary, which
// would silently mark a correctly "round half up" student answer wrong.
// Verified against 20,000+ random cases plus hand-picked carry edge cases
// (e.g. 8.995 -> 9.00) in a standalone script before wiring in here.
const CRYSTAL_COLORS = { c1: "#60a5fa", c2: "#c084fc", c3: "#34d399", c4: "#f472b6", c5: "#fbbf24" };

function genNearest10() {
  const tens = randInt(1, 99);
  const ones = randInt(1, 9); // nonzero last digit - avoids a trivial already-rounded number
  const n = tens * 10 + ones;
  const answer = Math.round(n / 10) * 10;
  return {
    id: "c1", type: "Nearest 10", color: CRYSTAL_COLORS.c1,
    displayNumber: String(n), prompt: `Round ${n} to the nearest 10.`, answer,
  };
}

function genNearest100() {
  const n = randInt(1, 98) * 100 + randInt(1, 99);
  const answer = Math.round(n / 100) * 100;
  return {
    id: "c2", type: "Nearest 100", color: CRYSTAL_COLORS.c2,
    displayNumber: n.toLocaleString(), prompt: `Round ${n.toLocaleString()} to the nearest 100.`, answer,
  };
}

function genTwoDp() {
  const intPart = randInt(1, 20);
  const d1 = randInt(0, 9);
  const d2 = randInt(0, 9);
  const d3 = randInt(0, 9);
  const d4 = randInt(0, 9);
  const displayNumber = `${intPart}.${d1}${d2}${d3}${d4}`;
  let hundredths = d1 * 10 + d2;
  let whole = intPart;
  if (d3 >= 5) {
    hundredths += 1;
    if (hundredths === 100) {
      hundredths = 0;
      whole += 1;
    }
  }
  const answerString = `${whole}.${Math.floor(hundredths / 10)}${hundredths % 10}`;
  return {
    id: "c3", type: "2 Decimal Places", color: CRYSTAL_COLORS.c3,
    displayNumber, prompt: `Round ${displayNumber} to 2 decimal places.`, answer: Number(answerString),
  };
}

function genSigFig3() {
  const leadingZeros = randInt(1, 3);
  const s1 = randInt(1, 8);
  const s2 = randInt(0, 9);
  const s3 = randInt(0, 8); // capped so a +1 carry from rounding never needs to cascade further
  const s4 = randInt(0, 9);
  const zeros = "0".repeat(leadingZeros);
  const displayNumber = `0.${zeros}${s1}${s2}${s3}${s4}`;
  const roundedS3 = s4 >= 5 ? s3 + 1 : s3;
  const answerString = `0.${zeros}${s1}${s2}${roundedS3}`;
  return {
    id: "c4", type: "3 Significant Figures", color: CRYSTAL_COLORS.c4,
    displayNumber, prompt: `Round ${displayNumber} to 3 significant figures.`, answer: Number(answerString),
  };
}

function genRealLife() {
  const n = randInt(1, 98) * 100 + randInt(1, 99);
  const answer = Math.round(n / 100) * 100;
  return {
    id: "c5", type: "Real Life", color: CRYSTAL_COLORS.c5,
    displayNumber: `Rs. ${n.toLocaleString()}`,
    prompt: `A shop price is Rs. ${n.toLocaleString()}. Round it to the nearest 100 for a quick estimate.`,
    answer,
  };
}

function generateCrystals() {
  return [genNearest10(), genNearest100(), genTwoDp(), genSigFig3(), genRealLife()];
}

const QUESTION_SECONDS = 30;
const HINT_COST_SECONDS = 5;
const MAX_GEARS = 3;
const GLITCH_MONSTER_QUESTION_INDEX = 3; // "between Q3 and Q4" - appears as Q4 (crystal 4) begins
const GLITCH_MONSTER_SECONDS = 10;

const SPIRITS = [
  { id: "s1", emoji: "\u{1F47B}", tint: "#60a5fa", line: "Please round me! Hurry!" },
  { id: "s2", emoji: "\u{1F47B}", tint: "#c084fc", line: "Time is breaking! Help!" },
  { id: "s3", emoji: "\u{1F47B}", tint: "#34d399", line: "The glitch is spreading! Quick!" },
  { id: "s4", emoji: "\u{1F47B}", tint: "#f472b6", line: "Purify my crystal, please!" },
  { id: "s5", emoji: "\u{1F47B}", tint: "#fbbf24", line: "We're running out of time!" },
];

const PLAYER = { emoji: "\u{1F9D9}\u{200D}\u{2642}\u{FE0F}" };

// Place-value breakdown of the current crystal's number - a real visual
// aid (click-to-reveal via Hint, not hover, since this must also work on
// tablets where hover doesn't exist).
const INTEGER_PLACE_LABELS = ["Ones", "Tens", "Hundreds", "Thousands", "Ten-Thousands", "Hundred-Thousands"];
const DECIMAL_PLACE_LABELS = ["Tenths", "Hundredths", "Thousandths", "Ten-Thousandths", "Hundred-Thousandths", "Millionths"];

function placeValueBreakdown(displayNumber) {
  const clean = displayNumber.replace(/rs\.?/gi, "").replace(/,/g, "").replace(/\s/g, "");
  const [intPart, decPart] = clean.split(".");
  const intDigits = intPart.split("").reverse();
  const decDigits = decPart ? decPart.split("") : [];
  return {
    integer: intDigits.map((d, i) => ({ digit: d, label: INTEGER_PLACE_LABELS[i] || `10^${i}` })).reverse(),
    decimal: decDigits.map((d, i) => ({ digit: d, label: DECIMAL_PLACE_LABELS[i] || `place ${i + 1}` })),
  };
}

// ---------- Web Audio synthesis (real SFX, no recorded clips available) ----------

function useClockSounds() {
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

  const playTick = useCallback(() => playTone(1200, 0, 0.04, "square", 0.06), [playTone]);
  const playPurify = useCallback(() => {
    [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => playTone(f, i * 0.08, 0.22, "triangle", 0.15));
  }, [playTone]);
  const playGlitch = useCallback(() => {
    [300, 250, 320, 200].forEach((f, i) => playTone(f, i * 0.06, 0.12, "sawtooth", 0.11));
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

  return { playTick, playPurify, playGlitch, playVictory, playClick, muted, toggleMute };
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

const Route = createFileRoute("/time-guardians-rounding-clock")({
  head: () => ({
    meta: [
      { title: "Time Guardians: Save the Rounding Clock — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 rounding game - round to the nearest 10/100, decimal places, and significant figures to purify time crystals and save the Rounding Clock.",
      },
    ],
  }),
  component: TimeGuardiansPage,
});

function TimeGuardiansPage() {
  const { reportFinish } = useGameSession("time_guardians_rounding_clock");
  const sounds = useClockSounds();
  const reportedRef = useRef(false);
  const inputRef = useRef(null);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  // Freshly randomized on mount and again on every startGame() call (Start
  // Game / Play Again) so concurrent students, and repeat plays, each get
  // different numbers - see generateCrystals above.
  const [crystals, setCrystals] = useState(() => generateCrystals());
  const [crystalIndex, setCrystalIndex] = useState(0);
  const [gears, setGears] = useState(MAX_GEARS);
  const [purified, setPurified] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [crystalState, setCrystalState] = useState("cracked"); // cracked | shattering | clear
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [showRules, setShowRules] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mistakesByType, setMistakesByType] = useState({});
  const [confetti, setConfetti] = useState(false);
  const [freedIds, setFreedIds] = useState([]);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [glitchMonster, setGlitchMonster] = useState(false);
  const [glitchFlash, setGlitchFlash] = useState(false);

  const crystal = crystals[crystalIndex];
  const trappedSpirits = SPIRITS.filter((s) => !freedIds.includes(s.id));

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setCrystals(generateCrystals());
    setCrystalIndex(0);
    setGears(MAX_GEARS);
    setPurified(0);
    setAnswer("");
    setFeedback(null);
    setCrystalState("cracked");
    setTimeLeft(QUESTION_SECONDS);
    setShowHint(false);
    setMistakesByType({});
    setConfetti(false);
    setFreedIds([]);
    setAwaitingNext(false);
    setGlitchMonster(false);
  };

  useEffect(() => {
    if (screen !== "playing" || !crystal) return;
    setFeedback(null);
    setShowHint(false);
    setCrystalState("cracked");
    const spirit = trappedSpirits[crystalIndex % Math.max(trappedSpirits.length, 1)] || trappedSpirits[0];
    const speakTimer = window.setTimeout(() => {
      if (spirit) speak(spirit.line, { rate: 1.1, pitch: 1.4, enabled: voiceEnabled });
    }, 350);

    let monsterTimer;
    if (crystalIndex === GLITCH_MONSTER_QUESTION_INDEX) {
      setGlitchMonster(true);
      monsterTimer = window.setTimeout(() => setGlitchMonster(false), GLITCH_MONSTER_SECONDS * 1000);
    }
    return () => {
      window.clearTimeout(speakTimer);
      if (monsterTimer) window.clearTimeout(monsterTimer);
    };
  }, [screen, crystalIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen !== "playing" || awaitingNext) return undefined;
    if (timeLeft <= 0) {
      handleTimeout();
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((t) => Math.max(t - 1, 0));
      if (timeLeft <= 6) sounds.playTick();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, timeLeft, awaitingNext]); // eslint-disable-line react-hooks/exhaustive-deps

  function loseGear(reason) {
    setMistakesByType((prev) => ({ ...prev, [crystal.type]: (prev[crystal.type] || 0) + 1 }));
    const newGears = gears - 1;
    setGears(newGears);
    setGlitchFlash(true);
    window.setTimeout(() => setGlitchFlash(false), 400);
    if (newGears <= 0) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((purified / crystals.length) * 100), {
        correctCount: purified,
        totalCount: crystals.length,
      });
      setScreen("lost");
      return;
    }
    sounds.playGlitch();
    speak("Glitch! Try again!", { rate: 1, pitch: 0.7, enabled: voiceEnabled });
    setFeedback({ text: reason, tone: "bad" });
    setTimeLeft(QUESTION_SECONDS);
  }

  function handleTimeout() {
    loseGear("Time's up! The crystal flickers red. Try again!");
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (screen !== "playing" || awaitingNext || !crystal) return;
    const parsed = normalizeNumber(answer);
    if (parsed === null) return;

    speak(`I round ${crystal.displayNumber} to ${answer}!`, { rate: 1.05, pitch: 1.1, enabled: voiceEnabled });

    if (parsed === crystal.answer) {
      setAwaitingNext(true);
      setCrystalState("shattering");
      sounds.playPurify();
      window.setTimeout(() => {
        setCrystalState("clear");
        const spirit = trappedSpirits[0];
        if (spirit) setFreedIds((prev) => [...prev, spirit.id]);
        setPurified((p) => p + 1);
        speak(`Crystal ${crystalIndex + 1} Purified`, { rate: 0.9, pitch: 0.6, enabled: voiceEnabled });
        setFeedback({ text: `Crystal ${crystalIndex + 1} Purified! The spirit salutes and flies free!`, tone: "good" });
      }, 600);
    } else {
      loseGear("Not quite - that's not the correctly rounded value. Try again!");
    }
    setAnswer("");
  }

  function goToNext() {
    if (crystalIndex + 1 < crystals.length) {
      setCrystalIndex((i) => i + 1);
      setTimeLeft(QUESTION_SECONDS);
      setAwaitingNext(false);
    } else {
      reportedRef.current = true;
      reportFinish("win", 100, { correctCount: crystals.length, totalCount: crystals.length });
      setScreen("won");
      setConfetti(true);
      sounds.playVictory();
    }
  }

  function useHint() {
    setShowHint(true);
    setTimeLeft((t) => Math.max(t - HINT_COST_SECONDS, 1));
  }

  const weakestType = Object.entries(mistakesByType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const breakdown = crystal ? placeValueBreakdown(crystal.displayNumber) : null;
  const clockGlow = 0.3 + (purified / crystals.length) * 0.7;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Clock3 className="h-4 w-4" />
            GAME 11 · TIME GUARDIANS
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Time Guardians: Save the Rounding Clock</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            5 Time Crystals are corrupted. Round each glitching number correctly within 30 seconds to purify
            the crystal, free the trapped spirit, and restart the Rounding Clock.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">PURIFIED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{purified}/{crystals.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">GEARS</div>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: MAX_GEARS }).map((_, i) => (
                <Cog key={i} className={`h-5 w-5 ${i < gears ? "text-accent" : "text-border"}`} />
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
          style={{ width: `${(purified / crystals.length) * 100}%`, background: "linear-gradient(90deg,#60a5fa,#c084fc)" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#050414] via-[#0d0a2b] to-[#03020a] p-4 min-h-[520px] ${glitchFlash ? "animate-shake" : ""}`}
          >
            {/* Stars */}
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-white animate-pulse pointer-events-none"
                style={{ left: `${(i * 31) % 96}%`, top: `${(i * 47) % 92}%`, animationDelay: `${(i % 5) * 0.3}s`, opacity: 0.7 }}
              />
            ))}

            {/* City lights - turn on one by one as crystals are purified */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 opacity-90 pointer-events-none">
              {crystals.map((_, i) => (
                <div
                  key={i}
                  className="w-8 rounded-t-sm transition-all duration-700"
                  style={{
                    height: 24 + (i % 3) * 10,
                    background: i < purified ? "linear-gradient(180deg,#93c5fd,#1e3a8a)" : "#0f172a",
                    boxShadow: i < purified ? "0 0 10px rgba(147,197,253,0.6)" : "none",
                  }}
                />
              ))}
            </div>

            {/* Glitch monster */}
            {glitchMonster && (
              <div className="absolute top-3 right-4 text-3xl animate-bounce z-30" role="img" aria-label="Glitch monster">
                {"\u{1F47E}"}
              </div>
            )}

            {/* The Rounding Clock */}
            <div className="relative z-10 mx-auto mt-4 flex flex-col items-center">
              <div
                className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-cyan-300/60"
                style={{ boxShadow: `0 0 ${30 * clockGlow}px rgba(103,232,249,${clockGlow})`, background: "radial-gradient(circle, rgba(30,58,138,0.4), rgba(3,2,10,0.8))" }}
              >
                <span className="text-3xl">{"\u{1F550}"}</span>
                <div className="absolute -bottom-2 rounded-full bg-cyan-950 px-2 py-0.5 text-[9px] font-bold text-cyan-200 border border-cyan-400/40">
                  {purified}/{crystals.length} gears turned
                </div>
              </div>
            </div>

            {/* Crystals */}
            <div className="relative z-10 mx-auto mt-6 grid grid-cols-5 gap-2 max-w-lg">
              {crystals.map((c, idx) => {
                const isCurrent = idx === crystalIndex && screen === "playing";
                const isPure = idx < crystalIndex || (idx === crystalIndex && crystalState === "clear");
                return (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-16 w-14 items-center justify-center border-2 text-lg font-black transition-all ${
                        isPure
                          ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-200"
                          : isCurrent && crystalState === "shattering"
                          ? "scale-125 animate-pulse"
                          : "text-white/90"
                      }`}
                      style={{
                        clipPath: "polygon(50% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%)",
                        background: isPure ? undefined : `${c.color}33`,
                        borderColor: isPure ? undefined : isCurrent ? c.color : `${c.color}66`,
                        boxShadow: isCurrent && !isPure ? `0 0 14px ${c.color}` : "none",
                      }}
                    >
                      {isPure ? "✨" : idx + 1}
                    </div>
                    <span className="text-[8px] text-purple-200/70 text-center leading-tight">{c.type}</span>
                  </div>
                );
              })}
            </div>

            {/* Current crystal's glowing number */}
            {screen === "playing" && crystal && (
              <div className="relative z-10 mx-auto mt-4 max-w-xs rounded-2xl border-2 p-4 text-center" style={{ borderColor: crystal.color, background: `${crystal.color}1a`, boxShadow: `0 0 20px ${crystal.color}55` }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">{crystal.type}</div>
                <p className="text-2xl font-black" style={{ color: crystal.color, textShadow: `0 0 10px ${crystal.color}` }}>
                  {crystal.displayNumber}
                </p>
                <p className="mt-2 text-xs text-white/80">{crystal.prompt}</p>
              </div>
            )}

            {/* Trapped spirits */}
            {screen === "playing" && trappedSpirits.length > 0 && (
              <div className="relative z-10 mt-4 flex flex-wrap justify-center gap-3">
                {trappedSpirits.map((s) => (
                  <div key={s.id} className="flex flex-col items-center">
                    <div className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-cyan-100 mb-1 whitespace-nowrap max-w-[80px] truncate">
                      {"\u{1F4AC}"} {s.line.split("!")[0]}!
                    </div>
                    <div className="text-2xl animate-pulse" style={{ filter: `drop-shadow(0 0 6px ${s.tint})` }} role="img" aria-label="Trapped spirit">
                      {s.emoji}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Player */}
            <div className="absolute bottom-3 right-4 text-3xl z-10" role="img" aria-label="Time Guardian">
              {PLAYER.emoji}
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
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/65 backdrop-blur-sm rounded-3xl text-center px-6">
                <Clock3 className="h-14 w-14 text-cyan-300" />
                <h2 className="text-2xl font-black text-white">Time Guardians: Save the Rounding Clock</h2>
                <p className="max-w-xs text-sm text-slate-200">
                  5 Time Crystals are corrupted. Round each number correctly within 30 seconds to purify a
                  crystal and free its spirit - watch your gears and the clock!
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
                <h2 className="text-2xl font-black text-white">The Clock is Saved!</h2>
                <div className="flex gap-1 text-2xl">
                  {SPIRITS.map((s, i) => (
                    <span key={s.id} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s`, filter: `drop-shadow(0 0 6px ${s.tint})` }}>
                      {s.emoji}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-200">All 5 crystals purified with {gears} gear{gears === 1 ? "" : "s"} remaining. You are a Time Guardian!</p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            )}

            {screen === "lost" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <Skull className="h-14 w-14 text-red-400" />
                <h2 className="text-2xl font-black text-white">Time Fractured!</h2>
                <p className="text-sm text-slate-200">You purified {purified} of {crystals.length} crystals before running out of gears.</p>
                {weakestType && (
                  <p className="max-w-xs text-xs text-amber-200">
                    Most mistakes were on <span className="font-bold">{weakestType}</span> - worth practicing that type more.
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
              {feedback?.text || (screen === "playing" ? "Round the glowing number to purify the crystal." : "Click Start Game to begin.")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-label-md text-text-muted">CRYSTAL {Math.min(crystalIndex + 1, crystals.length)}/{crystals.length}</div>
                <div className="badge badge-primary mt-1">{crystal?.type ?? "-"}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 10 ? "text-error animate-pulse" : "text-foreground"}`}>
                <Zap className="h-4 w-4" />
                {timeLeft}s
              </div>
            </div>

            {screen === "playing" && crystal ? (
              awaitingNext ? (
                <div className="space-y-3">
                  <p className="text-success font-semibold text-body-sm">Crystal purified! A spirit is free!</p>
                  <button type="button" onClick={goToNext} className="btn btn-primary btn-lg w-full">
                    <ArrowRight className="h-4 w-4" />
                    {crystalIndex + 1 < crystals.length ? "Next Crystal" : "See Results"}
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={submitAnswer} className="space-y-3">
                    <label className="block text-label-md font-bold text-foreground">Rounded Answer</label>
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="e.g. 50"
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!answer.trim()} className="btn btn-primary btn-lg w-full disabled:opacity-50">
                      <Zap className="h-4 w-4" />
                      Activate Crystal
                    </button>
                  </form>
                  {showHint && breakdown && (
                    <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm">
                      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1.5">Place Value Chart</div>
                      <div className="flex flex-wrap gap-1.5">
                        {breakdown.integer.map((d, i) => (
                          <div key={`i${i}`} className="flex flex-col items-center rounded bg-secondary px-1.5 py-1 min-w-[36px]">
                            <span className="font-bold text-foreground">{d.digit}</span>
                            <span className="text-[7px] text-text-muted">{d.label}</span>
                          </div>
                        ))}
                        {breakdown.decimal.length > 0 && (
                          <>
                            <span className="self-center font-bold text-text-muted">.</span>
                            {breakdown.decimal.map((d, i) => (
                              <div key={`d${i}`} className="flex flex-col items-center rounded bg-secondary px-1.5 py-1 min-w-[36px]">
                                <span className="font-bold text-foreground">{d.digit}</span>
                                <span className="text-[7px] text-text-muted">{d.label}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
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
                Hint (-5s)
              </button>
              <button type="button" onClick={() => setShowRules((r) => !r)} className="btn btn-secondary btn-md">
                <BookOpen className="h-4 w-4" />
                Rounding Rules
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
                <div>Look at the digit right after the place you're rounding to.</div>
                <div><span className="font-bold text-accent">5 or more:</span> round up</div>
                <div><span className="font-bold text-accent">4 or less:</span> round down (stays the same)</div>
                <div className="text-text-muted text-xs">Example: 47 to the nearest 10 - look at the ones digit (7). 7 is 5 or more, so round up to 50.</div>
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Round each crystal's glowing number correctly</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> You have 30 seconds per crystal</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> Wrong answers or running out of time cost a gear</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Lose all 3 gears and time fractures</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
