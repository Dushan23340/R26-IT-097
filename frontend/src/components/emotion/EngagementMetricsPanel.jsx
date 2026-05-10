import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function toReadableDuration(durationMap = {}) {
  const entries = Object.entries(durationMap)
  if (!entries.length) return "No duration data yet"
  return entries
    .slice(0, 3)
    .map(([emotion, seconds]) => `${emotion}: ${Number(seconds).toFixed(1)}s`)
    .join(" | ")
}

function EngagementMetricsPanel({ metrics }) {
  const cards = [
    {
      label: "Transition Rate",
      value: Number(metrics.transitionRate || 0).toFixed(3),
      helper: "transitions/sec",
    },
    {
      label: "Stability Score",
      value: Number(metrics.stabilityScore || 0).toFixed(2),
      helper: "0 to 1",
    },
    {
      label: "Dominant Emotion",
      value: metrics.dominantEmotion || "--",
      helper: "most frequent",
    },
    {
      label: "Total Transitions",
      value: String(metrics.totalTransitions || 0),
      helper: "emotion switches",
    },
  ]

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Live Engagement Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-semibold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">Emotion Duration</p>
          <p className="text-sm font-medium">{toReadableDuration(metrics.emotionDuration)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export { EngagementMetricsPanel }
