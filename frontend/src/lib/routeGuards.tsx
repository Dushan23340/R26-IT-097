import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

// Route guard component that checks if user is authenticated
export function AuthGuard({ children, requiredRole }: { children: React.ReactNode; requiredRole?: "student" | "teacher" }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login if not authenticated
    router.navigate({ to: "/login" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to home if wrong role
    router.navigate({ to: "/" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

// Helper function to create protected routes
export function createProtectedRoute(path: string, options: { requiredRole?: "student" | "teacher" }) {
  return createFileRoute(path as any)({
    beforeLoad: async () => {
      // Check authentication status before entering route
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        throw redirect({ to: "/login" });
      }

      const user = JSON.parse(userStr);
      if (options.requiredRole && user.role !== options.requiredRole) {
        throw redirect({ to: "/" });
      }
    },
  });
}
