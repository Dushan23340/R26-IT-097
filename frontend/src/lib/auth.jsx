import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { hasValidToken } from "@/lib/authHeaders";
import { toast } from "sonner";
const AuthContext = createContext(void 0);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    // A saved user without a valid token is not a usable session: every
    // service now checks the token, so treat it as logged out and let the
    // login screen issue a fresh one.
    if (storedUser && !hasValidToken()) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } else if (storedUser) {
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
  // One browser holds one login (localStorage is shared by its tabs). When
  // another tab signs in as someone else, or signs out, follow it here too.
  // Otherwise this tab keeps showing the old user while sending the new
  // user's token, and every role-checked request comes back 403.
  useEffect(() => {
    const sync = (event) => {
      if (event.key !== null && event.key !== "user" && event.key !== "token") return;
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem("user") || "null");
      } catch {
        stored = null;
      }
      if (!stored || !hasValidToken()) stored = null;
      setUser((current) => {
        if ((current?.id ?? null) === (stored?.id ?? null) && current?.role === stored?.role) return current;
        if (stored && current) {
          toast.info(`Now signed in as ${stored.name}`, { description: `Another tab signed in as a ${stored.role}. One browser can hold one login at a time.` });
        }
        return stored;
      });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const signup = async (email, password, name, role) => {
    try {
      const response = await api.post("/auth/signup", { email, password, name, role });
      // The account service already returns the new user and a token on
      // sign-up. Keep them, so a new account is signed in straight away
      // instead of being sent to the login page to type the same details.
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
      const response = await api.post("/auth/login", { email, password });
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
        if (response.token) {
          localStorage.setItem("token", response.token);
        }
      }
      return response;
    } catch (error) {
      console.error("\u274C Login error:", error.message);
      return { success: false, message: error.message || "Login failed", ...(error.data?.requiresVerification ? { requiresVerification: true, email: error.data.email, delivery: error.data.delivery } : {}) };
    }
  };
  const verifyOtp = async (email, otp) => {
    try {
      const response = await api.post("/auth/verify-otp", { email, otp });
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
        if (response.token) {
          localStorage.setItem("token", response.token);
        }
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
  const forgotPassword = async (email) => {
    try {
      return await api.post("/auth/forgot-password", { email });
    } catch (error) {
      return { success: false, message: error.message || "Could not start the password reset" };
    }
  };
  const resetPassword = async (email, otp, newPassword) => {
    try {
      return await api.post("/auth/reset-password", { email, otp, newPassword });
    } catch (error) {
      return { success: false, message: error.message || "Could not reset the password" };
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
  return <AuthContext.Provider value={{ user, isLoading, signup, login, verifyOtp, logout, resendOtp, forgotPassword, resetPassword, updateUser }}>
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
