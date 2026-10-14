import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Award,
  Compass,
  Flame,
  Footprints,
  GraduationCap,
  LayoutGrid,
  Lock,
  MessageSquareHeart,
  Rocket,
  Star,
  TrendingUp,
  Trophy,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { computeBadges } from "@/lib/badges";
import { platformApi } from "@/lib/platformApi";
import { useT } from "@/lib/i18n";

const ICONS = { Compass, Flame, Footprints, GraduationCap, LayoutGrid, MessageSquareHeart, Rocket, Star, TrendingUp, Trophy, Video, Zap };

// Tier colours come from the existing palette (amber / teal / happy-green).
const TIERS = {
  bronze: "var(--emotion-confused)",
  silver: "var(--teal)",
  gold: "var(--amber)",
};

// Whether this user has finished the usability survey (one badge needs it).
function useSurveyDone(enabled) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    platformApi
      .mySurvey()
      .then((r) => setDone(Boolean(r.submitted)))
      .catch(() => {});
  }, [enabled]);
  return done;
}

// Badges for a learner, plus a toast and an inbox entry the first time each
// one is earned. "Seen" badges are remembered per user in this browser; the
// inbox entry is de-duplicated on the server, so another device never
// repeats it there.
function useBadges({ userId, history, lessonCount, ready = true }) {
  const surveyDone = useSurveyDone(Boolean(userId));
  const t = useT();
  const badges = useMemo(() => computeBadges({ history, surveyDone, lessonCount }), [history, surveyDone, lessonCount]);

  useEffect(() => {
    if (!userId || !ready || !history) return;
    const key = `badges_seen:${userId}`;
    let seen = null;
    try {
      seen = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      seen = null;
    }
    const earned = badges.filter((b) => b.earned).map((b) => b.id);
    const fresh = earned.filter((id) => !(seen || []).includes(id));
    for (const id of fresh) {
      const b = badges.find((x) => x.id === id);
      platformApi.reportEvent({ kind: "badge", title: `Badge earned: ${b.title}`, body: b.description, link: "/profile?tab=achievements", dedupeKey: b.id }).catch(() => {});
      // First visit ever on this browser: record quietly instead of a burst of toasts.
      if (seen) toast.success(t("Badge earned: {name}", { name: t(b.title) }), { description: t(b.description), icon: <Award className="h-[18px] w-[18px]" /> });
    }
    if (fresh.length || !seen) {
      try {
        localStorage.setItem(key, JSON.stringify(earned));
      } catch {
        // storage unavailable
      }
    }
  }, [badges, userId, ready, history, t]);

  return badges;
}

function BadgeIcon({ badge, size = "md" }) {
  const Icon = ICONS[badge.icon] || Award;
  const colour = TIERS[badge.tier];
  const dims = size === "sm" ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl";
  return (
    <span
      className={`${dims} relative grid place-items-center shrink-0 transition-transform duration-300 ${badge.earned ? "group-hover:scale-105" : ""}`}
      style={
        badge.earned
          ? { background: `color-mix(in oklab, ${colour} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${colour} 55%, transparent)`, boxShadow: `0 0 24px -8px ${colour}` }
          : { background: "color-mix(in oklab, var(--secondary) 70%, transparent)", border: "1px solid var(--border)" }
      }
    >
      <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} style={{ color: badge.earned ? colour : "var(--muted-foreground)", opacity: badge.earned ? 1 : 0.55 }} />
      {!badge.earned && (
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full grid place-items-center bg-background border border-border">
          <Lock className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      )}
    </span>
  );
}

// Full grid (profile page): every badge, earned ones first, with progress.
function BadgeGrid({ badges }) {
  const t = useT();
  const sorted = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
  return (
    <div className="cascade grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {sorted.map((b) => (
        <div key={b.id} className={`group glass rounded-2xl p-4 flex items-start gap-4 ${b.earned ? "" : "opacity-90"}`}>
          <BadgeIcon badge={b} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{t(b.title)}</h3>
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: TIERS[b.tier] }}>
                {t(b.tier)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(b.description)}</p>
            {b.earned ? (
              <p className="mt-2 text-xs font-medium text-emotion-happy">{t("Earned")}</p>
            ) : (
              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(b.progress * 100)}%`, background: "var(--gradient-primary)" }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tnum">
                  {b.current}
                  {b.unit || ""} / {b.target}
                  {b.unit || ""}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact strip (dashboard): earned badges plus the closest next one.
function BadgeStrip({ badges }) {
  const t = useT();
  const earned = badges.filter((b) => b.earned);
  const next = badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)[0];
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Award className="h-5 w-5 text-amber" /> {t("Achievements")}
        </h2>
        <Link to="/profile" search={{ tab: "achievements" }} className="text-xs font-medium text-primary hover:underline">
          {t("See all")} · {earned.length}/{badges.length}
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {earned.length === 0 && <p className="text-sm text-muted-foreground">{t("Finish your first quiz to earn your first badge.")}</p>}
        {earned.map((b) => (
          <span key={b.id} className="group" title={`${t(b.title)} - ${t(b.description)}`}>
            <BadgeIcon badge={b} size="sm" />
          </span>
        ))}
      </div>
      {next && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 p-3">
          <BadgeIcon badge={next} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("Next badge")}</p>
            <p className="text-sm font-medium truncate">
              {t(next.title)} <span className="text-muted-foreground font-normal">· {t(next.description)}</span>
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round(next.progress * 100)}%`, background: "var(--gradient-primary)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { BadgeGrid, BadgeIcon, BadgeStrip, useBadges };
