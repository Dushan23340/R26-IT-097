import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function EngagementAlerts({ alerts }) {
  const latest = alerts[0]

  return (
    <div className="space-y-3">
      {latest ? (
        <Alert className="border-yellow-600/40 bg-yellow-500/10 text-yellow-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Engagement Alert</AlertTitle>
          <AlertDescription>{latest.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!alerts.length ? (
            <p className="text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            alerts.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                {item.message}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { EngagementAlerts }
