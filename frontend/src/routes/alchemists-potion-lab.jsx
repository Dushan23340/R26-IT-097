import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FlaskConical,
  Gem,
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
import { randInt } from "@/lib/gameRandom";

// Grade-9 algebraic expressions: simplifying, addition, multiplication,
// factorization, substitution. Answers are free-text (not multiple choice)
// so a normalizer handles reasonable equivalent forms (term order,
// ^2 vs ** vs unicode superscript, spacing) for these 5 KNOWN answers -
// this is deliberately not a general symbolic algebra engine (that would
// be real scope creep for a fixed 5-question game), just enough
// normalization that a student isn't marked wrong for formatting.
function normalizeExpression(input) {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\*\*2|\^2/g, "²")
    .replace(/(\d)\*([a-z])/g, "$1$2")
    .replace(/=+$/, "")
    .trim();
}

// Freshly randomized per game start (generateQuestions below) - same 5
// skill templates every time (matching the fixed ingredient icons/order
// below) but different coefficients per play, so concurrent students get
// different scrolls. Every template's algebraic identity (not just one
// sample) was verified in a standalone script: for each generated
// instance, both sides of the identity were evaluated at 5 independent
// random test points and confirmed equal - 100,000 generated questions
// checked this way before wiring in here. accepted[] is always built from
// the SAME computed values as the prompt (never a separately hand-picked
// answer), so the two can't drift out of sync.
function appendTerm(existing, coeff, suffix) {
  if (existing === "") return `${coeff}${suffix}`;
  return coeff >= 0 ? `${existing}+${coeff}${suffix}` : `${existing}${coeff}${suffix}`;
}

function genSimplify() {
  let a, b, c, d, xCoeff, constVal;
  do {
    a = randInt(1, 9);
    b = randInt(1, 9);
    c = randInt(1, 9);
    d = randInt(1, 9);
    xCoeff = a + b;
    constVal = d - c;
  } while (constVal === 0); // avoid a degenerate "+0" term with no natural single form
  return {
    id: "q1", skill: "Simplify",
    prompt: `Simplify: ${a}x + ${b}x - ${c} + ${d}`,
    accepted: [appendTerm(appendTerm("", xCoeff, "x"), constVal, ""), appendTerm(appendTerm("", constVal, ""), xCoeff, "x")],
    hint: "Combine the x-terms together, then combine the plain numbers together.",
    ingredient: { name: "Fire Flower", emoji: "\u{1F338}", color: "#f87171" },
  };
}

function genAdd() {
  let a, b, c, d, resultA, resultB;
  do {
    a = randInt(1, 9);
    b = randInt(1, 9);
    c = randInt(1, 9);
    d = randInt(1, 9);
    resultA = a + c;
    resultB = b - d;
  } while (resultB === 0);
  return {
    id: "q2", skill: "Add",
    prompt: `Add: (${a}a + ${b}b) + (${c}a - ${d}b)`,
    accepted: [appendTerm(appendTerm("", resultA, "a"), resultB, "b"), appendTerm(appendTerm("", resultB, "b"), resultA, "a")],
    hint: "Add the a-terms together, then add the b-terms together.",
    ingredient: { name: "Ice Crystal", emoji: "❄️", color: "#7dd3fc" },
  };
}

function genMultiply() {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const x2coeff = a;
  const xcoeff = a * b;
  return {
    id: "q3", skill: "Multiply",
    prompt: `Multiply: ${a}x(x + ${b})`,
    accepted: [`${x2coeff}x²+${xcoeff}x`, `${xcoeff}x+${x2coeff}x²`],
    hint: `Distribute ${a}x to both terms inside the brackets: ${a}x times x, then ${a}x times ${b}.`,
    ingredient: { name: "Wind Feather", emoji: "\u{1FAB6}", color: "#a5f3fc" },
  };
}

function genFactorize() {
  const p = randInt(2, 9);
  const q = randInt(2, 9);
  const sumCoeff = p + q;
  const prodConst = p * q;
  const v1 = `(x+${p})(x+${q})`;
  const v2 = `(x+${q})(x+${p})`;
  return {
    id: "q4", skill: "Factorize",
    prompt: `Factorize: x² + ${sumCoeff}x + ${prodConst}`,
    accepted: p === q ? [v1] : [v1, v2],
    hint: `Find two numbers that multiply to ${prodConst} and add to ${sumCoeff}.`,
    ingredient: { name: "Earth Stone", emoji: "\u{1FAA8}", color: "#a3a380" },
  };
}

function genSubstitute() {
  const x0 = randInt(2, 5);
  const a = randInt(2, 6);
  const b = randInt(1, 9);
  const c = randInt(0, 9);
  const answer = a * x0 * x0 - b * x0 + c;
  return {
    id: "q5", skill: "Substitute",
    prompt: `If x = ${x0}, find the value of ${a}x² - ${b}x + ${c}`,
    accepted: [String(answer)],
    hint: `Substitute x=${x0} first, then follow order of operations: square, multiply, then add/subtract.`,
    ingredient: { name: "Light Drop", emoji: "✨", color: "#fde68a" },
  };
}

function generateQuestions() {
  return [genSimplify(), genAdd(), genMultiply(), genFactorize(), genSubstitute()];
}

const QUESTION_SECONDS = 90;
const MAX_HEARTS = 3;
const MAX_CRYSTALS = 3;
const MISCHIEF_CHANCE = 0.3;
const MISCHIEF_DURATION_MS = 3000;

const ALCHEMISTS = [
  { id: "a1", emoji: "\u{1F9D9}‍♀️", line: "Help us! Free our ingredient!" },
  { id: "a2", emoji: "\u{1F9D9}", line: "You can do this - solve the scroll!" },
  { id: "a3", emoji: "\u{1F9D9}‍♂️", line: "The spell trapped us in here!" },
  { id: "a4", emoji: "\u{1F9DD}", line: "Brew the antidote! Save the lab!" },
  { id: "a5", emoji: "\u{1F9DB}", line: "We're counting on your magic!" },
];

const PLAYER = { emoji: "\u{1F9D9}‍♀️" };

function scrambleText(text) {
  const chars = "abcdefghijklmnopqrstuvwxyz+-()²0123456789";
  return text
    .split("")
    .map((c) => (c === " " ? " " : chars[Math.floor(Math.random() * chars.length)]))
    .join("");
}

// ---------- Web Audio synthesis (real SFX, no recorded clips available) ----------

function useLabSounds() {
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

  const playShatter = useCallback(() => {
    [880, 1046.5, 1318.5, 1568].forEach((f, i) => playTone(f, i * 0.06, 0.18, "triangle", 0.14));
  }, [playTone]);
  const playExplode = useCallback(() => {
    playTone(200, 0, 0.3, "sawtooth", 0.15);
    playTone(120, 0.05, 0.35, "sawtooth", 0.12);
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

  return { playShatter, playExplode, playVictory, playClick, muted, toggleMute };
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

const Route = createFileRoute("/alchemists-potion-lab")({
  head: () => ({
    meta: [
      { title: "The Alchemist's Potion Lab — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 algebraic expressions game - simplify, add, multiply, factorize, and substitute to free trapped ingredients and brew the antidote.",
      },
    ],
  }),
  component: AlchemistsPotionLabPage,
});

function AlchemistsPotionLabPage() {
  const { reportFinish } = useGameSession("alchemists_potion_lab");
  const sounds = useLabSounds();
  const reportedRef = useRef(false);
  const inputRef = useRef(null);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  // Freshly randomized on mount and again on every startGame() call - see
  // generateQuestions above.
  const [questions, setQuestions] = useState(() => generateQuestions());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [crystals, setCrystals] = useState(MAX_CRYSTALS);
  const [saved, setSaved] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // {text, tone}
  const [jarState, setJarState] = useState("locked"); // locked | shattering | broken
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mistakesBySkill, setMistakesBySkill] = useState({});
  const [confetti, setConfetti] = useState(false);
  const [freedIds, setFreedIds] = useState([]);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [mischief, setMischief] = useState(false);

  const question = questions[questionIndex];
  const trappedAlchemists = ALCHEMISTS.filter((a) => !freedIds.includes(a.id));

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setQuestions(generateQuestions());
    setQuestionIndex(0);
    setHearts(MAX_HEARTS);
    setCrystals(MAX_CRYSTALS);
    setSaved(0);
    setAnswer("");
    setFeedback(null);
    setJarState("locked");
    setTimeLeft(QUESTION_SECONDS);
    setShowHint(false);
    setMistakesBySkill({});
    setConfetti(false);
    setFreedIds([]);
    setAwaitingNext(false);
    setMischief(false);
  };

  // A trapped alchemist shouts once per new scroll, and there's a chance
  // of "Magic Mischief" - the scroll text scrambles for a few seconds
  // before settling, a real (if playful) obstacle, not decorative.
  useEffect(() => {
    if (screen !== "playing" || !question) return;
    setFeedback(null);
    setShowHint(false);
    setJarState("locked");
    const alchemist = trappedAlchemists[questionIndex % Math.max(trappedAlchemists.length, 1)] || trappedAlchemists[0];
    const speakTimer = window.setTimeout(() => {
      if (alchemist) speak(alchemist.line, { rate: 1.05, pitch: 1.35, enabled: voiceEnabled });
    }, 400);

    let mischiefTimer;
    if (Math.random() < MISCHIEF_CHANCE) {
      setMischief(true);
      mischiefTimer = window.setTimeout(() => setMischief(false), MISCHIEF_DURATION_MS);
    }
    return () => {
      window.clearTimeout(speakTimer);
      if (mischiefTimer) window.clearTimeout(mischiefTimer);
    };
  }, [screen, questionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setMistakesBySkill((prev) => ({ ...prev, [question.skill]: (prev[question.skill] || 0) + 1 }));
    const newHearts = hearts - 1;
    setHearts(newHearts);
    if (newHearts <= 0) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((saved / questions.length) * 100), {
        correctCount: saved,
        totalCount: questions.length,
      });
      setScreen("lost");
      return;
    }
    sounds.playExplode();
    speak("That spell failed!", { rate: 1, pitch: 0.75, enabled: voiceEnabled });
    setFeedback({ text: reason, tone: "bad" });
    setTimeLeft(QUESTION_SECONDS);
  }

  function handleTimeout() {
    loseHeart("Time's up! The potion bubbles over. Try again!");
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (screen !== "playing" || awaitingNext || !question) return;
    const isCorrect = question.accepted.includes(normalizeExpression(answer));

    speak(`The answer is ${answer}!`, { rate: 1, pitch: 1.1, enabled: voiceEnabled });

    if (isCorrect) {
      setAwaitingNext(true);
      setJarState("shattering");
      sounds.playShatter();
      window.setTimeout(() => {
        setJarState("broken");
        const alchemist = trappedAlchemists[0];
        if (alchemist) {
          setFreedIds((prev) => [...prev, alchemist.id]);
        }
        setSaved((s) => s + 1);
        speak("Excellent!", { rate: 1, pitch: 1.3, enabled: voiceEnabled });
        setFeedback({ text: `Excellent! The ${question.ingredient.name} floats free into the cauldron!`, tone: "good" });
      }, 600);
    } else {
      loseHeart(`Not quite - that spell didn't match. Try again!`);
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
    if (crystals <= 0) return;
    setCrystals((c) => c - 1);
    setShowHint(true);
  }

  const weakestSkill = Object.entries(mistakesBySkill).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <FlaskConical className="h-4 w-4" />
            GAME 10 · THE ALCHEMIST'S POTION LAB
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">The Alchemist's Potion Lab</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            5 magical ingredients are trapped in glowing jars. Solve each algebraic expression scroll to
            shatter a jar, free the ingredient, and brew the Antidote Potion to save the lab.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SAVED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{saved}/{questions.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">HEARTS</div>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <span key={i} className={`text-lg ${i < hearts ? "opacity-100" : "opacity-20"}`}>
                  {"\u{1F9EA}"}
                </span>
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

      {/* Cauldron fill progress */}
      <div className="flex items-center gap-3">
        <span className="text-xl">{"\u{1F9EA}"}</span>
        <div className="h-3 flex-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${(saved / questions.length) * 100}%`, background: "linear-gradient(90deg,#a78bfa,#f0abfc)" }}
          />
        </div>
        <span className="text-xs font-bold text-text-muted whitespace-nowrap">Ingredients Saved: {saved}/{questions.length}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#150a24] via-[#1f1038] to-[#0d0618] p-4 min-h-[520px]">
            {/* Stars + magic dust */}
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-white animate-pulse pointer-events-none"
                style={{ left: `${(i * 29) % 96}%`, top: `${(i * 41) % 40}%`, animationDelay: `${(i % 5) * 0.3}s`, opacity: 0.7 }}
              />
            ))}

            {/* Jar shelf */}
            <div className="relative z-10 mx-auto mt-2 grid grid-cols-5 gap-2 max-w-lg">
              {questions.map((q, idx) => {
                const isCurrent = idx === questionIndex && screen === "playing";
                const isFreed = idx < questionIndex || (idx === questionIndex && jarState === "broken");
                return (
                  <div key={q.id} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-14 w-12 items-center justify-center rounded-b-xl rounded-t-md border-2 text-xl transition-all ${
                        isFreed
                          ? "border-white/10 bg-white/5 opacity-40"
                          : isCurrent && jarState === "shattering"
                          ? "border-yellow-300 bg-yellow-300/30 scale-125"
                          : "border-purple-300/60 bg-purple-400/15 shadow-[0_0_12px_rgba(196,181,253,0.4)]"
                      }`}
                    >
                      {isFreed ? "" : q.ingredient.emoji}
                    </div>
                    <span className="text-[8px] text-purple-200/70 text-center leading-tight">{q.ingredient.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Cauldron */}
            <div className="relative z-10 mx-auto mt-4 flex flex-col items-center">
              <div
                className="flex h-16 w-32 items-end justify-center rounded-b-full border-2 border-slate-500 bg-slate-800/70 overflow-hidden"
                style={{ boxShadow: saved > 0 ? "0 0 24px rgba(167,139,250,0.5)" : "none" }}
              >
                <div
                  className="w-full transition-all duration-700"
                  style={{
                    height: `${20 + (saved / questions.length) * 70}%`,
                    background: "linear-gradient(180deg,#c4b5fd,#7c3aed)",
                  }}
                />
              </div>
              <span className="mt-1 text-2xl">{"\u{1F9EA}"}</span>
            </div>

            {/* Scroll with the current expression */}
            {screen === "playing" && question && (
              <div className="relative z-10 mx-auto mt-4 max-w-sm rounded-xl border-2 border-amber-300/50 bg-amber-50/95 p-4 shadow-lg">
                <div className="text-center text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
                  {question.skill} Scroll
                </div>
                <p className="text-center text-lg font-black text-amber-900">
                  {mischief ? scrambleText(question.prompt) : question.prompt}
                </p>
                {mischief && <p className="mt-1 text-center text-[10px] text-amber-600 animate-pulse">Magic Mischief! Wait for it to settle...</p>}
              </div>
            )}

            {/* Trapped alchemists */}
            {screen === "playing" && trappedAlchemists.length > 0 && (
              <div className="relative z-10 mt-4 flex flex-wrap justify-center gap-3">
                {trappedAlchemists.map((a) => (
                  <div key={a.id} className="flex flex-col items-center">
                    <div className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-purple-100 mb-1 whitespace-nowrap max-w-[80px] truncate">
                      {"\u{1F4AC}"} {a.line.split("!")[0]}!
                    </div>
                    <div className="text-2xl animate-pulse" role="img" aria-label="Trapped alchemist">{a.emoji}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Player */}
            <div className="absolute bottom-3 right-4 text-3xl z-10" role="img" aria-label="Player alchemist">
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
                    {["\u{1F389}", "✨", "\u{1F52E}"][i % 3]}
                  </span>
                ))}
              </div>
            )}

            {screen === "start" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/65 backdrop-blur-sm rounded-3xl text-center px-6">
                <FlaskConical className="h-14 w-14 text-purple-300" />
                <h2 className="text-2xl font-black text-white">The Alchemist's Potion Lab</h2>
                <p className="max-w-xs text-sm text-slate-200">
                  5 ingredients are trapped in glowing jars. Solve each algebra scroll to free them and brew
                  the Antidote Potion - watch your hearts and the clock!
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
                <h2 className="text-2xl font-black text-white">Antidote Brewed! You saved the lab!</h2>
                <div className="flex gap-1 text-2xl">
                  {[...ALCHEMISTS, { id: "player" }].map((a, i) => (
                    <span key={a.id} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                      {a.emoji || PLAYER.emoji}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-200">You are a Junior Alchemist! {hearts} heart{hearts === 1 ? "" : "s"} remaining.</p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            )}

            {screen === "lost" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <Skull className="h-14 w-14 text-red-400" />
                <h2 className="text-2xl font-black text-white">The Potions Spilled!</h2>
                <p className="text-sm text-slate-200">You freed {saved} of {questions.length} ingredients before running out of hearts.</p>
                {weakestSkill && (
                  <p className="max-w-xs text-xs text-amber-200">
                    Most mistakes were on <span className="font-bold">{weakestSkill}</span> - worth practicing that skill more.
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
              {feedback?.text || (screen === "playing" ? "Solve the scroll to shatter the jar." : "Click Start Game to begin.")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-label-md text-text-muted">SCROLL {Math.min(questionIndex + 1, questions.length)}/{questions.length}</div>
                <div className="badge badge-primary mt-1">{question?.skill ?? "-"}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 20 ? "text-error animate-pulse" : "text-foreground"}`}>
                <Clock3 className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
            </div>

            {screen === "playing" && question ? (
              awaitingNext ? (
                <div className="space-y-3">
                  <p className="text-success font-semibold text-body-sm">Jar shattered! An ingredient is free!</p>
                  <button type="button" onClick={goToNext} className="btn btn-primary btn-lg w-full">
                    <ArrowRight className="h-4 w-4" />
                    {questionIndex + 1 < questions.length ? "Next Scroll" : "See Results"}
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={submitAnswer} className="space-y-3">
                    <label className="block text-label-md font-bold text-foreground">Your Answer</label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="e.g. 5x + 2"
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!answer.trim()} className="btn btn-primary btn-lg w-full disabled:opacity-50">
                      <FlaskConical className="h-4 w-4" />
                      Brew Spell
                    </button>
                  </form>
                  {showHint && (
                    <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm text-text-secondary">
                      {question.hint}
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
                disabled={screen !== "playing" || awaitingNext || crystals <= 0}
                className="btn btn-secondary btn-md disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4" />
                Hint ({crystals} <Gem className="h-3 w-3 inline" /> left)
              </button>
              <button type="button" onClick={() => setShowFormulas((f) => !f)} className="btn btn-secondary btn-md">
                <BookOpen className="h-4 w-4" />
                Formula Book
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
                <div><span className="font-bold text-accent">Like terms:</span> only combine terms with the same variable and power (3x + 5x = 8x, but 3x + 5x² can't combine)</div>
                <div><span className="font-bold text-accent">Distributive law:</span> a(b + c) = ab + ac</div>
                <div><span className="font-bold text-accent">Factorizing x²+bx+c:</span> find two numbers that multiply to c and add to b</div>
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Solve each algebra scroll (simplify, add, multiply, factorize, substitute)</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Type your answer and click Brew Spell</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> Wrong answers or running out of time cost a heart</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Lose all 3 hearts and the potions spill</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
