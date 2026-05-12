import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2 } from "lucide-react";

const bloomColors = {
  Remembering: { bg: "bg-chart-1/10", text: "text-chart-1", bar: "bg-chart-1" },
  Understanding: { bg: "bg-chart-2/10", text: "text-chart-2", bar: "bg-chart-2" },
  Applying: { bg: "bg-chart-3/10", text: "text-chart-3", bar: "bg-chart-3" },
  Analyzing: { bg: "bg-emotion-confused/10", text: "text-emotion-confused", bar: "bg-emotion-confused" },
  Evaluating: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
  Creating: { bg: "bg-emotion-angry/10", text: "text-emotion-angry", bar: "bg-emotion-angry" },
};

export default function FinalReport({
  q1Results,
  q2Results,
  unit,
  onContinuePath,
}) {
  const q1Score = q1Results.percentageScore;
  const q2Score = q2Results.percentageScore;
  const improvement = q2Score - q1Score;

  const q1FailedLevels = q1Results.failedLevels || [];
  const q2FailedLevels = q2Results.failedLevels || [];
  const newlyMastered = q1FailedLevels.filter(level => !q2FailedLevels.includes(level));

  // Determine next steps
  let nextSteps = [];
  if (improvement >= 15) {
    nextSteps.push(`🎉 Target achieved! You improved by ${Math.round(improvement)}%.`);
  }
  if (q2FailedLevels.length > 0) {
    nextSteps.push(`📚 Still working on: ${q2FailedLevels.join(", ")}. Consider scheduling time with your teacher.`);
  } else {
    nextSteps.push("✨ Excellent! You've mastered all Bloom levels for this unit.");
  }

  // ✅ Handle redirect to adaptive path
  const handleContinuePath = () => {
    if (onContinuePath) onContinuePath();
    window.location.href = "http://localhost:3002/adaptive";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Progress Report</h2>
        <p className="text-muted-foreground">
          Assessment Quiz (Q1) vs Evaluation Quiz (Q2) — {unit}
        </p>
      </div>

      {/* Score Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Q1 Score */}
        <div className="glass border-border/60 rounded-2xl p-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">Assessment (Q1)</p>
          <p className="font-display text-3xl font-bold mb-1">{Math.round(q1Score)}%</p>
          <p className="text-xs text-muted-foreground">
            {q1Results.totalCorrect}/{q1Results.totalQuestions}
          </p>
        </div>

        {/* Improvement */}
        <div className="glass border-border/60 rounded-2xl p-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">Change</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            {improvement > 0 ? (
              <TrendingUp className="h-6 w-6 text-emotion-happy" />
            ) : improvement < 0 ? (
              <TrendingDown className="h-6 w-6 text-destructive" />
            ) : (
              <Minus className="h-6 w-6 text-muted-foreground" />
            )}
            <span
              className={`font-display text-3xl font-bold ${
                improvement > 0
                  ? "text-emotion-happy"
                  : improvement < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {improvement > 0 ? "+" : ""}{Math.round(improvement)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {improvement > 0 ? "Improvement" : improvement < 0 ? "Decline" : "No change"}
          </p>
        </div>

        {/* Q2 Score */}
        <div className="glass border-border/60 rounded-2xl p-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">Evaluation (Q2)</p>
          <p className="font-display text-3xl font-bold mb-1">{Math.round(q2Score)}%</p>
          <p className="text-xs text-muted-foreground">
            {q2Results.totalCorrect}/{q2Results.totalQuestions}
          </p>
        </div>
      </div>

      {/* Bloom Level Comparison */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">Bloom's Taxonomy Comparison</h3>
        {Object.keys(q1Results.bloomResults).map((level) => {
          const colors = bloomColors[level] || {};
          const q1Data = q1Results.bloomResults[level];
          const q2Data = q2Results.bloomResults[level];

          if (q1Data.total === 0) return null;

          const q1Pct = (q1Data.correct / q1Data.total) * 100;
          const q2Pct = (q2Data.correct / q2Data.total) * 100;

          return (
            <div key={level} className={`glass border-border/60 rounded-xl p-4 space-y-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold ${colors.text}`}>{level}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {q1Data.correct}/{q1Data.total} → {q2Data.correct}/{q2Data.total}
                  </span>
                  {q2Pct > q1Pct && <TrendingUp className="h-4 w-4 text-emotion-happy" />}
                  {q2Pct < q1Pct && <TrendingDown className="h-4 w-4 text-destructive" />}
                  {q2Pct === q1Pct && <Minus className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Bars */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Assessment</p>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-chart-1 h-full rounded-full transition-all"
                      style={{ width: `${q1Pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground">{Math.round(q1Pct)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Evaluation</p>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${q2Pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground">{Math.round(q2Pct)}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Achievement Section */}
      {newlyMastered.length > 0 && (
        <div className="glass border-2 border-emotion-happy/30 bg-emotion-happy/5 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emotion-happy" />
            <h3 className="font-semibold text-emotion-happy">Newly Mastered</h3>
          </div>
          <p className="text-sm">
            Congratulations! You've mastered:{" "}
            <span className="font-semibold">{newlyMastered.join(", ")}</span>
          </p>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">What's Next?</h3>
        {q2FailedLevels.length > 0 && (
          <div className="glass border-2 border-accent/30 bg-accent/5 rounded-2xl p-6 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-accent mb-1">Recommendation</h4>
                <p className="text-sm">
                  Meet with your teacher to clarify:{" "}
                  <span className="font-semibold">{q2FailedLevels.join(", ")}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {nextSteps.map((step, idx) => (
          <div key={idx} className="glass border-border/60 rounded-xl p-4">
            <p className="text-sm">{step}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleContinuePath}   // ✅ updated handler
          size="lg"
          className="gap-2"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          Continue Learning Path
        </Button>
      </div>
    </div>
  );
}