// Client for analytics-service (IT22197146) - Student Profile Management &
// Advanced Statistical Progress Analytics. Distinct from lib/emotionApi.js
// (port 8000, IT22242754's class-level emotion/game-recommendation service).
const STUDENT_PROFILE_API_BASE =
  import.meta.env.VITE_STUDENT_PROFILE_API_URL || "http://127.0.0.1:5010";

async function request(endpoint, options = {}) {
  const url = `${STUDENT_PROFILE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || data.message || response.statusText || "Request failed");
  }
  return data;
}

export const studentProfileApi = {
  getClassOverview: () => request("/class/overview"),
  getStudents: () => request("/students"),
  getStudentHistory: (studentId) => request(`/students/${studentId}/history`),
  getStudentTrend: (studentId) => request(`/students/${studentId}/analytics/trend`),
  getStudentStability: (studentId) => request(`/students/${studentId}/analytics/stability`),
  getStudentEmotionCorrelation: (studentId) =>
    request(`/students/${studentId}/analytics/emotion-correlation`),
  getPendingRecommendations: () => request("/recommendations/pending"),
  getApprovedRecommendations: (studentId) =>
    request(`/recommendations/approved${studentId ? `?student_id=${studentId}` : ""}`),
  reviewRecommendation: (id, body) =>
    request(`/recommendations/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  analyzeStudent: (studentId) =>
    request(`/students/${studentId}/analyze`, { method: "POST" }),
};
