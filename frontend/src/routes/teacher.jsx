import { createFileRoute } from "@tanstack/react-router";
import { TeacherDashboard } from "@/components/TeacherDashboard";

// Who may open this page is decided in one place: the Guard in __root.jsx.
const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard \u2014 AdaptiveMind" },
      { name: "description", content: "Live class-wide emotion analytics, student grid, and intervention suggestions for educators." },
      { property: "og:title", content: "Teacher Dashboard \u2014 AdaptiveMind" },
      { property: "og:description", content: "Live class-wide emotion analytics and interventions." }
    ]
  }),
  component: TeacherDashboard
});

export { Route };
