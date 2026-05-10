const EMOTION_API_URL = import.meta.env.VITE_EMOTION_API_URL || "http://localhost:8000";

async function request(endpoint, options = {}) {
  const url = `${EMOTION_API_URL}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };
  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.detail || "Request failed");
  }
  return data;
}

export const emotionApi = {
  getCurrentAnalytics: () => request("/analytics/current"),
  getTrend: (n = 10) => request(`/analytics/trend?n=${n}`),
  getPattern: () => request("/analytics/pattern"),

  generateRecommendation: (emotion, subject = "General") =>
    request(`/recommendation/generate?emotion=${encodeURIComponent(emotion)}&subject=${encodeURIComponent(subject)}`),

  getLatestRecommendation: () => request("/recommendation/latest"),
  getRecommendationHistory: (sinceMinutes) =>
    request(`/recommendation/history${sinceMinutes ? `?since_minutes=${sinceMinutes}` : ""}`),
  getVariationWindow: () => request("/recommendation/variation-window"),
  getEffectiveness: () => request("/recommendation/effectiveness"),
  getPendingInterventions: () => request("/recommendation/pending"),

  submitFeedback: (interventionId, postEmotions) =>
    request(`/recommendation/intervention/${interventionId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ post_emotions: postEmotions }),
    }),
};
