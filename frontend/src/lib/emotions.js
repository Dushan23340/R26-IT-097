const EMOTIONS = {
  happy: { label: "Happy", emoji: "\u{1F60A}", color: "var(--emotion-happy)", tone: "good" },
  engaged: { label: "Engaged", emoji: "\u{1F642}", color: "var(--emotion-engaged)", tone: "good" },
  neutral: { label: "Neutral", emoji: "\u{1F610}", color: "var(--emotion-neutral)", tone: "neutral" },
  confused: { label: "Confused", emoji: "\u{1F615}", color: "var(--emotion-confused)", tone: "warn" },
  bored: { label: "Bored", emoji: "\u{1F634}", color: "var(--emotion-bored)", tone: "warn" },
  frustrated: { label: "Frustrated", emoji: "\u{1F624}", color: "var(--emotion-frustrated)", tone: "bad" },
  angry: { label: "Angry", emoji: "\u{1F620}", color: "var(--emotion-angry)", tone: "bad" }
};
function masteryColor(pct) {
  if (pct >= 75) return "var(--emotion-happy)";
  if (pct >= 50) return "var(--emotion-confused)";
  return "var(--emotion-angry)";
}
export {
  EMOTIONS,
  masteryColor
};
