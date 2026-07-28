import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Anchor,
  Compass,
  Ship,
  Skull,
  Trophy,
  RotateCcw,
  ArrowRight,
  Volume2,
  VolumeX,
  MapPin,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

const GRID_SIZE = 12;
const CANVAS_SIZE = 540;
const CELL = CANVAS_SIZE / GRID_SIZE;

const ISLANDS = [
  { key: "portRoyal", name: "Port Royal", x: 1, y: 1, color: "#f5d485" },
  { key: "skeletonCay", name: "Skeleton Cay", x: 5, y: 4, color: "#c9c9c9" },
  { key: "crabIsland", name: "Crab Island", x: 2, y: 8, color: "#e8926a" },
  { key: "skullReef", name: "Skull Reef", x: 7, y: 10, color: "#8b5cf6" },
];

const VOYAGES = [
  {
    id: "voyage-1",
    badge: "Voyage 1",
    title: "Crossing the Reef",
    story:
      "The lookout spots a hidden reef ahead. To cross safely from Port Royal to Skeleton Cay, chart the direct line across the open water.",
    prompt:
      "The ship sails 4 miles east, then 3 miles north to skirt the reef. How many miles is the direct route (the hypotenuse) across the water?",
    unit: "miles",
    diagram: "route",
    from: "portRoyal",
    to: "skeletonCay",
    legs: [4, 3],
    unknownSide: "hyp",
    options: ["5 miles", "6 miles", "7 miles", "4.5 miles"],
    correctIndex: 0,
  },
  {
    id: "voyage-2",
    badge: "Voyage 2",
    title: "The Crow's Nest Mast",
    story:
      "A storm has snapped the support rope on the main mast near Skeleton Cay. The carpenter needs the mast's height to cut a new beam.",
    prompt:
      "A support rope runs 13 meters from the top of the mast to a point on deck 5 meters from its base. How tall is the mast?",
    unit: "meters",
    diagram: "mast",
    legs: [5, 12],
    hyp: 13,
    unknownSide: "legB",
    options: ["12 meters", "11 meters", "13 meters", "18 meters"],
    correctIndex: 0,
  },
  {
    id: "voyage-3",
    badge: "Voyage 3",
    title: "Treasure Island Triples",
    story:
      "An old map found on Crab Island shows two paced-out legs of a jungle path. X marks the spot at the far corner.",
    prompt:
      "The map shows the path runs 8 leagues, then turns at a right angle for 15 leagues to reach the treasure. What is the direct distance from the start to the treasure?",
    unit: "leagues",
    diagram: "treasure",
    legs: [8, 15],
    unknownSide: "hyp",
    options: ["17 leagues", "23 leagues", "16 leagues", "20 leagues"],
    correctIndex: 0,
  },
  {
    id: "voyage-4",
    badge: "Voyage 4",
    title: "Final Grid Navigation",
    story:
      "With the map fully charted, the captain must plot a final course across the grid to Skull Reef, where the last treasure awaits.",
    prompt:
      "On the navigation grid, the ship starts at coordinate (1, 2) and must reach (7, 10). What is the direct sailing distance between these two points?",
    unit: "leagues",
    diagram: "grid",
    from: { x: 1, y: 2 },
    to: { x: 7, y: 10 },
    legs: [6, 8],
    unknownSide: "hyp",
    options: ["10 leagues", "14 leagues", "8 leagues", "12 leagues"],
    correctIndex: 0,
  },
];

function toPixel(gx, gy) {
  return { px: gx * CELL + CELL / 2, py: CANVAS_SIZE - (gy * CELL + CELL / 2) };
}

function getIsland(key) {
  return ISLANDS.find((i) => i.key === key);
}

// ---------- Web Audio synthesis ----------

function useShipSounds() {
  const ctxRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
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

  const playSweep = useCallback(
    (fromFreq, toFreq, startOffset, duration, type = "sawtooth", peakGain = 0.12) => {
      if (mutedRef.current) return;
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      const start = ctx.currentTime + startOffset;
      osc.frequency.setValueAtTime(fromFreq, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 1), start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    },
    [getCtx]
  );

  const playClick = useCallback(() => playTone(720, 0, 0.08, "sine", 0.1), [playTone]);

  const playCorrect = useCallback(() => {
    [523.25, 659.25, 783.99].forEach((freq, i) => playTone(freq, i * 0.09, 0.22, "triangle", 0.16));
  }, [playTone]);

  const playWrong = useCallback(() => {
    playSweep(320, 120, 0, 0.35, "sawtooth", 0.14);
  }, [playSweep]);

  const playVictory = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => playTone(freq, i * 0.14, 0.4, "triangle", 0.18));
  }, [playTone]);

  const playDefeat = useCallback(() => {
    playSweep(220, 55, 0, 1.4, "sawtooth", 0.13);
    playTone(60, 0.1, 1.3, "sine", 0.12);
  }, [playSweep, playTone]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      return !m;
    });
  }, []);

  return { playClick, playCorrect, playWrong, playVictory, playDefeat, muted, toggleMute };
}

// ---------- Canvas drawing ----------

function drawRightTriangle(ctx, ax, ay, cornerx, cornery, bx, by, { unknownSide, legALabel, legBLabel, hypLabel, strokeColor }) {
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = strokeColor;
  ctx.setLineDash(unknownSide === "legA" ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(cornerx, cornery);
  ctx.stroke();

  ctx.setLineDash(unknownSide === "legB" ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(cornerx, cornery);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.setLineDash(unknownSide === "hyp" ? [6, 5] : []);
  ctx.strokeStyle = unknownSide === "hyp" ? "#fbbf24" : "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);

  // right-angle marker
  const s = 10;
  const signX = Math.sign(ax - cornerx) || 1;
  const signY = Math.sign(by - cornery) || 1;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cornerx + signX * s, cornery);
  ctx.lineTo(cornerx + signX * s, cornery + signY * s);
  ctx.lineTo(cornerx, cornery + signY * s);
  ctx.stroke();

  ctx.font = "bold 13px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawLabel = (x, y, text, isUnknown) => {
    ctx.fillStyle = isUnknown ? "#fbbf24" : "#ffffff";
    const padX = 6;
    const metrics = ctx.measureText(text);
    ctx.fillStyle = "rgba(7,20,38,0.75)";
    ctx.fillRect(x - metrics.width / 2 - padX, y - 10, metrics.width + padX * 2, 20);
    ctx.fillStyle = isUnknown ? "#fbbf24" : "#e5f4ff";
    ctx.fillText(text, x, y);
  };

  drawLabel((ax + cornerx) / 2, ay + (cornery === ay ? -14 : (ay < cornery ? -14 : 14)), legALabel, unknownSide === "legA");
  drawLabel(cornerx + (bx > cornerx ? 26 : -26), (cornery + by) / 2, legBLabel, unknownSide === "legB");
  drawLabel((ax + bx) / 2, (ay + by) / 2 - 16, hypLabel, unknownSide === "hyp");
  ctx.restore();
}

function drawShip(ctx, px, py, angleRad = 0) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angleRad);
  ctx.fillStyle = "#8b5a2b";
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.lineTo(11, 6);
  ctx.lineTo(7, 13);
  ctx.lineTo(-7, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f5d485";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 6);
  ctx.stroke();
  ctx.fillStyle = "#f4f1e8";
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(13, 2);
  ctx.lineTo(0, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIsland(ctx, island) {
  const { px, py } = toPixel(island.x, island.y);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, 14, 0, Math.PI * 2);
  ctx.fillStyle = island.color;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "bold 11px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#e5f4ff";
  const label = island.name;
  const metrics = ctx.measureText(label);
  ctx.fillStyle = "rgba(7,20,38,0.7)";
  ctx.fillRect(px - metrics.width / 2 - 5, py + 18, metrics.width + 10, 16);
  ctx.fillStyle = "#e5f4ff";
  ctx.fillText(label, px, py + 26);
  ctx.restore();
}

function renderScene(canvas, { voyage, solved, shipT }) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
  grd.addColorStop(0, "#0a1929");
  grd.addColorStop(0.55, "#0e3a5c");
  grd.addColorStop(1, "#0a2540");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(CANVAS_SIZE, i * CELL);
    ctx.stroke();
  }

  ISLANDS.forEach((island) => drawIsland(ctx, island));

  if (!voyage) {
    const start = toPixel(1, 1);
    drawShip(ctx, start.px, start.py, 0);
    return;
  }

  if (voyage.diagram === "route" || voyage.diagram === "grid") {
    const from = voyage.diagram === "route" ? getIsland(voyage.from) : voyage.from;
    const to = voyage.diagram === "route" ? getIsland(voyage.to) : voyage.to;
    const a = toPixel(from.x, from.y);
    const b = toPixel(to.x, to.y);
    const corner = toPixel(to.x, from.y);

    drawRightTriangle(ctx, a.px, a.py, corner.px, corner.py, b.px, b.py, {
      unknownSide: voyage.unknownSide,
      legALabel: `${voyage.legs[0]} ${voyage.unit}`,
      legBLabel: `${voyage.legs[1]} ${voyage.unit}`,
      hypLabel: solved ? `${voyage.options[voyage.correctIndex]}` : "?",
      strokeColor: "#4ade80",
    });

    const t = shipT;
    const shipPx = a.px + (b.px - a.px) * t;
    const shipPy = a.py + (b.py - a.py) * t;
    const angle = Math.atan2(b.px - a.px, -(b.py - a.py));
    drawShip(ctx, shipPx, shipPy, angle * 0.15);
  } else {
    // inset diagram (mast / treasure) — abstract, not tied to grid coordinates
    const ox = 150;
    const oy = 400;
    const legAPx = 130;
    const legBPx = 190;
    const ax = ox;
    const ay = oy;
    const cornerx = ox + legAPx;
    const cornery = oy;
    const bx = cornerx;
    const by = oy - legBPx;

    const legALabel = voyage.diagram === "mast" ? `${voyage.legs[0]} m` : `${voyage.legs[0]} leagues`;
    const legBLabel =
      voyage.unknownSide === "legB"
        ? (solved ? voyage.options[voyage.correctIndex] : "?")
        : voyage.diagram === "mast"
        ? `${voyage.legs[1]} m`
        : `${voyage.legs[1]} leagues`;
    const hypLabel =
      voyage.unknownSide === "hyp"
        ? (solved ? voyage.options[voyage.correctIndex] : "?")
        : voyage.diagram === "mast"
        ? `${voyage.hyp} m`
        : `${voyage.hyp || ""} leagues`;

    drawRightTriangle(ctx, ax, ay, cornerx, cornery, bx, by, {
      unknownSide: voyage.unknownSide,
      legALabel,
      legBLabel,
      hypLabel,
      strokeColor: voyage.diagram === "mast" ? "#60a5fa" : "#f5d485",
    });

    if (voyage.diagram === "mast") {
      drawShip(ctx, ox - 24, oy + 4, 0);
    } else {
      ctx.font = "22px serif";
      ctx.fillText("🏝️", bx, by - 20);
    }
  }
}

// ---------- Component ----------

const Route = createFileRoute("/pirate-navigator")({
  head: () => ({
    meta: [
      { title: "Uncharted Waters: The Pirate Navigator — AdaptiveMind" },
      {
        name: "description",
        content: "A grade 9 Pythagorean Theorem sailing adventure across a charted nautical grid.",
      },
    ],
  }),
  component: PirateNavigatorPage,
});

function PirateNavigatorPage() {
  const canvasRef = useRef(null);
  const sounds = useShipSounds();
  const { reportFinish } = useGameSession("pirate");

  const [screen, setScreen] = useState("start"); // start | playing | victory | defeat
  const [voyageIndex, setVoyageIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [shipT, setShipT] = useState(0);

  const voyage = VOYAGES[voyageIndex];

  const renderNow = useCallback(
    (solved, t) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderScene(canvas, { voyage: screen === "playing" ? voyage : null, solved, shipT: t });
    },
    [voyage, screen]
  );

  // Redraw a fresh, unsolved diagram whenever the voyage or screen changes.
  // Post-answer rendering (instant reveal on a wrong answer, animated sail on a
  // correct one) is handled directly in confirmAnswer/animateShip so it isn't
  // fought over by two renders on the same transition.
  useEffect(() => {
    renderNow(false, 0);
  }, [voyageIndex, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate ship sailing across the route/grid diagrams on correct answer
  const animateShip = useCallback(() => {
    const start = performance.now();
    const duration = 700;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setShipT(progress);
      const canvas = canvasRef.current;
      if (canvas) renderScene(canvas, { voyage, solved: true, shipT: progress });
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [voyage]);

  const startGame = () => {
    sounds.playClick();
    setScreen("playing");
    setVoyageIndex(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setWrongCount(0);
    setShipT(0);
  };

  const chooseOption = (index) => {
    if (answered) return;
    sounds.playClick();
    setSelected(index);
  };

  const confirmAnswer = () => {
    if (selected === null || answered) return;
    const isCorrect = selected === voyage.correctIndex;
    setAnswered(true);

    if (isCorrect) {
      sounds.playCorrect();
      setCorrectCount((c) => c + 1);
      animateShip();
    } else {
      sounds.playWrong();
      setWrongCount((w) => w + 1);
      renderNow(true, 0);
    }
  };

  const nextVoyage = () => {
    if (voyageIndex + 1 < VOYAGES.length) {
      setVoyageIndex((v) => v + 1);
      setSelected(null);
      setAnswered(false);
      setShipT(0);
      return;
    }

    const finalCorrect = correctCount;
    const won = finalCorrect >= 3;
    reportFinish(won ? "win" : "loss", Math.round((finalCorrect / VOYAGES.length) * 100), {
      correctCount: finalCorrect,
      totalCount: VOYAGES.length,
    });
    if (won) {
      setScreen("victory");
      sounds.playVictory();
    } else {
      setScreen("defeat");
      sounds.playDefeat();
    }
  };

  const restart = () => {
    startGame();
  };

  const scorePct = Math.round((correctCount / VOYAGES.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Anchor className="h-4 w-4" />
            GAME 4 · UNCHARTED WATERS
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">The Pirate Navigator</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            Chart a course across the sea using the Pythagorean Theorem. Solve each voyage's right-triangle
            puzzle to sail on toward the treasure.
          </p>
        </div>
        <button
          type="button"
          onClick={sounds.toggleMute}
          className="btn btn-secondary btn-md self-start"
        >
          {sounds.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {sounds.muted ? "Muted" : "Sound On"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="container-game rounded-3xl relative">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1929] via-[#0e3a5c] to-[#0a2540] p-6 shadow-[inset_0_0_120px_rgba(15,23,42,0.35)]">
            <div className="absolute left-8 top-8 z-10 flex items-center gap-2 text-slate-200/70">
              <Compass className="h-6 w-6" />
            </div>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="mx-auto block rounded-2xl border border-white/10"
            />
          </div>

          {screen === "start" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-[#071426]/85 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <Ship className="mx-auto h-14 w-14 text-accent" />
                <h2 className="mt-4 text-heading-lg text-foreground">Set sail, navigator</h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  Four voyages stand between you and Skull Reef. Answer at least 3 of 4 correctly to claim the
                  treasure — two wrong answers and the ship goes down.
                </p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <Anchor className="h-4 w-4" />
                  Begin Voyage
                </button>
              </div>
            </div>
          )}

          {screen === "victory" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-[#071426]/90 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <Trophy className="mx-auto h-16 w-16 text-warning" />
                <h2 className="mt-4 text-heading-lg text-foreground">Treasure Found!</h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  {correctCount} of {VOYAGES.length} voyages charted correctly ({scorePct}%). The crew cheers as
                  Skull Reef comes into view.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={restart} className="btn btn-primary btn-lg">
                    <RotateCcw className="h-4 w-4" />
                    Set Sail Again
                  </button>
                  <Link to="/" className="btn btn-secondary btn-lg">
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}

          {screen === "defeat" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-[#071426]/90 backdrop-blur-sm">
              <div className="max-w-sm text-center">
                <Skull className="mx-auto h-16 w-16 text-error" />
                <h2 className="mt-4 text-heading-lg text-foreground">Shipwrecked!</h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  Only {correctCount} of {VOYAGES.length} voyages charted correctly ({scorePct}%). The ship struck
                  the reef — chart a better course and try again.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={restart} className="btn btn-primary btn-lg">
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
        </section>

        <aside className="space-y-4">
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-label-md text-text-muted">{screen === "playing" ? voyage.badge : "STANDING BY"}</div>
                <h2 className="mt-1 text-heading-lg text-foreground">
                  {screen === "playing" ? voyage.title : "Awaiting departure"}
                </h2>
              </div>
              <div className="badge badge-primary">
                <MapPin className="h-3.5 w-3.5" />
                {correctCount}/{VOYAGES.length}
              </div>
            </div>

            {screen === "playing" && (
              <div className="mt-4 space-y-4">
                <p className="text-body-sm text-text-secondary">{voyage.story}</p>
                <div className="rounded-2xl bg-accent/10 p-4 text-body-md text-foreground shadow-inner border border-accent/20">
                  {voyage.prompt}
                </div>

                <div className="space-y-2">
                  {voyage.options.map((option, index) => {
                    const isSelected = selected === index;
                    const isCorrectOption = index === voyage.correctIndex;
                    let stateClasses = "border-white/10 hover:border-accent/50";
                    if (answered && isCorrectOption) {
                      stateClasses = "border-success bg-success/10 text-success";
                    } else if (answered && isSelected && !isCorrectOption) {
                      stateClasses = "border-error bg-error/10 text-error";
                    } else if (!answered && isSelected) {
                      stateClasses = "border-accent bg-accent/10 text-accent";
                    }
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => chooseOption(index)}
                        disabled={answered}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-body-sm font-semibold transition-colors ${stateClasses}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {!answered ? (
                  <button
                    type="button"
                    onClick={confirmAnswer}
                    disabled={selected === null}
                    className="btn btn-primary btn-lg w-full"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Confirm Answer
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div
                      className={`rounded-xl p-3 text-body-sm font-semibold ${
                        selected === voyage.correctIndex ? "bg-success/10 text-success" : "bg-error/10 text-error"
                      }`}
                    >
                      {selected === voyage.correctIndex
                        ? "Correct! The ship sails on."
                        : `Not quite — the correct answer was ${voyage.options[voyage.correctIndex]}.`}
                    </div>
                    <button type="button" onClick={nextVoyage} className="btn btn-primary btn-lg w-full">
                      <ArrowRight className="h-4 w-4" />
                      {voyageIndex + 1 < VOYAGES.length ? "Next Voyage" : "See Results"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {screen !== "playing" && (
              <p className="mt-4 text-body-md text-text-secondary">
                Press "Begin Voyage" to start charting a course across four Pythagorean Theorem challenges.
              </p>
            )}
          </div>

          <div className="card rounded-2xl">
            <p className="text-label-md text-text-muted">HOW TO WIN</p>
            <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
            <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
              <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Answer 4 sequential Pythagorean Theorem voyages</li>
              <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Score 3 or 4 correct (≥75%) to find the treasure</li>
              <li className="flex gap-3"><span className="text-error font-bold">3.</span> 2 or more wrong answers (≤50%) sinks the ship</li>
            </ul>
          </div>

          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted mb-2">MAP KEY</div>
            <div className="grid grid-cols-2 gap-2 text-body-sm text-text-secondary">
              {ISLANDS.map((island) => (
                <div key={island.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: island.color }} />
                  {island.name}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { Route };
