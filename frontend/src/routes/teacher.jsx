import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";
const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard \u2014 AdaptiveMind" },
      { name: "description", content: "Live class-wide emotion analytics, student grid, and intervention suggestions for educators." },
      { property: "og:title", content: "Teacher Dashboard \u2014 AdaptiveMind" },
      { property: "og:description", content: "Live class-wide emotion analytics and interventions." }
    ]
  }),
  component: TeacherView
});
function TeacherView() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // For testing: allow access without auth
  if (!isLoading && !user) {
    // Mock teacher user for testing
    const mockUser = { id: 1, email: "teacher@test.com", name: "Test Teacher", role: "teacher" };
    localStorage.setItem("user", JSON.stringify(mockUser));
    window.location.reload(); // Reload to pick up the mock user
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }

  if (user?.role === "student") {
    router.navigate({ to: "/" });
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <TeacherDashboard />;
}
export {
  Route
};
