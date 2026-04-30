import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard — AdaptiveMind" },
      { name: "description", content: "Live class-wide emotion analytics, student grid, and intervention suggestions for educators." },
      { property: "og:title", content: "Teacher Dashboard — AdaptiveMind" },
      { property: "og:description", content: "Live class-wide emotion analytics and interventions." },
    ],
  }),
  component: TeacherView,
});

// Teacher view component with authentication checks
function TeacherView() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    router.navigate({ to: "/login" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect students to student dashboard
  if (user?.role === "student") {
    router.navigate({ to: "/" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show new teacher dashboard for teachers
  return <TeacherDashboard />;
}
