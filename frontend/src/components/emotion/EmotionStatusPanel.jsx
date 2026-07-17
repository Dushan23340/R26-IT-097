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
  studentState,
  rawEmotion,
  facialEmotion,
  dominantEmotion,
  faceDetected,
  serviceStatus,
}) {
  const currentState = studentState ?? emotion
  const currentFacial = facialEmotion ?? rawEmotion
  const tone = toTone(currentState)
  const statusClass = EMOTION_BADGE_STYLES[tone]

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Live Emotion Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 p-3 bg-secondary/50">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Student State</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{currentState || "Detecting..."}</span>
              <Badge className={statusClass}>{currentState || "Unknown"}</Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 p-3 bg-secondary/50">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Facial Emotion</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{currentFacial || "--"}</span>
            </div>
          </div>
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
