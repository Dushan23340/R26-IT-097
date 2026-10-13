// Question generators for the three lesson-aligned question games. Every
// answer is computed from the question's own randomized parameters, so a
// generated question cannot carry a wrong key. Each game serves 10
// questions: 4 remember, 4 understand, 2 apply.
import { randChoice, randInt, shuffle } from "@/lib/gameRandom";

// Builds 4 unique choices: the answer plus the first 3 usable distractors.
// A distractor is dropped if it repeats the answer or another choice, or if
// it is a negative or non-finite number (a quantity here is never negative).
// If a numeric question still has too few, nearby whole numbers fill the gap.
function withChoices(question, distractors) {
  const answer = String(question.answer);
  const seen = new Set([answer]);
  const picked = [];
  const usable = (d) => !/^-|NaN|Infinity|undefined/.test(d);
  const candidates = distractors.map(String).filter(usable);
  if (/^\d+$/.test(answer)) {
    const n = Number(answer);
    candidates.push(...[n + 3, n + 5, n + 1, n + 7, n + 2].map(String));
  }
  for (const d of candidates) {
    if (!seen.has(d)) {
      seen.add(d);
      picked.push(d);
    }
    if (picked.length === 3) break;
  }
  return { ...question, answer, choices: shuffle([answer, ...picked]) };
}

function assemble(remember, understand, apply) {
  const pick = (gens, n, level) => shuffle(gens).slice(0, n).map((g) => ({ level, ...g() }));
  const repeat = (gens, n, level) => Array.from({ length: n }, (_, i) => ({ level, ...gens[i % gens.length]() }));
  return [...repeat(remember, 4, "remember"), ...repeat(understand, 4, "understand"), ...pick(apply, 2, "apply")];
}

// ------------------------------------------------------------ binary numbers
const toBin = (n) => n.toString(2);

function binPlaceValue() {
  const pos = randInt(2, 7);
  const answer = 2 ** (pos - 1);
  return withChoices(
    { prompt: `In a binary number, what is the place value of the digit in position ${pos} from the right? (Position 1 is the rightmost digit.)`, answer, explain: `Place values double each step: 1, 2, 4, 8... Position ${pos} is 2^${pos - 1} = ${answer}.` },
    [answer * 2, answer / 2, pos * 2, answer + 2, pos]
  );
}

function binPowerOfTwo() {
  const n = randInt(3, 8);
  const answer = 2 ** n;
  return withChoices({ prompt: `What is the value of 2^${n}?`, answer, explain: `2 multiplied by itself ${n} times is ${answer}.` }, [2 * n, 2 ** (n - 1), 2 ** (n + 1), answer - 2, n * n]);
}

function binToDecimal() {
  const n = randInt(9, 63);
  const b = toBin(n);
  return withChoices(
    { prompt: `Convert the binary number ${b} to a decimal number.`, answer: n, explain: `Add the place values of every 1 in ${b}: the total is ${n}.` },
    [n + 1, n - 1, n + 2, n - 2, n * 2]
  );
}

function decimalToBin() {
  const n = randInt(9, 63);
  const answer = toBin(n);
  return withChoices(
    { prompt: `Convert the decimal number ${n} to binary.`, answer, explain: `Divide ${n} by 2 repeatedly and read the remainders from last to first: ${answer}.` },
    [toBin(n + 1), toBin(n - 1), toBin(n + 2), toBin(n - 2), toBin(n + 4)]
  );
}

function binAddition() {
  const a = randInt(3, 15);
  const b = randInt(3, 15);
  const answer = toBin(a + b);
  return withChoices(
    { prompt: `Add the binary numbers ${toBin(a)} + ${toBin(b)}. Give the answer in binary.`, answer, explain: `${toBin(a)} is ${a} and ${toBin(b)} is ${b}. ${a} + ${b} = ${a + b}, which is ${answer} in binary.` },
    [toBin(a + b + 1), toBin(a + b - 1), toBin(a + b + 2), toBin(a + b - 2), toBin(a + b + 4)]
  );
}

function binSwitches() {
  const n = randInt(5, 30);
  const bits = toBin(n).padStart(5, "0");
  const row = bits.split("").map((d) => (d === "1" ? "ON" : "OFF")).join(", ");
  return withChoices(
    { prompt: `Five switches in a row show: ${row}. If ON = 1 and OFF = 0, which decimal number do they show?`, answer: n, explain: `The switches read ${bits} in binary, which is ${n}.` },
    [n + 1, n - 1, n + 2, n * 2, n + 4]
  );
}

export const generateBinaryQuestions = () => assemble([binPlaceValue, binPowerOfTwo], [binToDecimal, decimalToBin], [binAddition, binSwitches]);

// --------------------------------------------------------------- percentages
const FRACTIONS = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [3, 5, 60], [4, 5, 80], [1, 10, 10], [3, 10, 30], [7, 10, 70]];

function pctFromFraction() {
  const [a, b, p] = randChoice(FRACTIONS);
  return withChoices({ prompt: `Write ${a}/${b} as a percentage.`, answer: `${p}%`, explain: `${a}/${b} × 100 = ${p}%.` }, [`${p + 10}%`, `${p - 5}%`, `${a * b}%`, `${p + 5}%`, `${100 - p + 1}%`]);
}

function pctToDecimal() {
  const p = randChoice([5, 8, 12, 15, 25, 35, 40, 60, 75, 90]);
  const answer = (p / 100).toString();
  return withChoices({ prompt: `Write ${p}% as a decimal.`, answer, explain: `Divide by 100: ${p} ÷ 100 = ${answer}.` }, [(p / 10).toString(), (p / 1000).toString(), p.toString(), ((p + 10) / 100).toString()]);
}

function pctOfAmount() {
  const p = randChoice([10, 20, 25, 30, 40, 50, 60, 75]);
  const base = randChoice([40, 80, 120, 160, 200, 240, 400]);
  const answer = (p * base) / 100;
  return withChoices({ prompt: `Find ${p}% of ${base}.`, answer, explain: `${p}/100 × ${base} = ${answer}.` }, [answer + 10, answer - 10, base - answer + 1, answer * 2, answer / 2]);
}

function pctWhatPercent() {
  const p = randChoice([10, 20, 25, 40, 50, 60, 75, 80]);
  const base = randChoice([20, 40, 60, 80, 200]);
  const part = (p * base) / 100;
  return withChoices({ prompt: `What percentage of ${base} is ${part}?`, answer: `${p}%`, explain: `${part}/${base} × 100 = ${p}%.` }, [`${p + 10}%`, `${p - 5}%`, `${100 - p + 2}%`, `${p + 5}%`, `${part}%`]);
}

function pctProfit() {
  const cost = randChoice([200, 400, 500, 800, 1000]);
  const p = randChoice([10, 20, 25, 30, 50]);
  const sell = cost + (cost * p) / 100;
  return withChoices(
    { prompt: `A shopkeeper buys an item for Rs. ${cost} and sells it for Rs. ${sell}. What is the profit percentage?`, answer: `${p}%`, explain: `Profit = ${sell} − ${cost} = ${sell - cost}. Profit % = ${sell - cost}/${cost} × 100 = ${p}%.` },
    [`${p + 5}%`, `${p + 10}%`, `${p * 2 + 1}%`, `${p - 5}%`, `${Math.round(((sell - cost) / sell) * 100) + 1}%`]
  );
}

function pctDiscount() {
  const price = randChoice([500, 800, 1000, 1200, 2000]);
  const d = randChoice([10, 20, 25, 30, 40]);
  const answer = price - (price * d) / 100;
  return withChoices(
    { prompt: `A bag is marked Rs. ${price}. A discount of ${d}% is given. What is the selling price?`, answer: `Rs. ${answer}`, explain: `Discount = ${d}/100 × ${price} = ${(price * d) / 100}. Selling price = ${price} − ${(price * d) / 100} = Rs. ${answer}.` },
    [`Rs. ${(price * d) / 100}`, `Rs. ${price - d}`, `Rs. ${answer + 50}`, `Rs. ${price + (price * d) / 100}`, `Rs. ${answer - 50}`]
  );
}

export const generatePercentQuestions = () => assemble([pctFromFraction, pctToDecimal], [pctOfAmount, pctWhatPercent], [pctProfit, pctDiscount]);

// ---------------------------------------------------------------------- sets
const fmt = (arr) => `{${[...arr].sort((x, y) => x - y).join(", ")}}`;

function randomSet(size, min = 1, max = 12) {
  const s = new Set();
  while (s.size < size) s.add(randInt(min, max));
  return [...s];
}

function twoSets() {
  // Two sets guaranteed to overlap in 1-2 elements and each to have
  // elements the other lacks, so union, intersection, A and B all differ.
  const common = randomSet(randInt(1, 2));
  const onlyA = randomSet(2, 13, 20);
  const onlyB = randomSet(2, 21, 28);
  return { A: [...common, ...onlyA], B: [...common, ...onlyB], common, onlyA, onlyB };
}

function setCount() {
  const A = randomSet(randInt(3, 7));
  return withChoices({ prompt: `A = ${fmt(A)}. What is n(A), the number of elements in A?`, answer: A.length, explain: `Count the elements: A has ${A.length}.` }, [A.length + 1, A.length - 1, A.length + 2, Math.max(...A)]);
}

function setMember() {
  const A = randomSet(4, 1, 20);
  const outside = [];
  for (let n = 1; outside.length < 3; n++) if (!A.includes(n)) outside.push(n);
  const answer = randChoice(A);
  return withChoices({ prompt: `A = ${fmt(A)}. Which of these numbers is an element of A?`, answer, explain: `${answer} is listed inside the brackets of A, so ${answer} ∈ A.` }, outside);
}

function setUnion() {
  const { A, B, common } = twoSets();
  const answer = fmt([...new Set([...A, ...B])]);
  return withChoices({ prompt: `A = ${fmt(A)} and B = ${fmt(B)}. Find A ∪ B.`, answer, explain: `The union holds every element that is in A or in B, written once: ${answer}.` }, [fmt(common), fmt(A), fmt(B)]);
}

function setIntersection() {
  const { A, B, common } = twoSets();
  const answer = fmt(common);
  return withChoices({ prompt: `A = ${fmt(A)} and B = ${fmt(B)}. Find A ∩ B.`, answer, explain: `The intersection holds only the elements that are in both A and B: ${answer}.` }, [fmt([...new Set([...A, ...B])]), fmt(A), fmt(B)]);
}

function setUnionCount() {
  const both = randInt(2, 6);
  const a = both + randInt(4, 10);
  const b = both + randInt(4, 10);
  const answer = a + b - both;
  return withChoices(
    { prompt: `In a class, ${a} students play cricket, ${b} play volleyball and ${both} play both. How many students play at least one of the two sports?`, answer, explain: `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = ${a} + ${b} − ${both} = ${answer}.` },
    [a + b, a + b + both, answer - both, answer + 1, a + b - 2 * both]
  );
}

function setSubsets() {
  const n = randInt(2, 5);
  const answer = 2 ** n;
  return withChoices({ prompt: `A set has ${n} elements. How many subsets does it have, including the empty set and the set itself?`, answer, explain: `A set with n elements has 2^n subsets: 2^${n} = ${answer}.` }, [2 * n, n * n + 1, answer - 1, answer * 2, n + 1]);
}

export const generateSetQuestions = () => assemble([setCount, setMember], [setUnion, setIntersection], [setUnionCount, setSubsets]);
