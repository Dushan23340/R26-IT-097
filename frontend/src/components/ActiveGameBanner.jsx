import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getActiveRecommendation } from "@/services/analyticsApi";

// Global, single-instance version of the "teacher started a game" prompt.
// Lives in __root.jsx so students see it regardless of which page they're
// on (dashboard, a different game, etc) - not just from inside a game page.
// Polls GET /recommendation/active every 5s; the route/label/badge for
// whatever game is active comes straight from the backend's GAME_LIBRARY
// (see emotion-backend/app/services/active_recommendation.py), so adding a
// new game there is all that's needed for it to show up here too.
function ActiveGameBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [active, setActive] = useState(null);
  const [dismissedRoute, setDismissedRoute] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "student") return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await getActiveRecommendation();
        if (!cancelled) setActive(data?.active_game ? data : null);
      } catch (error) {
        // Best-effort: the broadcast banner staying silent is fine if the
        // emotion-backend is temporarily unreachable.
      }
    };

    poll();
    const id = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user]);

  if (!user || user.role !== "student" || !active) return null;
  if (pathname === active.route) return null;
  if (dismissedRoute === active.route) return null;

  return (
    <div className="fixed top-20 right-6 z-50 w-80 animate-in slide-in-from-right rounded-2xl border border-accent/40 bg-[#0f1f3a] p-4 shadow-glow-intense">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <Sparkles className="h-4 w-4" />
          Your teacher started a game
        </div>
        <button
          type="button"
          onClick={() => setDismissedRoute(active.route)}
          className="text-text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        <span className="font-semibold text-foreground">{active.label}</span> is ready to play.
      </p>
      <Link
        to={active.route}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-[#071426] hover:bg-accent-light"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Play Now
      </Link>
    </div>
  );
}

export { ActiveGameBanner };
