import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, X } from "lucide-react";
import { platformApi } from "@/lib/platformApi";
import { useT } from "@/lib/i18n";

// Invitation to the usability survey, shown on the student dashboard and
// the Teacher Console until the user answers it. "Later" hides it for
// this browser session only.
function SurveyPrompt({ minQuizzes = 0, quizzesDone = 0 }) {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let hidden = false;
    try {
      hidden = sessionStorage.getItem("survey_prompt_hidden") === "1";
    } catch {
      // storage unavailable
    }
    if (hidden || quizzesDone < minQuizzes) return;
    platformApi
      .mySurvey()
      .then((r) => setShow(!r.submitted))
      .catch(() => {});
  }, [minQuizzes, quizzesDone]);

  if (!show) return null;
  const later = () => {
    setShow(false);
    try {
      sessionStorage.setItem("survey_prompt_hidden", "1");
    } catch {
      // storage unavailable
    }
  };

  return (
    <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-pop-in border border-primary/30">
      <span className="h-11 w-11 shrink-0 rounded-xl grid place-items-center bg-primary/10 border border-primary/30">
        <ClipboardList className="h-5 w-5 text-primary" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{t("Help us improve AdaptiveMind")}</p>
        <p className="text-sm text-muted-foreground">{t("Answer 10 quick statements about how easy the platform is to use. It takes about 2 minutes.")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/feedback"
          className="rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground whitespace-nowrap"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {t("Take the survey")}
        </Link>
        <button type="button" onClick={later} aria-label={t("Later")} title={t("Later")} className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export { SurveyPrompt };
