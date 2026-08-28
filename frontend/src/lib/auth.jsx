import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { api } from "@/lib/api";
const AuthContext = createContext(void 0);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
    // No stored user (including right after logout) -> stay logged out and
    // show the real login/signup screen. This used to auto-login as a
    // fake "Test Teacher" account, which meant logout could never actually
    // stick past a page refresh.
    setIsLoading(false);
  }, []);
  const signup = async (email, password, name, role) => {
    try {
      const response = await api.post("/auth/signup", { email, password, name, role });
      return response;
    } catch (error) {
      return { success: false, message: error.message || "Signup failed" };
    }
  };
  const login = async (email, password) => {
    try {
      console.log("\u{1F510} Login attempt:", { email, api_url: import.meta.env.VITE_API_URL || "http://localhost:3001/api" });
      const response = await api.post("/auth/login", { email, password });
      console.log("\u2705 Login response:", response);
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      console.error("\u274C Login error:", error.message);
      return { success: false, message: error.message || "Login failed" };
    }
  };
  const verifyOtp = async (email, otp) => {
    try {
      const response = await api.post("/auth/verify-otp", { email, otp });
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      return { success: false, message: error.message || "OTP verification failed" };
    }
  };
  const resendOtp = async (email) => {
    try {
      const response = await api.post("/auth/resend-otp", { email });
      return response;
    } catch (error) {
      return { success: false, message: error.message || "Failed to resend OTP" };
    }
  };
  // Shared by every Account Settings form (profile info, avatar,
  // notification prefs) - each PUTs to its own routes/users.js endpoint,
  // then hands the returned user object here to update context +
  // localStorage in one place instead of repeating this pattern per form.
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    // Navigate here rather than relying on each page to notice user became
    // null and redirect itself - not every route has that guard, so this
    // is the one place that reliably gets you off a protected page.
    router.navigate({ to: "/login" });
  };
  return <AuthContext.Provider value={{ user, isLoading, signup, login, verifyOtp, logout, resendOtp, updateUser }}>
      {children}
    </AuthContext.Provider>;
}
function useAuth() {
  const context = useContext(AuthContext);
  if (context === void 0) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
export {
  AuthProvider,
  useAuth
};
