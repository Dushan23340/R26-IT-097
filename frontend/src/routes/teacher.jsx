import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import ERSEDashboard from "@/components/ERSEDashboard";
import { useState } from "react";

export default function TeacherRoute() {
  return <ERSEDashboard />;
}
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
  if (!isLoading && !user) {
    router.navigate({ to: "/login" });
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
  const [activeTab, setActiveTab] = useState("erse");

return (
  <div>
    <div className="flex gap-2 px-6 pt-4 border-b bg-background border-border">
      <button
        onClick={() => setActiveTab("erse")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
          activeTab === "erse"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-500 hover:text-gray-700"
        }`}
      >
        ERSE Suggestions
      </button>
      <button
        onClick={() => setActiveTab("live")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
          activeTab === "live"
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-500 hover:text-gray-700"
        }`}
      >
        Live Dashboard
      </button>
    </div>
    {activeTab === "erse" ? <ERSEDashboard /> : <TeacherDashboard />}
  </div>
);
}
export {
  Route
};
