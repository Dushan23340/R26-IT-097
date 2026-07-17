import React, { useEffect, useMemo, useRef, useState } from "react"
import Webcam from "react-webcam"
import { DEFAULT_API_BASE_URL, healthCheck, predictEmotion } from "@/services/emotionApi"

const EMPTY_METRICS = {
  emotionDuration: {},
  transitionRate: 0,
  stabilityScore: 0,
  emotionCounts: {},
  dominantEmotion: null,
  totalTransitions: 0,
}

const EmotionDetector = ({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  intervalMs = 2500,
  healthIntervalMs = 10000,
  enabled = true,
  studentId = "default_student",
  onEmotion,
  className,
}) => {
  const webcamRef = useRef(null)
  const abortRef = useRef(null)
  const inFlightRef = useRef(false)
  const apiConfig = useMemo(() => ({ apiBaseUrl }), [apiBaseUrl])

  const [emotion, setEmotion] = useState(null)
  const [rawEmotion, setRawEmotion] = useState(null)
  const [dominantEmotion, setDominantEmotion] = useState(null)
  const [faceDetected, setFaceDetected] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasCameraAccess, setHasCameraAccess] = useState(true)
  const [serviceStatus, setServiceStatus] = useState("checking")

  const stopInFlight = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    inFlightRef.current = false
    setLoading(false)
  }

  const captureAndPredict = async () => {
    if (!enabled || !webcamRef.current || inFlightRef.current || !hasCameraAccess) return

    const screenshot = webcamRef.current.getScreenshot()
    if (!screenshot) return

    try {
      setError(null)
      stopInFlight()
      setLoading(true)
      inFlightRef.current = true
      const controller = new AbortController()
      abortRef.current = controller

      const prediction = await predictEmotion({
        ...apiConfig,
        image: screenshot,
        studentId,
        signal: controller.signal,
      })

      const studentState = prediction.studentState ?? prediction.emotion
      const facialEmotion = prediction.facialEmotion ?? prediction.rawEmotion

      setEmotion(studentState)
      setRawEmotion(facialEmotion)
      setDominantEmotion(prediction.metrics?.dominantEmotion || null)
      setFaceDetected(prediction.faceDetected)
      setServiceStatus("connected")

      onEmotion?.({ ...prediction, emotion: studentState, rawEmotion: facialEmotion, serviceStatus: "connected" })
    } catch (requestError) {
      const isAbort =
        requestError instanceof DOMException && requestError.name === "AbortError"
      if (isAbort) return

      setError(requestError.message || "Failed to detect emotion")
      setServiceStatus("disconnected")
      onEmotion?.({
        emotion: null,
        rawEmotion: null,
        faceDetected: false,
        metrics: EMPTY_METRICS,
        serviceStatus: "disconnected",
      })
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(captureAndPredict, intervalMs)
    return () => {
      clearInterval(interval)
      stopInFlight()
    }
  }, [enabled, intervalMs, hasCameraAccess, studentId, apiBaseUrl])

  useEffect(() => {
    let cancelled = false

    const checkHealth = async () => {
      try {
        const response = await healthCheck(apiConfig)
        if (cancelled) return
        setServiceStatus(response?.status === "ok" ? "connected" : "disconnected")
      } catch {
        if (cancelled) return
        setServiceStatus("disconnected")
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, healthIntervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [healthIntervalMs, apiBaseUrl])

  const statusText =
    serviceStatus === "connected"
      ? "AI service connected"
      : serviceStatus === "disconnected"
        ? "AI service disconnected"
        : "Checking AI service..."

  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Emotion AI</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              serviceStatus === "connected"
                ? "bg-green-500/15 text-green-700"
                : serviceStatus === "disconnected"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                serviceStatus === "connected"
                  ? "bg-green-600"
                  : serviceStatus === "disconnected"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
              }`}
            />
            {statusText}
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-border/60 bg-secondary/20">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.6}
            onUserMedia={() => {
              setHasCameraAccess(true)
              setError(null)
            }}
            onUserMediaError={() => {
              setHasCameraAccess(false)
              setError("Camera access denied or unavailable.")
            }}
            videoConstraints={{ facingMode: "user" }}
            className="w-full h-auto"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">Student state</div>
            <div className="text-xs text-muted-foreground mb-2">
              {emotion ?? "Detecting..."}
            </div>
            <div className="font-semibold">Facial emotion</div>
            {rawEmotion ? (
              <div className="text-xs text-muted-foreground">
                {rawEmotion} {dominantEmotion ? `| Dominant: ${dominantEmotion}` : ""}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">--</div>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              {faceDetected ? "Face detected" : "No face detected"}
            </div>
          </div>

          <button
            type="button"
            onClick={captureAndPredict}
            disabled={!enabled || !hasCameraAccess || loading}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-border/60 hover:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div className="text-xs rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-3 py-2">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default EmotionDetector