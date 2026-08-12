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

  // Real lesson content (lessons.py) + good/average/weak mastery-tier
  // scoring (mastery.py) + Sentence-BERT recommendations
  // (semantic_recommender.py) - distinct from the simulated flow above, and
  // the only path that pushes real data into analytics-service.
  //
  // quizSet: 1 for a student's first attempt at a lesson, 2 for every
  // retake thereafter (a different set of questions per LO so answers
  // can't just be remembered from the first attempt).
  getLessons: () => adaptiveApi.get("/lessons"),
  getLessonQuiz: (lessonId, quizSet = 1) => adaptiveApi.get(`/lessons/${lessonId}/quiz?set=${quizSet}`),
  submitLessonQuiz: ({ lessonId, studentId, studentName, studentEmail, answers, emotion, durationSeconds, quizSet = 1 }) =>
    adaptiveApi.post(`/lessons/${lessonId}/quiz/submit`, {
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail,
      answers,
      emotion,
      duration_seconds: durationSeconds,
      quiz_set: quizSet,
    }),

  // Resource recommendations derived from the student's most recent quiz's
  // still-weak LOs (analytics-service lookup + semantic_recommender) - for
  // the dashboard's "Recommended for You" panel, without requiring a fresh
  // quiz submission first.
  getStudentRecommendations: (studentId) => adaptiveApi.get(`/students/${studentId}/recommendations`),
};
