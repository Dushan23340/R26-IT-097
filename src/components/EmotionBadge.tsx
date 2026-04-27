import { EMOTIONS, type EmotionKey } from "@/lib/emotions";

interface Props {
  emotion: EmotionKey;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}

export function EmotionBadge({ emotion, pulse = false, size = "md" }: Props) {
  const e = EMOTIONS[emotion];
  const sizing = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${sizing} ${pulse ? "animate-pulse-ring" : ""}`}
      style={{
        backgroundColor: `color-mix(in oklab, ${e.color} 18%, transparent)`,
        color: e.color,
        borderColor: `color-mix(in oklab, ${e.color} 35%, transparent)`,
        ["--ring-color" as string]: e.color,
      }}
    >
      <span aria-hidden>{e.emoji}</span>
      <span>{e.label}</span>
    </span>
  );
}
