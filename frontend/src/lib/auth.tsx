import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";

export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; message: string; requiresOtp?: boolean }>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; requiresOtp?: boolean }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  resendOtp: (email: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
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

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    try {
      const response = await api.post("/auth/signup", { email, password, name, role });
      return response;
    } catch (error: any) {
      return { success: false, message: error.message || "Signup failed" };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Login attempt:', { email, api_url: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
      const response = await api.post("/auth/login", { email, password });
      console.log('✅ Login response:', response);
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
      }
      return response;
    } catch (error: any) {
      console.error('❌ Login error:', error.message);
      return { success: false, message: error.message || "Login failed" };
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    try {
      const response = await api.post("/auth/verify-otp", { email, otp });
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem("user", JSON.stringify(response.user));
      }
      return response;
    } catch (error: any) {
      return { success: false, message: error.message || "OTP verification failed" };
    }
  };

  const resendOtp = async (email: string) => {
    try {
      const response = await api.post("/auth/resend-otp", { email });
      return response;
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to resend OTP" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signup, login, verifyOtp, logout, resendOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
