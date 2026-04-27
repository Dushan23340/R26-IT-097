export type EmotionKey = "happy" | "neutral" | "confused" | "bored" | "frustrated" | "angry";

export const EMOTIONS: Record<EmotionKey, { label: string; emoji: string; color: string; tone: "good" | "warn" | "bad" }> = {
  happy:      { label: "Happy",      emoji: "😊", color: "var(--emotion-happy)",      tone: "good" },
  neutral:    { label: "Engaged",    emoji: "🙂", color: "var(--emotion-neutral)",    tone: "good" },
  confused:   { label: "Confused",   emoji: "😕", color: "var(--emotion-confused)",   tone: "warn" },
  bored:      { label: "Bored",      emoji: "😐", color: "var(--emotion-bored)",      tone: "warn" },
  frustrated: { label: "Frustrated", emoji: "😤", color: "var(--emotion-frustrated)", tone: "bad"  },
  angry:      { label: "Angry",      emoji: "😠", color: "var(--emotion-angry)",      tone: "bad"  },
};

export function masteryColor(pct: number) {
  if (pct >= 75) return "var(--emotion-happy)";
  if (pct >= 50) return "var(--emotion-confused)";
  return "var(--emotion-angry)";
}
