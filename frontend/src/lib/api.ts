// API utility for making HTTP requests
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse {
  success: boolean;
  message: string;
  user?: any;
  token?: string;
  requiresOtp?: boolean;
  [key: string]: any;
}

async function request(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  // Add token to headers if available
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // Make API call to backend
  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const api = {
  get: (endpoint: string) => request(endpoint, { method: "GET" }),
  post: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
};
