import { Lightbulb, Clock, Play, BookOpen, FileText, MousePointer, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const typeIcons = {
  video: <Play className="h-4 w-4" />,
  reading: <BookOpen className="h-4 w-4" />,
  quiz: <FileText className="h-4 w-4" />,
  interactive: <MousePointer className="h-4 w-4" />,
};

const difficultyColors = {
  easy: "bg-emotion-happy/15 text-emotion-happy border-emotion-happy/30",
  medium: "bg-emotion-confused/15 text-emotion-confused border-emotion-confused/30",
  hard: "bg-emotion-angry/15 text-emotion-angry border-emotion-angry/30",
};

export function Recommendations({ data }) {
  if (!data) return null;
  const { recommendations = [], overall_score, support_level, weak_areas_count } = data;

  // Flatten all resources with their LO
  const allResources = recommendations.flatMap((rec) =>
    (rec.recommended_resources || []).map((res) => ({
      ...res,
      learning_outcome: rec.learning_outcome,
      lo_description: rec.description,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Recommended Resources
          </h3>
          <p className="text-sm text-muted-foreground">
            {weak_areas_count} weak areas · {allResources.length} resources · {support_level}
          </p>
        </div>
      </div>

      {/* Group by Learning Outcome */}
      <div className="space-y-6">
        {recommendations.map((rec) => (
          <Card key={rec.learning_outcome} className="glass border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                  {rec.learning_outcome}
                </CardTitle>
                <Badge variant="outline" className="text-xs capitalize">
                  {rec.recommended_resources?.length || 0} resources
                </Badge>
              </div>
              <CardDescription>{rec.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(rec.recommended_resources || []).map((res) => (
                  <div
                    key={res.id}
                    className="group flex flex-col gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <span className="text-primary-foreground">
                          {typeIcons[res.type] || <BookOpen className="h-4 w-4" />}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${difficultyColors[res.difficulty] || ""}`}
                      >
                        {res.difficulty}
                      </Badge>
                    </div>

                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-1">{res.title}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{res.type}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {res.duration_min} min
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 text-emotion-happy" />
          <p className="font-medium">No recommendations needed</p>
          <p className="text-sm">You have mastered all learning outcomes!</p>
        </div>
      )}
    </div>
  );
}
