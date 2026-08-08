import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap,
  Shield,
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

// Grade-9 parallel-line angle properties. Every diagram is driven by ONE
// "controlling angle" A: with two true parallel lines cut by a
// transversal, there are only ever 2 distinct angle values (A and 180-A)
// repeating in a fixed pattern across the 8 angles formed - a real
// trigonometric identity, verified with concrete coordinates before this
// was written (see the geometry note in computeParallelDiagram below).
// Each room's `given`/`unknown` positions and `controllingAngle` were
// derived and checked against that verified map, not guessed.
const ROOMS = [
  {
    id: "r1",
    concept: "Corresponding Angles",
    prompt: "The two red laser lines are parallel. The marked angle is 65 degrees. Find the corresponding angle on the lower laser line.",
    answer: 65,
    controllingAngle: 115,
    given: { vertex: "P", position: "right_up", value: 65 },
    unknown: { vertex: "Q", position: "right_up" },
    hint: "Corresponding angles are in the same position at each intersection - they are always equal when the lines are parallel.",
  },
  {
    id: "r2",
    concept: "Alternate Angles",
    prompt: "The two laser lines are parallel. The marked angle is 110 degrees. Find the alternate interior angle on the other side of the transversal.",
    answer: 110,
    controllingAngle: 110,
    given: { vertex: "P", position: "right_down", value: 110 },
    unknown: { vertex: "Q", position: "left_up" },
    hint: "Alternate angles sit between the parallel lines, on opposite sides of the transversal (a Z-shape) - they are always equal.",
  },
  {
    id: "r3",
    concept: "Co-Interior Angles",
    prompt: "The two laser lines are parallel. The marked angle is 72 degrees. Find the co-interior angle on the same side of the transversal.",
    answer: 108,
    controllingAngle: 72,
    given: { vertex: "P", position: "right_down", value: 72 },
    unknown: { vertex: "Q", position: "right_up" },
    hint: "Co-interior angles sit between the parallel lines, on the same side of the transversal (a C-shape) - they always add up to 180 degrees.",
  },
  {
    id: "r4",
    concept: "Straight Line",
    prompt: "The transversal crosses the upper laser line. One angle is 134 degrees. Find the other angle on that same straight line.",
    answer: 46,
    controllingAngle: 134,
    given: { vertex: "P", position: "right_down", value: 134 },
    unknown: { vertex: "P", position: "left_down" },
    hint: "Angles on a straight line always add up to 180 degrees.",
  },
  {
    id: "r5",
    concept: "Vertically Opposite + Corresponding",
    prompt: "At the lower intersection, a vertically opposite angle measures 55 degrees. Find the corresponding angle on the upper laser line.",
    answer: 55,
    controllingAngle: 55,
    given: { vertex: "Q", position: "left_up", value: 55 },
    unknown: { vertex: "P", position: "left_up" },
    hint: "First recall vertically opposite angles are equal, then use that corresponding angles across parallel lines are also equal.",
  },
];

const ROOM_SECONDS = 40;
const HINT_COST_SECONDS = 10;
const MAX_SHIELDS = 3;

// ---------- Parallel-line + transversal geometry (real trig, not decorative) ----------
// See the module docstring above for the verified relationship map this
// is built from: with downT = (cos A, sin A) as the transversal's
// direction from the upper intersection P, every one of the 8 angles at
// P and Q reduces to exactly A or 180-A, in a fixed, provable pattern.
function computeParallelDiagram(controllingAngleDeg, width = 380) {
  const rad = (controllingAngleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(rad), y: Math.sin(rad) };
  const gapY = 130;
  const P = { x: width * 0.34, y: 55 };
  const t = gapY / dir.y;
  const Q = { x: P.x + dir.x * t, y: P.y + gapY };

  const right = { x: 1, y: 0 };
  const left = { x: -1, y: 0 };
  const downT_P = dir;
  const upT_P = { x: -dir.x, y: -dir.y };
  const upT_Q = { x: -dir.x, y: -dir.y };
  const downT_Q = dir;

  const bisector = (a, b) => {
    const s = { x: a.x + b.x, y: a.y + b.y };
    const m = Math.hypot(s.x, s.y) || 1;
    return { x: s.x / m, y: s.y / m };
  };

  const regionsP = {
    right_down: bisector(right, downT_P),
    left_down: bisector(downT_P, left),
    left_up: bisector(left, upT_P),
    right_up: bisector(upT_P, right),
  };
  const regionsQ = {
    right_up: bisector(right, upT_Q),
    left_up: bisector(upT_Q, left),
    left_down: bisector(left, downT_Q),
    right_down: bisector(downT_Q, right),
  };

  return { P, Q, dir, regionsP, regionsQ, width };
}

function LabelAt(vertex, regions, position, radius) {
  const dir = regions[position];
  return { x: vertex.x + dir.x * radius, y: vertex.y + dir.y * radius };
}

function ParallelLinesDiagram({ room }) {
  const { P, Q, dir, regionsP, regionsQ, width } = useMemo(
    () => computeParallelDiagram(room.controllingAngle),
    [room.controllingAngle]
  );
  const height = Q.y + 55;
  const extend = 200;

  const givenPoint = room.given.vertex === "P" ? P : Q;
  const givenRegions = room.given.vertex === "P" ? regionsP : regionsQ;
  const unknownPoint = room.unknown.vertex === "P" ? P : Q;
  const unknownRegions = room.unknown.vertex === "P" ? regionsP : regionsQ;

  const givenLabel = LabelAt(givenPoint, givenRegions, room.given.position, 34);
  const unknownLabel = LabelAt(unknownPoint, unknownRegions, room.unknown.position, 34);

  const transStart = { x: P.x - dir.x * extend, y: P.y - dir.y * extend };
  const transEnd = { x: Q.x + dir.x * extend, y: Q.y + dir.y * extend };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-64" role="img" aria-label="Parallel lines cut by a transversal">
      {/* Parallel lines with arrow marks (>>) indicating they're parallel */}
      {[P.y, Q.y].map((y, i) => (
        <g key={i}>
          <line x1="10" y1={y} x2={width - 10} y2={y} stroke="#f87171" strokeWidth="3" opacity="0.9" />
          {[width * 0.15, width * 0.2].map((x, j) => (
            <path key={j} d={`M ${x} ${y - 6} L ${x + 8} ${y} L ${x} ${y + 6}`} stroke="#fca5a5" strokeWidth="2" fill="none" />
          ))}
        </g>
      ))}
      {/* Transversal */}
      <line x1={transStart.x} y1={transStart.y} x2={transEnd.x} y2={transEnd.y} stroke="#34d399" strokeWidth="3" opacity="0.9" />

      <circle cx={P.x} cy={P.y} r="3" fill="#fff" />
      <circle cx={Q.x} cy={Q.y} r="3" fill="#fff" />

      <text x={givenLabel.x} y={givenLabel.y} fontSize="15" fontWeight="bold" fill="#fde68a" textAnchor="middle">
        {room.given.value}&#176;
      </text>
      <text x={unknownLabel.x} y={unknownLabel.y} fontSize="16" fontWeight="bold" fill="#67e8f9" textAnchor="middle">
        ?
      </text>
    </svg>
  );
}

// ---------- Web Audio synthesis (real SFX, no recorded clips available) ----------

function useHeistSounds() {
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

  const playBeep = useCallback(() => {
    [880, 1174.7].forEach((f, i) => playTone(f, i * 0.09, 0.16, "sine", 0.14));
  }, [playTone]);
  const playAlarm = useCallback(() => {
    [440, 330, 440, 330].forEach((f, i) => playTone(f, i * 0.12, 0.15, "sawtooth", 0.14));
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

  return { playBeep, playAlarm, playVictory, playClick, muted, toggleMute };
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

const Route = createFileRoute("/laser-heist-parallel-museum")({
  head: () => ({
    meta: [
      { title: "Laser Heist: The Parallel Museum — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 parallel-line angle game - use corresponding, alternate, co-interior, straight-line, and vertically opposite angle properties to disable laser grids and recover the Angle Gems.",
      },
    ],
  }),
  component: LaserHeistPage,
});

function LaserHeistPage() {
  const { reportFinish } = useGameSession("laser_heist_parallel_museum");
  const sounds = useHeistSounds();
  const reportedRef = useRef(false);
  const inputRef = useRef(null);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [roomIndex, setRoomIndex] = useState(0);
  const [shields, setShields] = useState(MAX_SHIELDS);
  const [recovered, setRecovered] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [laserState, setLaserState] = useState("active"); // active | disabling | off
  const [timeLeft, setTimeLeft] = useState(ROOM_SECONDS);
  const [showRules, setShowRules] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mistakesByConcept, setMistakesByConcept] = useState({});
  const [confetti, setConfetti] = useState(false);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [alarmFlash, setAlarmFlash] = useState(false);

  const room = ROOMS[roomIndex];

  const startGame = () => {
    reportedRef.current = false;
    setScreen("playing");
    setRoomIndex(0);
    setShields(MAX_SHIELDS);
    setRecovered(0);
    setAnswer("");
    setFeedback(null);
    setLaserState("active");
    setTimeLeft(ROOM_SECONDS);
    setShowHint(false);
    setMistakesByConcept({});
    setConfetti(false);
    setAwaitingNext(false);
  };

  useEffect(() => {
    if (screen !== "playing" || !room) return;
    setFeedback(null);
    setShowHint(false);
    setLaserState("active");
    const timer = window.setTimeout(() => {
      speak(`We have a ${room.concept} problem in Room ${roomIndex + 1}!`, { rate: 1.05, pitch: 1.1, enabled: voiceEnabled });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [screen, roomIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen !== "playing" || awaitingNext) return undefined;
    if (timeLeft <= 0) {
      handleTimeout();
      return undefined;
    }
    const timer = window.setInterval(() => setTimeLeft((t) => Math.max(t - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [screen, timeLeft, awaitingNext]); // eslint-disable-line react-hooks/exhaustive-deps

  function loseShield(reason) {
    setMistakesByConcept((prev) => ({ ...prev, [room.concept]: (prev[room.concept] || 0) + 1 }));
    const newShields = shields - 1;
    setShields(newShields);
    setAlarmFlash(true);
    window.setTimeout(() => setAlarmFlash(false), 400);
    if (newShields <= 0) {
      reportedRef.current = true;
      reportFinish("loss", Math.round((recovered / ROOMS.length) * 100), {
        correctCount: recovered,
        totalCount: ROOMS.length,
      });
      setScreen("lost");
      return;
    }
    sounds.playAlarm();
    speak("Warning! Wrong angle!", { rate: 1, pitch: 0.75, enabled: voiceEnabled });
    setFeedback({ text: reason, tone: "bad" });
    setTimeLeft(ROOM_SECONDS);
  }

  function handleTimeout() {
    loseShield("Time's up! Security Bot spots you. Try again!");
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (screen !== "playing" || awaitingNext || !room) return;
    const parsed = Number(answer.trim());
    if (!Number.isFinite(parsed)) return;

    speak(`The ${room.concept.toLowerCase()} must be ${parsed} degrees!`, { rate: 1.05, pitch: 1.1, enabled: voiceEnabled });

    if (parsed === room.answer) {
      setAwaitingNext(true);
      setLaserState("disabling");
      sounds.playBeep();
      window.setTimeout(() => {
        setLaserState("off");
        setRecovered((r) => r + 1);
        setFeedback({ text: `Laser disabled! Angle Gem ${roomIndex + 1} recovered!`, tone: "good" });
      }, 600);
    } else {
      loseShield("Not quite - that's not the correct angle. Try again!");
    }
    setAnswer("");
  }

  function goToNext() {
    if (roomIndex + 1 < ROOMS.length) {
      setRoomIndex((i) => i + 1);
      setTimeLeft(ROOM_SECONDS);
      setAwaitingNext(false);
    } else {
      reportedRef.current = true;
      reportFinish("win", 100, { correctCount: ROOMS.length, totalCount: ROOMS.length });
      setScreen("won");
      setConfetti(true);
      sounds.playVictory();
    }
  }

  function useHint() {
    setShowHint(true);
    setTimeLeft((t) => Math.max(t - HINT_COST_SECONDS, 1));
  }

  const weakestConcept = Object.entries(mistakesByConcept).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Zap className="h-4 w-4" />
            GAME 12 · LASER HEIST
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Laser Heist: The Parallel Museum</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            5 laser grids protect the stolen Angle Gems. Each grid is 2 parallel lines cut by a transversal -
            calculate the missing angle within 40 seconds to disable it and recover the gem.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">RECOVERED</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{recovered}/{ROOMS.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SHIELDS</div>
            <div className="mt-2 flex items-center gap-1">
              {Array.from({ length: MAX_SHIELDS }).map((_, i) => (
                <Shield key={i} className={`h-5 w-5 ${i < shields ? "text-accent fill-accent/20" : "text-border"}`} />
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
          style={{ width: `${(recovered / ROOMS.length) * 100}%`, background: "linear-gradient(90deg,#f87171,#34d399)" }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="container-game rounded-3xl">
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#050608] via-[#0a0f1a] to-[#03040a] p-4 min-h-[520px] ${alarmFlash ? "animate-shake" : ""}`}>
            {alarmFlash && <div className="absolute inset-0 bg-red-600/20 z-20 pointer-events-none" />}

            {/* Museum map - 5 rooms, lights up as gems are recovered */}
            <div className="relative z-10 mx-auto flex justify-center gap-2 mb-4">
              {ROOMS.map((r, idx) => {
                const isDone = idx < roomIndex || (idx === roomIndex && laserState === "off");
                const isCurrent = idx === roomIndex && screen === "playing";
                return (
                  <div
                    key={r.id}
                    className={`flex h-10 w-14 items-center justify-center rounded-md border-2 text-[10px] font-bold transition-all ${
                      isDone
                        ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-200"
                        : isCurrent
                        ? "border-red-400 bg-red-500/20 text-red-200 animate-pulse"
                        : "border-white/10 bg-white/5 text-white/40"
                    }`}
                  >
                    {isDone ? "\u{1F48E}" : `R${idx + 1}`}
                  </div>
                );
              })}
            </div>

            {/* Laser room diagram */}
            {screen === "playing" && room && (
              <div
                className="relative z-10 mx-auto max-w-md rounded-2xl border-2 p-3"
                style={{
                  borderColor: laserState === "off" ? "#34d399" : "#f87171",
                  background: laserState === "off" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                  boxShadow: laserState === "active" ? "0 0 20px rgba(248,113,113,0.4)" : "0 0 20px rgba(52,211,153,0.4)",
                }}
              >
                <div className="text-center text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  Room {roomIndex + 1} · {room.concept}
                </div>
                <ParallelLinesDiagram room={room} />
                <p className="mt-2 text-center text-xs text-white/80">{room.prompt}</p>
              </div>
            )}

            {/* Agent + Director */}
            <div className="relative z-10 mt-4 flex items-center justify-center gap-6">
              <div className="flex flex-col items-center">
                <span className="text-3xl" role="img" aria-label="Agent 9">{"\u{1F576}\u{FE0F}"}</span>
                <span className="text-[8px] text-white/50">Agent 9</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-cyan-100 mb-1 whitespace-nowrap">
                  {"\u{1F4AC}"} We need that angle!
                </div>
                <span className="text-2xl" role="img" aria-label="Museum Director">{"\u{1F468}\u{200D}\u{1F4BC}"}</span>
                <span className="text-[8px] text-white/50">Director</span>
              </div>
            </div>

            {confetti && (
              <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-lg animate-bounce"
                    style={{ left: `${(i * 31) % 100}%`, top: `${(i * 13) % 60}%`, animationDelay: `${(i % 6) * 0.08}s`, animationDuration: "0.9s" }}
                  >
                    {["\u{1F389}", "\u{1F48E}", "✨"][i % 3]}
                  </span>
                ))}
              </div>
            )}

            {screen === "start" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/65 backdrop-blur-sm rounded-3xl text-center px-6">
                <Zap className="h-14 w-14 text-red-300" />
                <h2 className="text-2xl font-black text-white">Laser Heist: The Parallel Museum</h2>
                <p className="max-w-xs text-sm text-slate-200">
                  5 laser grids guard the stolen Angle Gems. Solve each parallel-line angle puzzle within 40
                  seconds to disable a laser and recover a gem.
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
                <h2 className="text-2xl font-black text-white">Heist Stopped! Museum Safe!</h2>
                <div className="flex gap-1 text-2xl">
                  {ROOMS.map((r, i) => (
                    <span key={r.id} className="animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>{"\u{1F48E}"}</span>
                  ))}
                </div>
                <p className="text-sm text-slate-200">All 5 gems recovered with {shields} shield{shields === 1 ? "" : "s"} remaining. Agent 9 salutes!</p>
                <button type="button" onClick={startGame} className="btn btn-primary btn-lg mt-2">
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            )}

            {screen === "lost" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm rounded-3xl text-center px-6">
                <Skull className="h-14 w-14 text-red-400" />
                <h2 className="text-2xl font-black text-white">Alarm Triggered!</h2>
                <p className="text-sm text-slate-200">You recovered {recovered} of {ROOMS.length} gems before running out of shields.</p>
                {weakestConcept && (
                  <p className="max-w-xs text-xs text-amber-200">
                    Most mistakes were on <span className="font-bold">{weakestConcept}</span> - worth practicing that one more.
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
              {feedback?.text || (screen === "playing" ? "Calculate the missing angle to disable the laser." : "Click Start Game to begin.")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-label-md text-text-muted">ROOM {Math.min(roomIndex + 1, ROOMS.length)}/{ROOMS.length}</div>
                <div className="badge badge-primary mt-1">{room?.concept ?? "-"}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 12 ? "text-error animate-pulse" : "text-foreground"}`}>
                <Clock3 className="h-4 w-4" />
                {timeLeft}s
              </div>
            </div>

            {screen === "playing" && room ? (
              awaitingNext ? (
                <div className="space-y-3">
                  <p className="text-success font-semibold text-body-sm">Laser disabled! Gem recovered!</p>
                  <button type="button" onClick={goToNext} className="btn btn-primary btn-lg w-full">
                    <ArrowRight className="h-4 w-4" />
                    {roomIndex + 1 < ROOMS.length ? "Next Room" : "See Results"}
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={submitAnswer} className="space-y-3">
                    <label className="block text-label-md font-bold text-foreground">Angle (degrees)</label>
                    <input
                      ref={inputRef}
                      type="number"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="e.g. 65"
                      className="input-field w-full"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!answer.trim()} className="btn btn-primary btn-lg w-full disabled:opacity-50">
                      <Zap className="h-4 w-4" />
                      Disable Laser
                    </button>
                  </form>
                  {showHint && (
                    <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3 text-body-sm text-text-secondary">
                      {room.hint}
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="text-body-md text-text-secondary">Press Start Game to begin the heist.</p>
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
              <button type="button" onClick={() => setShowRules((r) => !r)} className="btn btn-secondary btn-md">
                <BookOpen className="h-4 w-4" />
                Angle Rules
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
                <div><span className="font-bold text-accent">Corresponding angles:</span> same position at each intersection - equal</div>
                <div><span className="font-bold text-accent">Alternate angles:</span> between the lines, opposite sides (Z-shape) - equal</div>
                <div><span className="font-bold text-accent">Co-interior angles:</span> between the lines, same side (C-shape) - sum to 180 degrees</div>
                <div><span className="font-bold text-accent">Straight line:</span> angles on a straight line sum to 180 degrees</div>
                <div><span className="font-bold text-accent">Vertically opposite:</span> across the same crossing point - equal</div>
              </div>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Calculate the missing angle at each laser grid</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> You have 40 seconds per room</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> Wrong answers or running out of time cost a shield</li>
              <li className="flex gap-3"><span className="text-error font-bold">4.</span> Lose all 3 shields and the alarm triggers</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
