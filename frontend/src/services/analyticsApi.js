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

async function getActiveRecommendation({ apiBaseUrl = ANALYTICS_BASE_URL } = {}) {
  try {
    const response = await analyticsClient.get("/recommendation/active", {
      timeout: 8000,
    })
    return response.data
  } catch (error) {
    console.error("Failed to fetch active recommendation:", error)
    throw error
  }
}

async function setActiveRecommendation({ gameKey, apiBaseUrl = ANALYTICS_BASE_URL }) {
  try {
    const response = await analyticsClient.post("/recommendation/active", {
      game_key: gameKey,
    })
    return response.data
  } catch (error) {
    console.error("Failed to set active recommendation:", error)
    throw error
  }
}

async function joinActiveGame({ studentId, sessionId, apiBaseUrl = ANALYTICS_BASE_URL }) {
  try {
    const response = await analyticsClient.post("/recommendation/active/join", {
      student_id: studentId,
      session_id: sessionId,
    })
    return response.data
  } catch (error) {
    console.error("Failed to register game join:", error)
    throw error
  }
}

async function finishActiveGame({
  studentId,
  studentName,
  sessionId,
  outcome,
  score,
  correctCount,
  totalCount,
  durationSeconds,
  apiBaseUrl = ANALYTICS_BASE_URL,
}) {
  try {
    const response = await analyticsClient.post("/recommendation/active/finish", {
      student_id: studentId,
      student_name: studentName,
      session_id: sessionId,
      outcome,
      score,
      correct_count: correctCount,
      total_count: totalCount,
      duration_seconds: durationSeconds,
    })
    return response.data
  } catch (error) {
    console.error("Failed to report game result:", error)
    throw error
  }
}

export {
  ANALYTICS_BASE_URL,
  sendEmotionEvent,
  getAnalyticsCurrent,
  getAnalyticsTrend,
  getRecommendation,
  getActiveRecommendation,
  setActiveRecommendation,
  joinActiveGame,
  finishActiveGame,
}
