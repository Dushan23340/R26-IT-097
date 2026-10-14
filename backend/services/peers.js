// Addresses of the other platform services, as seen from this one (the
// account service). Defaults match scripts/start-all.sh; each can be
// overridden in .env.
export const PEERS = {
  emotionService: { name: "Emotion recognition", owner: "IT22140784", url: () => process.env.EMOTION_SERVICE_URL || "http://127.0.0.1:5002", health: "/health" },
  adaptive: { name: "Adaptive learning", owner: "IT22186492", url: () => process.env.ADAPTIVE_SERVICE_URL || "http://127.0.0.1:5005", health: "/api/health" },
  analytics: { name: "Progress analytics", owner: "IT22197146", url: () => process.env.ANALYTICS_SERVICE_URL || "http://127.0.0.1:5010", health: "/health" },
  classEmotion: { name: "Class emotion & games", owner: "IT22242754", url: () => process.env.CLASS_EMOTION_SERVICE_URL || "http://127.0.0.1:8000", health: "/health" },
  objectStorage: { name: "Object storage (MinIO)", owner: "Shared", url: () => process.env.MINIO_URL || "http://127.0.0.1:9000", health: "/minio/health/live" },
};

export function internalHeaders() {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  return token ? { "X-Internal-Token": token } : {};
}

// fetch() with a timeout; never throws - returns { ok, status, ms, body, error }.
export async function probe(url, { method = "GET", headers = {}, timeoutMs = 4000, json = true } = {}) {
  const started = performance.now();
  try {
    const response = await fetch(url, { method, headers, signal: AbortSignal.timeout(timeoutMs) });
    const ms = Math.round(performance.now() - started);
    let body = null;
    if (json) {
      const text = await response.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
    }
    return { ok: response.ok, status: response.status, ms, body };
  } catch (error) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - started), body: null, error: error.name === "TimeoutError" ? "Timed out" : "Not reachable" };
  }
}
