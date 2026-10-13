import { createFileRoute } from "@tanstack/react-router";
import { StudentDashboard } from "@/components/StudentDashboard";

// Who may open this page is decided in one place: the Guard in __root.jsx.
const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Learning \u2014 AdaptiveMind" },
      { name: "description", content: "Live emotion-aware adaptive learning view with real-time feedback and recommendations." },
      { property: "og:title", content: "Student Learning \u2014 AdaptiveMind" },
      { property: "og:description", content: "Live emotion-aware adaptive learning view." }
    ]
  }),
  component: StudentDashboard
});

export { Route };
