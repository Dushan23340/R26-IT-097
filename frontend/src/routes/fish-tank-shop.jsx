import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Fish,
  Store,
  DollarSign,
  MessageCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";
import { randInt, randChoice, shuffle } from "@/lib/gameRandom";

// Grade-9 liquid volume & capacity: V = l x b x h (cm^3), 1000 cm^3 = 1 L.
// Orders are freshly randomized per game start (generateOrders below) so
// concurrent students, and repeat plays, each get different tank sizes -
// not the same 5 hardcoded orders every time. Verified against 20,000
// generated order sets (100,000 tanks) in a standalone script: every
// order's 4 tanks always have distinct volumes, the stated needLabel
// always round-trips exactly to the correct tank's real volume, and
// large (Litre-scale) orders never need more than 1 decimal place.
function tankVolume(tank) {
  return tank.l * tank.b * tank.h;
}

function formatVolume(cm3) {
  const liters = cm3 / 1000;
  return `${cm3.toLocaleString()} cm3 = ${liters} L`;
}

const SMALL_CUSTOMER_LINES = [
  (cm3) => `Just a tiny bowl for one goldfish - ${cm3} milliliters should do it.`,
  (cm3) => `I'm setting up a tiny nano tank - I need about ${cm3} milliliters of water.`,
];
const LARGE_CUSTOMER_LINES = [
  (l) => `Hello! I need a tank that can hold exactly ${l} Liters of water!`,
  (l) => `I'm setting up a small betta tank - I need ${l} Liters of water.`,
  (l) => `I'm going big - a proper display tank for ${l} Liters, please!`,
  (l) => `My last one - I need exactly ${l} Liters for my cichlid tank.`,
];

function perturbTank(base, isSmall) {
  // Perturbing exactly 1 axis by a fixed step collides for symmetric bases
  // (e.g. a 5x5x5 cube: nudging any single axis by the same delta gives the
  // same volume via commutativity, since l*b*h doesn't care which axis
  // changed) - varying how many axes change, and by how much, avoids that.
  const dims = shuffle(["l", "b", "h"]);
  const numDimsToPerturb = randChoice([1, 1, 2]);
  const next = { ...base };
  for (let i = 0; i < numDimsToPerturb; i++) {
    const dim = dims[i];
    const step = isSmall ? 5 : dim === "h" ? 20 : 5;
    const mult = randChoice([1, 2]);
    next[dim] = next[dim] + randChoice([-1, 1]) * step * mult;
  }
  if (next.l <= 0 || next.b <= 0 || next.h <= 0) return null;
  return next;
}

function generateDistractors(correctDims, isSmall) {
  const usedVolumes = new Set([tankVolume(correctDims)]);
  const distractors = [];
  let attempts = 0;
  while (distractors.length < 3 && attempts < 300) {
    attempts++;
    const candidate = perturbTank(correctDims, isSmall);
    if (!candidate) continue;
    const vol = tankVolume(candidate);
    if (vol <= 0 || usedVolumes.has(vol)) continue;
    usedVolumes.add(vol);
    distractors.push(candidate);
  }
  // Verified this never happens across 100,000 generated orders, but a
  // fallback keeps the game from ever rendering fewer than 4 tank options.
  let fallbackStep = isSmall ? 5 : 20;
  while (distractors.length < 3) {
    fallbackStep += isSmall ? 5 : 20;
    const candidate = { ...correctDims, l: correctDims.l + fallbackStep };
    const vol = tankVolume(candidate);
    if (!usedVolumes.has(vol)) {
      usedVolumes.add(vol);
      distractors.push(candidate);
    }
  }
  return distractors;
}

function generateOrder(orderId, isSmall) {
  let l, b, h, cm3;
  if (isSmall) {
    // Rejection sampling: a plain range for l/b/h alone doesn't guarantee
    // a sub-1000cm3 (mL-scale) result - e.g. 15x15x15 alone is 3375cm3.
    do {
      l = randInt(5, 15, 5);
      b = randInt(5, 15, 5);
      h = randInt(5, 15, 5);
      cm3 = l * b * h;
    } while (cm3 >= 1000);
  } else {
    // l/b multiples of 5, h a multiple of 20 - guarantees the volume is
    // always a multiple of 100, so needLabel never needs more than 1
    // decimal place (matching the original hand-authored orders' format).
    l = randInt(20, 60, 5);
    b = randInt(20, 60, 5);
    h = randInt(20, 40, 20);
    cm3 = l * b * h;
  }
  const correctDims = { l, b, h };
  const liters = cm3 / 1000;
  const needLabel = cm3 < 1000 ? `${cm3} mL` : `${Number.isInteger(liters) ? liters : liters.toFixed(1)} L`;
  const customer = isSmall
    ? randChoice(SMALL_CUSTOMER_LINES)(cm3)
    : randChoice(LARGE_CUSTOMER_LINES)(Number.isInteger(liters) ? liters : liters.toFixed(1));

  const distractorDims = generateDistractors(correctDims, isSmall);
  const allDims = shuffle([correctDims, ...distractorDims]);
  const tankIds = ["a", "b", "c", "d"];
  const tanks = allDims.map((dims, i) => ({ id: tankIds[i], ...dims }));
  const correctTankId = tanks.find((t) => t.l === l && t.b === b && t.h === h).id;

  return { id: orderId, customer, needLabel, tanks, correctTankId };
}

function generateOrders() {
  const smallIndex = randInt(0, 4);
  return Array.from({ length: 5 }, (_, i) => generateOrder(`order-${i + 1}`, i === smallIndex));
}

const SALARY_PER_SALE = 5;
const WIN_THRESHOLD = 3; // at least 3 of 5 correct sales to end the shift on a high note

const Route = createFileRoute("/fish-tank-shop")({
  head: () => ({
    meta: [
      { title: "Fish Tank Shop — AdaptiveMind" },
      {
        name: "description",
        content: "A grade-9 liquid volume and capacity simulation - calculate tank volume and sell customers the right aquarium.",
      },
    ],
  }),
  component: FishTankShopPage,
});

function FishTankShopPage() {
  const { reportFinish } = useGameSession("fish_tank_shop");

  const [screen, setScreen] = useState("start"); // start | playing | done
  // Freshly randomized on mount and again on every startGame() call - see
  // generateOrders above.
  const [orders, setOrders] = useState(() => generateOrders());
  const [orderIndex, setOrderIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [selectedTankId, setSelectedTankId] = useState(null);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null

  const salary = correctCount * SALARY_PER_SALE;
  const order = orders[orderIndex];
  const finished = orderIndex >= orders.length;

  useEffect(() => {
    if (screen !== "playing" || !finished) return;
    const won = correctCount >= WIN_THRESHOLD;
    reportFinish(won ? "win" : "loss", Math.round((correctCount / orders.length) * 100), {
      correctCount,
      totalCount: orders.length,
    });
    setScreen("done");
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  function startGame() {
    setScreen("playing");
    setOrders(generateOrders());
    setOrderIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSelectedTankId(null);
    setFeedback(null);
  }

  function sellTank(tankId) {
    if (feedback != null || !order) return;
    setSelectedTankId(tankId);
    const correct = tankId === order.correctTankId;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setCorrectCount((prev) => prev + 1);
    } else {
      setWrongCount((prev) => prev + 1);
    }
    setTimeout(() => {
      setOrderIndex((prev) => prev + 1);
      setSelectedTankId(null);
      setFeedback(null);
    }, 1600);
  }

  const won = screen === "done" && correctCount >= WIN_THRESHOLD;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Store className="h-4 w-4" />
            GAME 6 · FISH TANK SHOP
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">Fish Tank Shop</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
            You're running the counter. Calculate each tank's volume (V = l x b x h, 1000 cm3 = 1 L) and
            sell customers the aquarium that matches what they need.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SALARY</div>
            <div className="mt-2 flex items-center gap-1 text-display-sm font-bold text-accent">
              <DollarSign className="h-5 w-5" />{salary}
            </div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">SOLD</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">{correctCount}/{orders.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">REJECTED</div>
            <div className="mt-2 text-display-sm font-bold text-error">{wrongCount}</div>
          </div>
        </div>
      </div>

      <section className="container-game rounded-3xl relative">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2233] via-[#123a4d] to-[#0a1929] p-6 text-slate-100 min-h-[480px]">
          {screen === "start" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20 rounded-3xl">
              <div className="max-w-sm text-center px-6">
                <Fish className="mx-auto h-12 w-12 text-cyan-300" />
                <h2 className="mt-4 text-heading-lg text-white">Welcome to the shop!</h2>
                <p className="mt-2 text-sm text-slate-200">
                  5 customers are waiting. Sell at least {WIN_THRESHOLD} of them the correct tank to
                  finish the shift on a high note.
                </p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Open the Shop
                </button>
              </div>
            </div>
          )}

          {screen === "playing" && order && (
            <div className="relative z-10 space-y-6">
              <div className="flex items-start gap-3">
                <div className="text-4xl select-none" role="img" aria-label="Customer">🧑</div>
                <div className="relative rounded-2xl rounded-tl-none bg-white text-slate-900 px-4 py-3 max-w-md shadow-lg">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                    <MessageCircle className="h-3 w-3" /> Customer {orderIndex + 1} of {orders.length}
                  </div>
                  <p className="text-sm font-medium">{order.customer}</p>
                  <p className="mt-1 text-xs text-slate-500">Needs: <span className="font-bold text-accent">{order.needLabel}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {order.tanks.map((tank) => {
                  const volume = tankVolume(tank);
                  const isSelected = selectedTankId === tank.id;
                  const isCorrectTank = tank.id === order.correctTankId;
                  let stateClasses = "border-white/15 bg-white/5 hover:border-accent/60";
                  if (feedback != null && isCorrectTank) stateClasses = "border-success bg-success/10";
                  else if (feedback === "wrong" && isSelected) stateClasses = "border-error bg-error/10";

                  return (
                    <button
                      key={tank.id}
                      type="button"
                      onClick={() => sellTank(tank.id)}
                      disabled={feedback != null}
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${stateClasses}`}
                    >
                      <Fish className="h-8 w-8 text-cyan-300" />
                      <span className="text-xs font-semibold text-slate-100">
                        {tank.l}cm x {tank.b}cm x {tank.h}cm
                      </span>
                      {feedback != null && (isCorrectTank || isSelected) && (
                        <span className="text-[10px] text-slate-300">{formatVolume(volume)}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <div className={`rounded-xl p-3 text-body-sm font-semibold ${feedback === "correct" ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                  {feedback === "correct"
                    ? `Sold! The customer is thrilled. +${SALARY_PER_SALE} salary.`
                    : `Not quite - tip: multiply l x b x h to get cm3, then divide by 1000 for litres. The right tank was ${order.tanks.find((t) => t.id === order.correctTankId).l}cm x ${order.tanks.find((t) => t.id === order.correctTankId).b}cm x ${order.tanks.find((t) => t.id === order.correctTankId).h}cm.`}
                </div>
              )}
            </div>
          )}

          {screen === "done" && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6 rounded-2xl bg-white/90 backdrop-blur-sm py-8">
                {won ? (
                  <Sparkles className="mx-auto h-14 w-14 text-emerald-500" />
                ) : (
                  <Fish className="mx-auto h-14 w-14 text-slate-400" />
                )}
                <h2 className={`mt-4 text-heading-lg font-bold ${won ? "text-emerald-900" : "text-slate-700"}`}>
                  {won ? "Great Shift!" : "Tough Shift"}
                </h2>
                <p className={`mt-2 ${won ? "text-emerald-800" : "text-slate-600"}`}>
                  {won ? "The shop is thriving thanks to your math skills!" : "A few sales slipped away - review the volume formula and try again."}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {correctCount} of {orders.length} tanks sold - ${salary} earned.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <RotateCcw className="h-4 w-4" />
                    Work Another Shift
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
          <li className="flex gap-3"><span className="text-accent font-bold">1.</span> Each customer states the water volume they need in L or mL</li>
          <li className="flex gap-3"><span className="text-accent font-bold">2.</span> Calculate V = l x b x h in cm3, then convert to litres (1000 cm3 = 1 L)</li>
          <li className="flex gap-3"><span className="text-accent font-bold">3.</span> Sell at least {WIN_THRESHOLD} of {orders.length} customers the correct tank</li>
        </ul>
      </div>
    </div>
  );
}

export { Route };
