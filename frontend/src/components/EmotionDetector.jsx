import React, { useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import axios from "axios";

const DEFAULT_API_URL =
  import.meta.env.VITE_EMOTION_API_BASE_URL || "http://127.0.0.1:5001";

function getAxiosErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage =
      error.response?.data?.error || error.response?.data?.message || "";
    if (status) return `${status}${serverMessage ? `: ${serverMessage}` : ""}`;
    if (serverMessage) return serverMessage;
    if (error.message) return error.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

const EmotionDetector = ({
  apiBaseUrl = DEFAULT_API_URL,
  intervalMs = 2500,
  healthIntervalMs = 10000,
  enabled = true,
  onEmotion,
  className,
}) => {
  const webcamRef = useRef(null);
  const abortRef = useRef(null);
  const inFlightRef = useRef(false);

  const [emotion, setEmotion] = useState(null);
  const [rawEmotion, setRawEmotion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);
  const [serviceStatus, setServiceStatus] = useState("checking");

  const predictUrl = useMemo(() => `${apiBaseUrl.replace(/\/$/, "")}/predict`, [apiBaseUrl]);
  const healthUrl = useMemo(() => `${apiBaseUrl.replace(/\/$/, "")}/health`, [apiBaseUrl]);

  const stopInFlight = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    inFlightRef.current = false;
    setLoading(false);
  };

  const captureAndPredict = async () => {
    if (!enabled) return;
    if (!webcamRef.current) return;
    if (inFlightRef.current) return;
    if (!hasCameraAccess) return;

    const screenshot = webcamRef.current.getScreenshot();

    if (!screenshot) {
      // This commonly happens before the webcam stream is ready.
      return;
    }

    try {
      setError(null);
      stopInFlight();
      setLoading(true);
      inFlightRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await axios.post(
        predictUrl,
        { image: screenshot },
        { signal: controller.signal, timeout: 15000 }
      );

      const nextEmotion = response.data?.emotion ?? null;
      const nextRaw = response.data?.rawEmotion ?? null;

      if (nextEmotion) {
        setEmotion(nextEmotion);
        setRawEmotion(nextRaw);
        onEmotion?.({ emotion: nextEmotion, rawEmotion: nextRaw });
      }
    } catch (error) {
      // Ignore aborts (component unmount / new request)
      if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return;
      setError(getAxiosErrorMessage(error));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(captureAndPredict, intervalMs);
    return () => {
      clearInterval(interval);
      stopInFlight();
    };
  }, [enabled, intervalMs, predictUrl, hasCameraAccess]);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const response = await axios.get(healthUrl, { timeout: 8000 });
        if (cancelled) return;
        setServiceStatus(response.data?.status === "ok" ? "connected" : "disconnected");
      } catch {
        if (cancelled) return;
        setServiceStatus("disconnected");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, healthIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [healthUrl, healthIntervalMs]);

  const statusText =
    serviceStatus === "connected"
      ? "AI service connected"
      : serviceStatus === "disconnected"
        ? "AI service disconnected"
        : "Checking AI service...";

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
              setHasCameraAccess(true);
              setError(null);
            }}
            onUserMediaError={() => {
              setHasCameraAccess(false);
              setError("Camera access denied or unavailable.");
            }}
            videoConstraints={{ facingMode: "user" }}
            className="w-full h-auto"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">
              {emotion ?? "Detecting..."}
              {loading ? " (updating)" : ""}
            </div>
            {rawEmotion ? (
              <div className="text-xs text-muted-foreground">Model: {rawEmotion}</div>
            ) : null}
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
  );
};

export default EmotionDetector;