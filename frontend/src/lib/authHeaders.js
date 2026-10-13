// The Python services (emotion-service, emotion-backend, adaptive-learning,
// analytics-service) now require the account service's JWT on every request
// (see service_auth.py). This is the same token lib/api.js already sends to
// the account service; it is stored at login by lib/auth.jsx.
export function getToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// WebSockets cannot carry an Authorization header from the browser, so the
// token travels as a query parameter instead.
export function withTokenParam(url) {
  const token = getToken();
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

// True when a token exists and its expiry (the JWT "exp" claim) is still in
// the future. Only a convenience check for the UI: the services verify the
// signature themselves, so nothing here is trusted for security.
export function hasValidToken() {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// A service answered 401: the saved session is no longer valid (the token
// expired, or it was saved before the services started checking tokens).
// Clear it and send the user to the login page once, instead of leaving them
// on a page where every request silently fails.
let redirecting = false;
export function handleUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  } catch {
    // storage unavailable - still redirect
  }
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login?expired=1");
  }
}
