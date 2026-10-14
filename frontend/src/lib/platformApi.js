import { api, API_BASE_URL } from "@/lib/api";
import { trackedFetch } from "@/lib/network";
import { getToken } from "@/lib/authHeaders";

// Platform features that sit beside the four research components, all
// served by the account service: notifications inbox, usability survey
// (SUS), privacy centre, system status and the interface language.
export const platformApi = {
  notifications: (limit = 30, { background = false } = {}) => api.get(`/notifications?limit=${limit}`, { background }),
  markRead: (ids) => api.post("/notifications/read", ids ? { ids } : { all: true }),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  reportEvent: ({ kind, title, body, link, dedupeKey }) => api.post("/notifications/self", { kind, title, body, link, dedupeKey }),

  mySurvey: () => api.get("/feedback/sus/mine"),
  submitSurvey: (answers, comment) => api.post("/feedback/sus", { answers, comment }),
  surveySummary: () => api.get("/feedback/sus/summary"),

  setWebcamConsent: (webcam) => api.put("/privacy/consent", { webcam }),
  privacySummary: () => api.get("/privacy/summary"),
  deleteMyData: (scope, password) => api.delete("/privacy/data", { scope, password }),

  systemStatus: () => api.get("/system/status"),

  setLanguage: (userId, language) => api.put(`/users/${userId}/language`, { language }),
};

// Downloads a file from a signed-in endpoint (the token travels in the
// Authorization header, so a plain <a href> can't be used).
export async function downloadFromAccount(path, fallbackName) {
  const response = await trackedFetch("account service", `${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) {
    let message = "Download failed";
    try {
      message = (await response.json()).message || message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const name = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  saveBlob(await response.blob(), name);
}

// Saves text or a Blob as a file in the browser.
export function saveBlob(content, filename, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rows -> CSV text (Excel opens it; the BOM keeps Sinhala text readable).
export function toCsv(columns, rows) {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(typeof c.value === "function" ? c.value(r) : r[c.value])).join(","))].join("\n") + "\n";
}
