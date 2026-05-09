import { Map, Clock, BookOpen, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const difficultyColors = {
  easy: "bg-emotion-happy/15 text-emotion-happy border-emotion-happy/30",
  medium: "bg-emotion-confused/15 text-emotion-confused border-emotion-confused/30",
  hard: "bg-emotion-angry/15 text-emotion-angry border-emotion-angry/30",
};

const resourceTypeIcons = {
  video: "🎬",
  reading: "📄",
  quiz: "📝",
  interactive: "🖱️",
};

export function AdaptivePath({ data }) {
  if (!data) return null;
  const { learning_path = [], overall_score, support_level, estimated_total_duration_min } = data;

  return (
    <div className="space-y-6">
      {/* Path Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            Your Personalized Learning Path
          </h3>
          <p className="text-sm text-muted-foreground">
            {support_level} · {learning_path.length} stages · {estimated_total_duration_min} min total
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Score: {overall_score}%
        </Badge>
      </div>

      {/* Stages Timeline */}
      <div className="relative space-y-4">
        {/* Vertical line */}
        <div className="absolute left-5 top-4 bottom-4 w-px bg-border/60 hidden sm:block" />

        {learning_path.map((stage, index) => (
          <Card key={stage.stage_number} className="glass border-border/60 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-4 p-5">
              {/* Stage Number / Indicator */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2"
                  style={{
                    borderColor: "var(--primary)",
                    background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {stage.stage_number}
                </div>
                {index < learning_path.length - 1 && (
                  <div className="h-full w-px bg-border/40 mt-2 hidden sm:block" />
                )}
              </div>

              {/* Stage Content */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-base capitalize">{stage.learning_outcome}</h4>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {stage.estimated_duration_min} min
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
                <p className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                  {stage.objective}
                </p>

                {/* Resources for this stage */}
                {stage.resources && stage.resources.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recommended Resources
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {stage.resources.map((res) => (
                        <div
                          key={res.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {resourceTypeIcons[res.type] || "📚"}
                            </span>
                            <div>
                              <p className="text-sm font-medium leading-tight">{res.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {res.duration_min} min
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${difficultyColors[res.difficulty] || ""}`}
                          >
                            {res.difficulty}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quiz Template */}
                {stage.quiz_template?.examples && stage.quiz_template.examples.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Practice Questions
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{stage.quiz_template.examples[0]}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {learning_path.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emotion-happy" />
          <p className="font-medium">All learning outcomes mastered!</p>
          <p className="text-sm">No adaptive path needed — explore enrichment activities.</p>
        </div>
      )}
    </div>
  );
}
