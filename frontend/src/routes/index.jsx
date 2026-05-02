import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { StudentDashboard } from "@/components/StudentDashboard";
const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Learning \u2014 AdaptiveMind" },
      { name: "description", content: "Live emotion-aware adaptive learning view with real-time feedback and recommendations." },
      { property: "og:title", content: "Student Learning \u2014 AdaptiveMind" },
      { property: "og:description", content: "Live emotion-aware adaptive learning view." }
    ]
  }),
  component: StudentView
});
function StudentView() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  if (!isLoading && !user) {
    router.navigate({ to: "/login" });
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  if (user?.role === "teacher") {
    router.navigate({ to: "/teacher" });
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <StudentDashboard />;
}
export {
  Route
};
