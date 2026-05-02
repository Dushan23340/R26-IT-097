import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
function AuthGuard({ children, requiredRole }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  if (!user) {
    router.navigate({ to: "/login" });
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  if (requiredRole && user.role !== requiredRole) {
    router.navigate({ to: "/" });
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <>{children}</>;
}
function createProtectedRoute(path, options) {
  return createFileRoute(path)({
    beforeLoad: async () => {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        throw redirect({ to: "/login" });
      }
      const user = JSON.parse(userStr);
      if (options.requiredRole && user.role !== options.requiredRole) {
        throw redirect({ to: "/" });
      }
    }
  });
}
export {
  AuthGuard,
  createProtectedRoute
};
