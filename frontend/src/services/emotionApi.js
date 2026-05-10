import axios from "axios"

const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_EMOTION_API_BASE_URL || "http://127.0.0.1:5001"

const apiClient = axios.create({
  baseURL: DEFAULT_API_BASE_URL.replace(/\/$/, ""),
  timeout: 15000,
})

function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const serverMessage =
      error.response?.data?.error || error.response?.data?.message || ""

    if (status && serverMessage) return `${status}: ${serverMessage}`
    if (status) return `${status}: Request failed`
    if (serverMessage) return serverMessage
    if (error.message) return error.message
  }

  return error instanceof Error ? error.message : "Unknown API error"
}

function normalizePredictResponse(payload = {}) {
  const metricsRoot = payload.metrics || payload || {}
  const emotionCounts = metricsRoot.emotionCounts || {}
  const dominantFromCounts =
    Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return {
    emotion: payload.emotion ?? null,
    rawEmotion: payload.rawEmotion ?? null,
    faceDetected: payload.emotion !== "No face detected",
    metrics: {
      emotionDuration: metricsRoot.emotionDuration || {},
      transitionRate: Number(metricsRoot.transitionRate || 0),
      stabilityScore: Number(metricsRoot.stabilityScore || 0),
      emotionCounts,
      dominantEmotion:
        metricsRoot.dominantEmotion || payload.dominantEmotion || dominantFromCounts,
      totalTransitions: Number(metricsRoot.totalTransitions || 0),
    },
  }
}

async function predictEmotion({
  image,
  studentId,
  signal,
  apiBaseUrl = DEFAULT_API_BASE_URL,
}) {
  try {
    const response = await apiClient.post(
      `${apiBaseUrl.replace(/\/$/, "")}/predict`,
      { image, studentId },
      { signal }
    )
    return normalizePredictResponse(response.data)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

async function healthCheck({ apiBaseUrl = DEFAULT_API_BASE_URL } = {}) {
  try {
    const response = await apiClient.get(`${apiBaseUrl.replace(/\/$/, "")}/health`, {
      timeout: 8000,
    })
    return response.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export { DEFAULT_API_BASE_URL, healthCheck, normalizePredictResponse, predictEmotion }
