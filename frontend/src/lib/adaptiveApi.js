const ADAPTIVE_API_BASE = import.meta.env.VITE_ADAPTIVE_API_URL || "http://localhost:5005/api";

async function parseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.trim() || response.statusText || "Request failed" };
  }
}

async function request(endpoint, options = {}) {
  const url = `${ADAPTIVE_API_BASE}${endpoint}`;
  const config = {
    headers: { "Content-Type": "application/json", ...options.headers },
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
  get: (endpoint) => request(endpoint, { method: "GET" }),
  post: (endpoint, body) => request(endpoint, { method: "POST", body: JSON.stringify(body) }),
};

export const adaptiveApiService = {
  health: () => adaptiveApi.get("/health"),
  getLearningOutcomes: () => adaptiveApi.get("/learning-outcomes"),
  submitQuiz: (results, studentId = "anonymous") =>
    adaptiveApi.post("/quiz/submit", { results, student_id: studentId }),
  simulateQuiz: (studentId = "anonymous") =>
    adaptiveApi.post("/quiz/simulate", { student_id: studentId }),
  getRecommendations: (results, studentId = "anonymous") =>
    adaptiveApi.post("/recommendations", { results, student_id: studentId }),
  getAdaptivePath: (results, studentId = "anonymous") =>
    adaptiveApi.post("/adaptive-path", { results, student_id: studentId }),
  getFullReport: (results, studentId = "anonymous") =>
    adaptiveApi.post("/full-report", { results, student_id: studentId }),
  getTimeEstimate: (results, studentId = "anonymous") =>
    adaptiveApi.post("/time-estimate", { results, student_id: studentId }),

  // Real lesson content (lessons.py) + weighted mastery scoring (mastery.py)
  // + Sentence-BERT recommendations (semantic_recommender.py) - distinct
  // from the simulated flow above, and the only path that pushes real
  // data into analytics-service.
  getLessons: () => adaptiveApi.get("/lessons"),
  getLessonQuiz: (lessonId) => adaptiveApi.get(`/lessons/${lessonId}/quiz`),
  submitLessonQuiz: ({ lessonId, studentId, studentName, studentEmail, answers, emotion }) =>
    adaptiveApi.post(`/lessons/${lessonId}/quiz/submit`, {
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail,
      answers,
      emotion,
    }),
};
