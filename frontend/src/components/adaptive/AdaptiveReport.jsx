import { useState } from "react";
import {
  BarChart3,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const loColors = {
  remember: "#4ade80",
  understand: "#60a5fa",
  apply: "#fbbf24",
  analyze: "#f87171",
  evaluate: "#c084fc",
  create: "#fb923c",
};

export function AdaptiveReport({ data }) {
  if (!data) return null;
  const { summary, weak_areas, strengths, adaptive_learning_path, time_estimate, next_actions } = data;
  const [activeTab, setActiveTab] = useState("overview");

  const { overall_score, total_los, mastered, needs_work, support_level, support_description } = summary;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
            <p className="text-2xl font-display font-bold mt-1">{overall_score}%</p>
            <Progress value={overall_score} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card className="glass border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Mastered</p>
            <p className="text-2xl font-display font-bold mt-1 text-emotion-happy">{mastered}</p>
            <p className="text-xs text-muted-foreground mt-1">of {total_los} outcomes</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Needs Work</p>
            <p className="text-2xl font-display font-bold mt-1 text-destructive">{needs_work}</p>
            <p className="text-xs text-muted-foreground mt-1">areas to improve</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/60">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Time</p>
            <p className="text-2xl font-display font-bold mt-1">{time_estimate?.total_hours}h</p>
            <p className="text-xs text-muted-foreground mt-1">{time_estimate?.sessions_estimated} sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Banner */}
      <div
        className="rounded-xl p-4 border flex items-start gap-3"
        style={{
          borderColor: needs_work > 2 ? "var(--destructive)" : "var(--primary)",
          background: needs_work > 2
            ? "color-mix(in oklab, var(--destructive) 8%, transparent)"
            : "color-mix(in oklab, var(--primary) 8%, transparent)",
        }}
      >
        <Target className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: needs_work > 2 ? "var(--destructive)" : "var(--primary)" }} />
        <div>
          <p className="font-semibold text-sm">{support_level}</p>
          <p className="text-xs text-muted-foreground">{support_description}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass border-border/60">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="weak" className="text-xs">Weak Areas</TabsTrigger>
          <TabsTrigger value="strengths" className="text-xs">Strengths</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">Progress</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card className="glass border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Next Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {next_actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: "var(--primary)" }}
                    />
                    {action}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Time Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {time_estimate?.per_lo && Object.entries(time_estimate.per_lo).map(([lo, mins]) => {
                  const maxMins = Math.max(...Object.values(time_estimate.per_lo));
                  const pct = (mins / maxMins) * 100;
                  return (
                    <div key={lo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="capitalize font-medium">{lo}</span>
                        <span className="text-muted-foreground">{mins} min</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: loColors[lo] || "var(--primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weak Areas Tab */}
        <TabsContent value="weak" className="space-y-4 mt-4">
          {weak_areas.map((area) => (
            <Card key={area.learning_outcome} className="glass border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{area.learning_outcome}</CardTitle>
                  <Badge variant="destructive" className="text-xs">Needs Practice</Badge>
                </div>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Recommended Resources
                </p>
                <div className="space-y-2">
                  {(area.recommended_resources || []).map((res) => (
                    <div
                      key={res.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/40"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{res.title}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {res.type} · {res.duration_min}m
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {weak_areas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emotion-happy" />
              <p>No weak areas — you are mastering all outcomes!</p>
            </div>
          )}
        </TabsContent>

        {/* Strengths Tab */}
        <TabsContent value="strengths" className="space-y-4 mt-4">
          {strengths.map((s) => (
            <Card key={s.learning_outcome} className="glass border-border/60 border-emotion-happy/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emotion-happy" />
                    {s.learning_outcome}
                  </CardTitle>
                  <Badge className="bg-emotion-happy text-background text-xs">Mastered</Badge>
                </div>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
          {strengths.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-emotion-confused" />
              <p>No mastered areas yet — keep studying!</p>
            </div>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4 mt-4">
          <Card className="glass border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Learning Path Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(adaptive_learning_path?.learning_path || []).map((stage, idx) => {
                  const isCompleted = false; // Would come from actual progress tracking
                  const totalStages = adaptive_learning_path?.learning_path?.length || 1;
                  const progressPct = ((idx + 1) / totalStages) * 100;
                  return (
                    <div key={stage.stage_number} className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 text-center">
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-emotion-happy mx-auto" />
                        ) : (
                          <div
                            className="h-5 w-5 rounded-full border-2 mx-auto"
                            style={{ borderColor: "var(--primary)" }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize font-medium">{stage.learning_outcome}</span>
                          <span className="text-xs text-muted-foreground">
                            {stage.estimated_duration_min} min
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPct}%`,
                              background: "var(--gradient-primary)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {adaptive_learning_path?.enrichment_activities?.length > 0 && (
            <Card className="glass border-border/60 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Enrichment Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {adaptive_learning_path.enrichment_activities.map((activity, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      {activity.activity}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
