import { Button } from "@/components/ui/button";
import { Brain, Divide, Percent } from "lucide-react";

const units = [
  { id: "Number Patterns", label: "Number Patterns", icon: Brain, color: "text-chart-1" },
  { id: "Fractions", label: "Fractions", icon: Divide, color: "text-chart-2" },
  { id: "Percentages", label: "Percentages", icon: Percent, color: "text-chart-3" },
];

const emotions = [
  { id: "Happy", label: "Happy", emoji: "😊", className: "border-emotion-happy text-emotion-happy" },
  { id: "Normal", label: "Normal", emoji: "😐", className: "border-emotion-neutral text-emotion-neutral" },
  { id: "Confused", label: "Confused", emoji: "😕", className: "border-emotion-confused text-emotion-confused" },
  { id: "Bored", label: "Bored", emoji: "😒", className: "border-emotion-bored text-emotion-bored" },
  { id: "Frustrated", label: "Frustrated", emoji: "😤", className: "border-emotion-frustrated text-emotion-frustrated" },
  { id: "Angry", label: "Angry", emoji: "😠", className: "border-emotion-angry text-emotion-angry" },
];

export default function Setup({
  selectedUnit,
  setSelectedUnit,
  selectedEmotion,
  setSelectedEmotion,
  onStart,
  attempts = [],
}) {
  const canStart = selectedUnit && selectedEmotion;
  const totalAttempts = attempts.length;
  const averageScore = totalAttempts
    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percentageScore || 0), 0) / totalAttempts)
    : 0;
  const recentAttempts = attempts.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Unit Selection */}
      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold">Select Topic</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {units.map((unit) => {
            const Icon = unit.icon;
            const isSelected = selectedUnit === unit.id;
            return (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit.id)}
                className={`glass border-2 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-[0_0_0_8px_rgba(56,189,248,0.12)]"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <Icon className={`h-8 w-8 ${unit.color}`} />
                <span className="font-semibold text-sm">{unit.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Emotion Selection */}
      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold">How do you feel?</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {emotions.map((emotion) => {
            const isSelected = selectedEmotion === emotion.id;
            return (
              <button
                key={emotion.id}
                onClick={() => setSelectedEmotion(emotion.id)}
                className={`glass border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all text-center text-xs font-medium ${
                  isSelected
                    ? `border-2 ${emotion.className} bg-primary/5 ring-2 ring-primary/30 shadow-[0_0_0_6px_rgba(56,189,248,0.10)]`
                    : "border-border/60 hover:border-border"
                }`}
              >
                <span className="text-2xl">{emotion.emoji}</span>
                <span>{emotion.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={onStart}
          disabled={!canStart}
          size="lg"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          Start Assessment →
        </Button>
      </div>

      {/* Analytics Dashboard */}
      <div className="glass border-border/60 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg">Quiz Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Review quizzes you have attempted and your recent progress.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total quizzes</p>
            <p className="font-semibold text-2xl">{totalAttempts}</p>
          </div>
        </div>

        {totalAttempts === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/5 p-4 text-sm text-muted-foreground">
            No quiz attempts yet. Complete an assessment to track your progress.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Average score</p>
                <p className="font-semibold text-2xl">{averageScore}%</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Latest score</p>
                <p className="font-semibold text-2xl">{recentAttempts[0]?.percentageScore ?? 0}%</p>
              </div>
            </div>

            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt._id || `${attempt.unit}-${attempt.quizSet}-${attempt.createdAt}`}
                  className="rounded-2xl border border-border/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{attempt.unit} — {attempt.quizSet}</p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.emotion} • {new Date(attempt.completedAt || attempt.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{Math.round(attempt.percentageScore)}%</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.round(attempt.percentageScore)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
