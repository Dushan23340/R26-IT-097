import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function EngagementCharts({ history = [], emotionCounts = {} }) {
  const stabilityData = history.map((item, index) => ({
    index: index + 1,
    stability: Number(item.stabilityScore || 0),
  }))

  const emotionFrequencyData = Object.entries(emotionCounts).map(([emotion, count]) => ({
    emotion,
    count,
  }))

  const transitionData = history.map((item, index) => ({
    index: index + 1,
    transitions: Number(item.transitionRate || 0),
  }))

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Stability Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[220px] w-full"
            config={{ stability: { label: "Stability", color: "hsl(var(--primary))" } }}
          >
            <LineChart data={stabilityData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="index" />
              <YAxis domain={[0, 1]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="stability" type="monotone" stroke="var(--color-stability)" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Emotion Frequency</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[220px] w-full"
            config={{ count: { label: "Count", color: "#3b82f6" } }}
          >
            <BarChart data={emotionFrequencyData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="emotion" />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Transition Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[220px] w-full"
            config={{ transitions: { label: "Transitions", color: "#ef4444" } }}
          >
            <LineChart data={transitionData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="index" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="transitions"
                type="monotone"
                stroke="var(--color-transitions)"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

export { EngagementCharts }
