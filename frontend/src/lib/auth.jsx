import { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";
const AuthContext = createContext(void 0);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);
  const signup = async (email, password, name, role) => {
    try {
      const response = await api.post("/auth/signup", { email, password, name, role });
      if (response.success && response.user && response.token) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);
      }
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
      if (response.success && response.user && response.token) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);
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
      if (response.success && response.user && response.token) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);
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
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };
  return <AuthContext.Provider value={{ user, isLoading, signup, login, verifyOtp, logout, resendOtp }}>
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
