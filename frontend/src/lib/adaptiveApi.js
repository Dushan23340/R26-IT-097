const ADAPTIVE_API_BASE = import.meta.env.VITE_ADAPTIVE_API_URL || "http://localhost:5000/api";

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
};
