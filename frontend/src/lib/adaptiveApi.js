const ADAPTIVE_API_BASE = import.meta.env.VITE_ADAPTIVE_API_URL || "http://localhost:5000/api";
const NODE_API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const EMOTION_API_BASE = import.meta.env.VITE_EMOTION_API_BASE_URL || "http://localhost:8000/api";

async function parseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.trim() || response.statusText || "Request failed" };
  }
}

async function request(endpoint, options = {}, baseUrl = ADAPTIVE_API_BASE, includeAuth = false) {
  const url = `${baseUrl}${endpoint}`;
  const headers = { "Content-Type": "application/json", ...options.headers };

  // Add auth token if needed (for Node.js backend)
  if (includeAuth) {
    const token = localStorage.getItem("token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const config = {
    headers,
    ...options,
  };
  const response = await fetch(url, config);
  const data = await parseBody(response);
  if (!response.ok) {
    throw new Error(data.error || data.message || response.statusText || "Request failed");
  }
  return data;
}

const adaptiveApi = {
  get: (endpoint, baseUrl, includeAuth) => request(endpoint, { method: "GET" }, baseUrl, includeAuth),
  post: (endpoint, body, baseUrl, includeAuth) => request(endpoint, { method: "POST", body: JSON.stringify(body) }, baseUrl, includeAuth),
};

export const adaptiveApiService = {
  // Emotion detection (no auth needed)
  getCurrentEmotion: () => adaptiveApi.get("/emotions/current-emotion", EMOTION_API_BASE, false).catch(() => ({ emotion: "Normal" })),

  // Quiz endpoints (Flask backend - no auth needed)
  getUnits: () => adaptiveApi.get("/quiz/units", ADAPTIVE_API_BASE, false),
  getQuizQuestions: (unit, quizSet) => adaptiveApi.get(`/quiz/${encodeURIComponent(unit)}/${quizSet}`, ADAPTIVE_API_BASE, false),
  submitQuizAnswers: (payload) => adaptiveApi.post("/quiz/submit", payload, ADAPTIVE_API_BASE, false),
  getRecommendationResources: (payload) => adaptiveApi.post("/recommendations/get", payload, ADAPTIVE_API_BASE, false),
  getAttempt: (attemptId) => adaptiveApi.get(`/quiz/attempt/${attemptId}`, ADAPTIVE_API_BASE, false),

  // Authenticated endpoints (Node.js backend - requires auth)
  getAttempts: () => adaptiveApi.get("/adaptive/attempts", NODE_API_BASE, true),
  saveAttempt: (payload) => adaptiveApi.post("/adaptive/attempt", payload, NODE_API_BASE, true),

  // Legacy endpoints (for backward compatibility)
  health: () => adaptiveApi.get("/health", ADAPTIVE_API_BASE, false),
  getLearningOutcomes: () => adaptiveApi.get("/learning-outcomes", ADAPTIVE_API_BASE, false),
  submitQuiz: (results, studentId = "anonymous") =>
    adaptiveApi.post("/quiz/submit", { results, student_id: studentId }, ADAPTIVE_API_BASE, false),
  simulateQuiz: (studentId = "anonymous") =>
    adaptiveApi.post("/quiz/simulate", { student_id: studentId }, ADAPTIVE_API_BASE, false),
  getRecommendations: (results, studentId = "anonymous") =>
    adaptiveApi.post("/recommendations", { results, student_id: studentId }, ADAPTIVE_API_BASE, false),
  getAdaptivePath: (results, studentId = "anonymous") =>
    adaptiveApi.post("/adaptive-path", { results, student_id: studentId }, ADAPTIVE_API_BASE, false),
  getFullReport: (results, studentId = "anonymous") =>
    adaptiveApi.post("/full-report", { results, student_id: studentId }, ADAPTIVE_API_BASE, false),
  getTimeEstimate: (results, studentId = "anonymous") =>
    adaptiveApi.post("/time-estimate", { results, student_id: studentId }, ADAPTIVE_API_BASE, false),
};
