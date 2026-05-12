import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, BookOpen, ClipboardList, MousePointer, ExternalLink, Lock, ChevronRight, Loader2 } from "lucide-react";

const resourceIcons = {
  video: <Play className="h-4 w-4" />,
  reading: <BookOpen className="h-4 w-4" />,
  quiz: <ClipboardList className="h-4 w-4" />,
  interactive: <MousePointer className="h-4 w-4" />,
};

const bloomColors = {
  Remembering: { bg: "bg-chart-1/10", border: "border-chart-1/30", text: "text-chart-1", badge: "bg-chart-1/20 text-chart-1 border-chart-1/30" },
  Understanding: { bg: "bg-chart-2/10", border: "border-chart-2/30", text: "text-chart-2", badge: "bg-chart-2/20 text-chart-2 border-chart-2/30" },
  Applying: { bg: "bg-chart-3/10", border: "border-chart-3/30", text: "text-chart-3", badge: "bg-chart-3/20 text-chart-3 border-chart-3/30" },
  Analyzing: { bg: "bg-emotion-confused/10", border: "border-emotion-confused/30", text: "text-emotion-confused", badge: "bg-emotion-confused/20 text-emotion-confused border-emotion-confused/30" },
  Evaluating: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", badge: "bg-accent/20 text-accent border-accent/30" },
  Creating: { bg: "bg-emotion-angry/10", border: "border-emotion-angry/30", text: "text-emotion-angry", badge: "bg-emotion-angry/20 text-emotion-angry border-emotion-angry/30" },
};

export default function Recommendations({
  recommendations,
  unit,
  emotion,
  onProceed,
}) {
  const recArray = recommendations.recommendations || [];
  const [completedResources, setCompletedResources] = useState(new Set());

  const toggleResource = (bloomLevel, resourceId) => {
    const newCompleted = new Set(completedResources);
    const key = `${bloomLevel}-${resourceId}`;
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }
    setCompletedResources(newCompleted);
  };

  // Count total resources and completed
  const totalResources = recArray.reduce((sum, rec) => sum + (rec.resources?.length || 0), 0);
  const completedCount = completedResources.size;
  const allCompleted = totalResources > 0 && completedCount === totalResources;

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Your Learning Path</h2>
          <span className="text-sm text-muted-foreground">
            {completedCount} of {totalResources} activities complete
          </span>
        </div>
        <Progress value={(completedCount / totalResources) * 100} className="h-2" />
      </div>

      {/* Resource Cards */}
      <div className="space-y-6">
        {recArray.map((rec) => {
          const colors = bloomColors[rec.bloomLevel] || {};
          const resources = rec.resources || [];

          return (
            <div key={rec.bloomLevel} className={`glass border-2 rounded-2xl p-6 ${colors.bg} ${colors.border}`}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <Badge className={colors.badge}>{rec.bloomLevel}</Badge>
                <Badge variant="outline" className="text-xs">{emotion}</Badge>
              </div>

              {/* Resources Grid */}
              <div className="space-y-3">
                {resources.map((resource) => {
                  const resourceKey = `${rec.bloomLevel}-${resource.id}`;
                  const isCompleted = completedResources.has(resourceKey);

                  return (
                    <div
                      key={resource.id}
                      className={`glass border border-border/60 rounded-xl p-4 transition-all ${
                        isCompleted ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => toggleResource(rec.bloomLevel, resource.id)}
                            className="h-5 w-5"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-muted-foreground flex-shrink-0">
                              {resourceIcons[resource.type] || resourceIcons.reading}
                            </span>
                            <h4
                              className={`font-semibold text-sm ${
                                isCompleted ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {resource.title}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {resource.notes}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">
                              {resource.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {resource.duration_min} min
                            </Badge>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={onProceed}
          disabled={!allCompleted}
          size="lg"
          className="gap-2"
          style={
            allCompleted
              ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }
              : {}
          }
        >
          {!allCompleted && <Lock className="h-4 w-4" />}
          Take Evaluation Quiz <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper Text */}
      {!allCompleted && (
        <p className="text-xs text-muted-foreground text-center">
          Check off all activities to unlock the evaluation quiz
        </p>
      )}
    </div>
  );
}
