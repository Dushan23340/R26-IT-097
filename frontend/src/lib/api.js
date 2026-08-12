const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const ANALYTICS_BASE_URL = import.meta.env.VITE_ANALYTICS_URL || "http://localhost:5001/api/analytics";

async function parseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text.trim() || response.statusText || "Request failed",
    };
  }
}

async function analyticsRequest(endpoint, options = {}) {
  const url = `${ANALYTICS_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  const response = await fetch(url, config);
  const data = await parseBody(response);

  if (!response.ok) {
    const msg =
      data.message ||
      data.error ||
      response.statusText ||
      "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  const response = await fetch(url, config);
  const data = await parseBody(response);

  if (!response.ok) {
    const msg =
      data.message ||
      data.error ||
      (response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : null) ||
      response.statusText ||
      "Request failed";
    throw new Error(msg);
  }
  return data;
}

const api = {
  get: (endpoint) => request(endpoint, { method: "GET" }),
  post: (endpoint, body) => request(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  }),
  put: (endpoint, body) => request(endpoint, {
    method: "PUT",
    body: JSON.stringify(body)
  }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" })
};

const analyticsApi = {
  // ── Core Analytics ──────────────────────────────────────────────
  getHealth: () => analyticsRequest("/health", { method: "GET" }),
  getStudents: () => analyticsRequest("/students", { method: "GET" }),
  getStudentProfile: (studentId) =>
    analyticsRequest(`/student/${studentId}/profile`, { method: "GET" }),
  getStudentTrend: (studentId) =>
    analyticsRequest(`/student/${studentId}/trend`, { method: "GET" }),
  getStudentStability: (studentId) =>
    analyticsRequest(`/student/${studentId}/stability`, { method: "GET" }),
  getStudentEmotions: (studentId) =>
    analyticsRequest(`/student/${studentId}/emotions`, { method: "GET" }),
  getStudentEngagement: (studentId) =>
    analyticsRequest(`/student/${studentId}/engagement`, { method: "GET" }),
  getStudentComplete: (studentId) =>
    analyticsRequest(`/student/${studentId}/complete`, { method: "GET" }),

  // ── ERSE — Suggestion Engine ─────────────────────────────────────
  // Generate a new suggestion for a student (save=true persists to DB)
  generateSuggestion: (studentId, save = true) =>
    analyticsRequest(`/student/${studentId}/suggestions?save=${save}`, {
      method: "GET",
    }),

  // Get suggestion history for a student
  getSuggestionHistory: (studentId, { status, limit = 20 } = {}) => {
    const params = new URLSearchParams({ limit });
    if (status) params.set("status", status);
    return analyticsRequest(
      `/student/${studentId}/suggestions/history?${params}`,
      { method: "GET" }
    );
  },

  // Teacher review action: approve, modify, or dismiss
  reviewSuggestion: (studentId, suggestionId, { action, teacherNotes, modifiedSuggestion, reviewedBy } = {}) =>
    analyticsRequest(
      `/student/${studentId}/suggestions/${suggestionId}/review`,
      {
        method: "POST",
        body: JSON.stringify({
          action,
          teacher_notes: teacherNotes,
          modified_suggestion: modifiedSuggestion,
          reviewed_by: reviewedBy,
        }),
      }
    ),

  // Get outcome tracking summary for a suggestion
  getSuggestionOutcome: (studentId, suggestionId) =>
    analyticsRequest(
      `/student/${studentId}/suggestions/${suggestionId}/outcome`,
      { method: "GET" }
    ),

  // Get all pending suggestions across all students (teacher dashboard feed)
  getPendingSuggestions: ({ urgency, limit = 50 } = {}) => {
    const params = new URLSearchParams({ limit });
    if (urgency) params.set("urgency", urgency);
    return analyticsRequest(`/suggestions/pending?${params}`, {
      method: "GET",
    });
  },
};

export {
  api,
  analyticsApi
};
