// Shared randomization helpers for game question generators - so each game
// serves a fresh, independently-randomized set of numbers per play-through
// (per student, per replay) instead of one hardcoded set everyone sees.

export function randInt(min, max, step = 1) {
  const n = Math.floor((max - min) / step) + 1;
  return min + step * Math.floor(Math.random() * n);
}

export function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
