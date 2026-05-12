import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const bloomColors = {
  Remembering: { bg: "bg-chart-1/10", border: "border-chart-1/30", text: "text-chart-1", dot: "bg-chart-1" },
  Understanding: { bg: "bg-chart-2/10", border: "border-chart-2/30", text: "text-chart-2", dot: "bg-chart-2" },
  Applying: { bg: "bg-chart-3/10", border: "border-chart-3/30", text: "text-chart-3", dot: "bg-chart-3" },
  Analyzing: { bg: "bg-emotion-confused/10", border: "border-emotion-confused/30", text: "text-emotion-confused", dot: "bg-emotion-confused" },
  Evaluating: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", dot: "bg-accent" },
  Creating: { bg: "bg-emotion-angry/10", border: "border-emotion-angry/30", text: "text-emotion-angry", dot: "bg-emotion-angry" },
};

const emotionMessages = {
  Happy: "Great energy! Let's see what we can strengthen.",
  Normal: "You're progressing well. Let's build on this.",
  Confused: "It's normal to feel uncertain. We'll build a clear path for you.",
  Bored: "Let's challenge ourselves with advanced concepts.",
  Frustrated: "Take a breath. The recommendations below are designed just for your needs.",
  Angry: "Let's take a focused approach to build confidence.",
};

export default function Results({
  results,
  unit,
  emotion,
  failedLevels,
  onProceed,
  loading,
  onViewRecommendations,
}) {
  const { bloomResults, totalCorrect, totalQuestions, percentageScore, passedLevels } = results;

  const statCards = [
    { label: "Score", value: `${totalCorrect}/${totalQuestions}` },
    { label: "Percentage", value: `${Math.round(percentageScore)}%` },
    { label: "Levels Passed", value: `${passedLevels.length}/6` },
  ];

  const handleProceed = () => {
    if (failedLevels.length > 0 && onViewRecommendations) {
      onViewRecommendations();
    } else {
      onProceed();
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="glass border-border/60 rounded-2xl p-6 text-center"
          >
            <p className="text-sm text-muted-foreground mb-2">{card.label}</p>
            <p className="font-display text-3xl font-bold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Bloom Level Breakdown */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">Bloom's Taxonomy Breakdown</h3>
        {Object.entries(bloomResults).map(([level, result]) => {
          if (result.total === 0) return null;
          const colors = bloomColors[level] || {};
          const percentage = (result.correct / result.total) * 100;
          const isPassed = result.passed;

          return (
            <div key={level} className={`glass border-2 rounded-xl p-4 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                <span className={`font-semibold ${colors.text}`}>{level}</span>
                <div className="ml-auto">
                  {isPassed ? (
                    <Badge className="gap-1 bg-emotion-happy/20 text-emotion-happy border-emotion-happy/30">
                      <CheckCircle2 className="h-3 w-3" />
                      Passed
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-destructive/20 text-destructive border-destructive/30">
                      <AlertCircle className="h-3 w-3" />
                      Needs Help
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={percentage} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {result.correct}/{result.total} correct
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Emotion Acknowledgment */}
      {emotion && (
        <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-4 text-center text-sm">
          <p className="text-muted-foreground">{emotionMessages[emotion] || emotionMessages.Normal}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleProceed}
          disabled={loading}
          size="lg"
          className="gap-2"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {failedLevels.length === 0 ? "Take Evaluation Quiz" : "View My Learning Path"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
