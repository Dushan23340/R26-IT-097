import { CheckCircle2, XCircle, Target, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const loColors = {
  remember: "#4ade80",
  understand: "#60a5fa",
  apply: "#fbbf24",
  analyze: "#f87171",
  evaluate: "#c084fc",
  create: "#fb923c",
};

export function QuizResults({ data }) {
  if (!data) return null;
  const {
    overall_score,
    total_los,
    mastered_count,
    weak_count,
    mastered_areas = [],
    weak_areas = [],
    support_level,
    support_description,
  } = data;

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-border/60">
          <CardHeader className="pb-2">
            <CardDescription>Overall Score</CardDescription>
            <CardTitle className="text-4xl font-display">
              {overall_score}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overall_score} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {overall_score >= 70 ? "Great job!" : overall_score >= 50 ? "Keep practicing." : "More study needed."}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/60">
          <CardHeader className="pb-2">
            <CardDescription>Mastered</CardDescription>
            <CardTitle className="text-3xl font-display text-emotion-happy">
              {mastered_count} / {total_los}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-emotion-happy">
              <TrendingUp className="h-4 w-4" />
              <span>{mastered_areas.join(", ") || "None yet"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/60">
          <CardHeader className="pb-2">
            <CardDescription>Needs Work</CardDescription>
            <CardTitle className="text-3xl font-display text-destructive">
              {weak_count} / {total_los}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-destructive">
              <TrendingDown className="h-4 w-4" />
              <span>{weak_areas.join(", ") || "None — all mastered!"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Level Banner */}
      <div
        className="rounded-xl p-4 flex items-center gap-3 border"
        style={{
          borderColor: weak_count > 2 ? "var(--destructive)" : "var(--primary)",
          background: weak_count > 2
            ? "color-mix(in oklab, var(--destructive) 10%, transparent)"
            : "color-mix(in oklab, var(--primary) 10%, transparent)",
        }}
      >
        <Zap className="h-5 w-5" style={{ color: weak_count > 2 ? "var(--destructive)" : "var(--primary)" }} />
        <div>
          <p className="font-semibold text-sm">{support_level}</p>
          <p className="text-xs text-muted-foreground">{support_description}</p>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <Card className="glass border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Learning Outcome Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from(new Set([...mastered_areas, ...weak_areas])).map((lo) => {
              const isMastered = mastered_areas.includes(lo);
              const color = loColors[lo] || "var(--primary)";
              return (
                <div
                  key={lo}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-sm font-medium capitalize">{lo}</span>
                  </div>
                  {isMastered ? (
                    <Badge variant="default" className="bg-emotion-happy text-background">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Mastered
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Weak
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
