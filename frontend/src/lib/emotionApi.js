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

  generateRecommendation: (emotion, subject = "General", lessonId = "") =>
    request(
      `/recommendation/generate?emotion=${encodeURIComponent(emotion)}&subject=${encodeURIComponent(subject)}` +
        (lessonId ? `&lesson_id=${encodeURIComponent(lessonId)}` : "")
    ),

  getLatestRecommendation: () => request("/recommendation/latest"),
  getActiveRecommendation: () => request("/recommendation/active"),
  setActiveRecommendation: (gameKey) =>
    request("/recommendation/active", {
      method: "POST",
      body: JSON.stringify({ game_key: gameKey }),
    }),
  endActiveRecommendation: () =>
    request("/recommendation/active/end", { method: "POST" }),
  getActiveStats: () => request("/recommendation/active/stats"),
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

  // Real live-class broadcast (distinct from the game broadcast above) -
  // teacher starts/ends, students poll + join.
  getClassSessionState: () => request("/class-session/state"),
  // lessonId: a real adaptive-learning lesson_id (e.g. "fractions-bodmas").
  // Optional - a class started without one just skips lesson-completion
  // gating entirely, same as before this existed.
  startClassSession: (subject, startedBy, lessonId) =>
    request("/class-session/start", {
      method: "POST",
      body: JSON.stringify({ subject, started_by: startedBy, lesson_id: lessonId }),
    }),
  endClassSession: () => request("/class-session/end", { method: "POST" }),
  joinClassSession: (studentId, sessionId, studentName) =>
    request("/class-session/join", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, session_id: sessionId, student_name: studentName }),
    }),
  getClassSessionStudents: () => request("/class-session/students"),

  // Real "Start Quiz" broadcast (Teacher Console Quick Actions) - teacher
  // picks a real lesson, students poll and get prompted to jump into it.
  getQuizBroadcastState: () => request("/quiz-broadcast/state"),
  startQuizBroadcast: (lessonId, lessonTitle, startedBy) =>
    request("/quiz-broadcast/start", {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, lesson_title: lessonTitle, started_by: startedBy }),
    }),
  endQuizBroadcast: () => request("/quiz-broadcast/end", { method: "POST" }),

  // Real "Send Message" broadcast (Teacher Console Quick Actions).
  getMessageBroadcastState: () => request("/message-broadcast/state"),
  sendMessageBroadcast: (message, sentBy) =>
    request("/message-broadcast/send", {
      method: "POST",
      body: JSON.stringify({ message, sent_by: sentBy }),
    }),
  clearMessageBroadcast: () => request("/message-broadcast/clear", { method: "POST" }),
};
