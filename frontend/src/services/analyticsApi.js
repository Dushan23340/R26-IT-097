import axios from "axios"

const ANALYTICS_BASE_URL =
  import.meta.env.VITE_ANALYTICS_API_URL || "http://127.0.0.1:8000"

const analyticsClient = axios.create({
  baseURL: ANALYTICS_BASE_URL.replace(/\/$/, ""),
  timeout: 10000,
})

async function sendEmotionEvent({
  studentId,
  emotion,
  confidence = 1.0,
  apiBaseUrl = ANALYTICS_BASE_URL,
}) {
  try {
    const response = await analyticsClient.post("/emotions", {
      student_id: studentId,
      emotion,
      timestamp: new Date().toISOString(),
      confidence,
    })
    return response.data
  } catch (error) {
    console.error("Failed to send emotion event to analytics:", error)
    throw error
  }
}

async function getAnalyticsCurrent({ apiBaseUrl = ANALYTICS_BASE_URL } = {}) {
  try {
    const response = await analyticsClient.get("/analytics/current", {
      timeout: 8000,
    })
    return response.data
  } catch (error) {
    console.error("Failed to fetch current analytics:", error)
    throw error
  }
}

async function getAnalyticsTrend({ points = 10, apiBaseUrl = ANALYTICS_BASE_URL } = {}) {
  try {
    const response = await analyticsClient.get("/analytics/trend", {
      params: { n: points },
      timeout: 8000,
    })
    return response.data
  } catch (error) {
    console.error("Failed to fetch analytics trend:", error)
    throw error
  }
}

async function getRecommendation({ apiBaseUrl = ANALYTICS_BASE_URL } = {}) {
  try {
    const response = await analyticsClient.get("/recommendation/latest", {
      timeout: 8000,
    })
    return response.data
  } catch (error) {
    console.error("Failed to fetch recommendation:", error)
    throw error
  }
}

export {
  ANALYTICS_BASE_URL,
  sendEmotionEvent,
  getAnalyticsCurrent,
  getAnalyticsTrend,
  getRecommendation,
}
