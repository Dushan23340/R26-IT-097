import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const EMOTION_BADGE_STYLES = {
  engaged: "bg-green-500/10 text-green-700 border-green-600/30",
  confused: "bg-yellow-500/10 text-yellow-700 border-yellow-600/30",
  bored: "bg-blue-500/10 text-blue-700 border-blue-600/30",
  frustrated: "bg-red-500/10 text-red-700 border-red-600/30",
  unknown: "bg-secondary text-muted-foreground border-border/60",
}

function toTone(emotion) {
  const value = (emotion || "").toLowerCase()
  if (value.includes("engaged")) return "engaged"
  if (value.includes("confused")) return "confused"
  if (value.includes("bored")) return "bored"
  if (value.includes("frustrated")) return "frustrated"
  return "unknown"
}

function EmotionStatusPanel({
  emotion,
  rawEmotion,
  dominantEmotion,
  faceDetected,
  serviceStatus,
}) {
  const tone = toTone(emotion)
  const statusClass = EMOTION_BADGE_STYLES[tone]

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Live Emotion Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Current</span>
          <Badge className={statusClass}>{emotion || "Detecting..."}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Model</span>
          <span className="font-medium">{rawEmotion || "--"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Dominant</span>
          <span className="font-medium">{dominantEmotion || "--"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Face status</span>
          <Badge
            className={
              faceDetected
                ? "bg-green-500/10 text-green-700 border-green-600/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }
          >
            {faceDetected ? "Face detected" : "No face detected"}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Service</span>
          <Badge
            className={
              serviceStatus === "connected"
                ? "bg-green-500/10 text-green-700 border-green-600/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }
          >
            {serviceStatus === "connected" ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export { EmotionStatusPanel }
