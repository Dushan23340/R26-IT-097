import { useState } from "react"
import { toast } from "sonner"
import EmotionDetector from "@/components/EmotionDetector"
import { EmotionStatusPanel } from "@/components/emotion/EmotionStatusPanel"
import { EngagementAlerts } from "@/components/emotion/EngagementAlerts"
import { EngagementCharts } from "@/components/emotion/EngagementCharts"
import { EngagementMetricsPanel } from "@/components/emotion/EngagementMetricsPanel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEngagementBridge } from "@/hooks/useEngagementBridge"

function calculateEngagementScore({ emotion, stabilityScore, transitionRate }) {
  const emotionWeight = (() => {
    const value = (emotion || "").toLowerCase()
    if (value.includes("engaged")) return 1
    if (value.includes("confused")) return 0.6
    if (value.includes("bored")) return 0.45
    if (value.includes("frustrated")) return 0.3
    return 0.5
  })()

  const stabilityWeight = Math.max(0, Math.min(1, Number(stabilityScore || 0)))
  const transitionPenalty = Math.max(0, 1 - Number(transitionRate || 0) * 2)

  return Math.round((emotionWeight * 0.5 + stabilityWeight * 0.35 + transitionPenalty * 0.15) * 100)
}

function buildAlertMessages({ metrics, emotion, history }) {
  const alerts = []
  const now = Date.now()
  const randomSuffix = () => Math.random().toString(36).substring(2, 9)
  const dominant = (metrics.dominantEmotion || "").toLowerCase()
  const frustratedCount = Number(metrics.emotionCounts?.Frustrated || 0)
  const confusedDuration = Number(metrics.emotionDuration?.Confused || 0)
  const boredDuration = Number(metrics.emotionDuration?.Bored || 0)
  const stability = Number(metrics.stabilityScore || 0)
  const latestEmotion = (emotion || "").toLowerCase()
  const recentFrustrated = history
    .slice(-5)
    .filter((item) => (item.emotion || "").toLowerCase().includes("frustrated")).length

  if (frustratedCount >= 3 || recentFrustrated >= 3 || dominant.includes("frustrated")) {
    alerts.push({ id: `${now}-frustrated-${randomSuffix()}`, message: "Repeated frustration detected. Consider a short hint or easier task." })
  }

  if (confusedDuration >= 30 || latestEmotion.includes("confused")) {
    alerts.push({ id: `${now}-confused-${randomSuffix()}`, message: "Confusion is high. Prompt a concept recap or guided example." })
  }

  if (stability <= 0.35) {
    alerts.push({ id: `${now}-stability-${randomSuffix()}`, message: "Stability dropped. Student focus may be fluctuating quickly." })
  }

  if (boredDuration >= 45 || latestEmotion.includes("bored")) {
    alerts.push({ id: `${now}-bored-${randomSuffix()}`, message: "Boredom is lasting. Suggest interactive activity or challenge question." })
  }

  return alerts
}

function RealtimeEmotionSection({ studentId, onEngagementUpdate, hideAlerts = false }) {
  const [snapshot, setSnapshot] = useState({
    emotion: null,
    rawEmotion: null,
    dominantEmotion: null,
    faceDetected: true,
    serviceStatus: "checking",
    metrics: {
      emotionDuration: {},
      transitionRate: 0,
      stabilityScore: 0,
      emotionCounts: {},
      dominantEmotion: null,
      totalTransitions: 0,
    },
  })
  const [emotionHistory, setEmotionHistory] = useState([])
  const [alerts, setAlerts] = useState([])
  const { publishEngagement } = useEngagementBridge()

  const handleEmotionUpdate = (payload) => {
    const nextSnapshot = {
      emotion: payload.emotion,
      rawEmotion: payload.rawEmotion,
      dominantEmotion: payload.metrics?.dominantEmotion || payload.dominantEmotion || null,
      faceDetected: payload.faceDetected,
      serviceStatus: payload.serviceStatus || "connected",
      metrics: payload.metrics,
    }

    setSnapshot(nextSnapshot)

    const nextHistoryItem = {
      ts: Date.now(),
      emotion: payload.emotion,
      stabilityScore: payload.metrics?.stabilityScore || 0,
      transitionRate: payload.metrics?.transitionRate || 0,
    }

    setEmotionHistory((prev) => {
      return [...prev, nextHistoryItem].slice(-24)
    })

    const nextHistory = [...emotionHistory, nextHistoryItem].slice(-24)
    const newAlerts = buildAlertMessages({
      metrics: payload.metrics || {},
      emotion: payload.emotion,
      history: nextHistory,
    })

    if (newAlerts.length) {
      if (!hideAlerts) {
        newAlerts.forEach((alert) => {
          toast.warning(alert.message, { duration: 3500 })
        })
      }
      setAlerts((old) => {
        const merged = [...newAlerts, ...old]
        const seenIds = new Set()
        return merged.filter((item) => {
          if (seenIds.has(item.id)) return false
          seenIds.add(item.id)
          return true
        }).slice(0, 10)
      })
    }

    const engagementScore = calculateEngagementScore({
      emotion: nextSnapshot.emotion,
      stabilityScore: nextSnapshot.metrics.stabilityScore,
      transitionRate: nextSnapshot.metrics.transitionRate,
    })

    const bridgePayload = publishEngagement({
      engagementScore,
      dominantEmotion: nextSnapshot.dominantEmotion,
      stabilityScore: nextSnapshot.metrics.stabilityScore,
      transitionRate: nextSnapshot.metrics.transitionRate,
    })

    onEngagementUpdate?.(bridgePayload)
  }

  return (
    <section className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Real-Time Emotion Recognition</CardTitle>
        </CardHeader>
        <CardContent>
          <EmotionDetector
            className="w-full"
            studentId={studentId}
            intervalMs={2500}
            onEmotion={handleEmotionUpdate}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <EmotionStatusPanel
          emotion={snapshot.emotion}
          rawEmotion={snapshot.rawEmotion}
          dominantEmotion={snapshot.dominantEmotion}
          faceDetected={snapshot.faceDetected}
          serviceStatus={snapshot.serviceStatus}
        />
        <div className="xl:col-span-2">
          <EngagementMetricsPanel metrics={snapshot.metrics} />
        </div>
      </div>

      <EngagementCharts
        history={emotionHistory}
        emotionCounts={snapshot.metrics.emotionCounts}
      />

      {!hideAlerts && <EngagementAlerts alerts={alerts} />}
    </section>
  )
}

export { RealtimeEmotionSection }
