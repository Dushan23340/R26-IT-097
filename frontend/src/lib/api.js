const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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
export {
  api
};
