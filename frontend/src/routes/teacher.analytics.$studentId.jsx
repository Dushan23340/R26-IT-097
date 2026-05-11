import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { StudentAnalytics } from "@/components/StudentAnalytics";

const Route = createFileRoute("/teacher/analytics/$studentId")({
  head: () => ({
    meta: [
      { title: "Student Analytics — AdaptiveMind" },
      { name: "description", content: "Detailed learning analytics for a single student." },
    ],
  }),
  component: AnalyticsView,
});

function AnalyticsView() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role === "student") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You must be signed in as a teacher to view student analytics.
          </p>
        </div>
      </div>
    );
  }

  return <StudentAnalytics />;
}

export { Route };
