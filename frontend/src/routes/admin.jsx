import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Award, AlertTriangle, Download, Scale, TrendingUp } from "lucide-react";
import { EMOTIONS, toEmotionKey } from "@/lib/emotions";
import { studentProfileApi } from "@/lib/studentProfileApi";

const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Overview — AdaptiveMind" },
      { name: "description", content: "Institutional analytics, fairness audit, and student leaderboard for academic advisors." },
      { property: "og:title", content: "Admin Overview — AdaptiveMind" },
      { property: "og:description", content: "Institutional analytics and fairness audit." }
    ]
  }),
  component: AdminView
});

function trendLabel(direction) {
  if (direction === "improving") return "up";
  if (direction === "declining") return "down";
  if (direction === "stable") return "flat";
  return "n/a";
}

function AdminView() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentProfileApi
      .getClassOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const students = overview?.students ?? [];
  const filteredStudents =
    filter === "At-Risk"
      ? students.filter((s) => s.at_risk || s.risk === "high")
      : filter === "Top Performers"
        ? students.filter((s) => s.avg_score >= 80)
        : students;

  const fairness = overview?.fairness;
  const fairnessGroups = fairness?.available
    ? Object.entries(fairness.proficiency_rates).map(([group, rate]) => ({
        group,
        proficiencyRate: rate,
        ratio: fairness.disparate_impact_ratios[group],
        flagged: fairness.flagged_groups.includes(group),
      }))
    : [];

  const summary = [
    { label: "Total Students", value: overview ? String(overview.total_students) : "–", icon: Users, tone: "var(--teal)" },
    { label: "Avg LO Achievement", value: overview?.avg_lo_score != null ? `${overview.avg_lo_score}%` : "–", icon: Award, tone: "var(--emotion-happy)" },
    { label: "At-Risk Students", value: overview ? String(overview.at_risk_count) : "–", icon: AlertTriangle, tone: "var(--emotion-frustrated)" },
    {
      label: "Fairness",
      value: fairness?.available ? (fairness.fair ? "Fair" : `${fairness.flagged_groups.length} flagged`) : "–",
      icon: Scale,
      tone: fairness?.available && !fairness.fair ? "var(--emotion-angry)" : "var(--amber)",
    },
  ];

  return <div className="space-y-6 stagger-children">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Faculty of Computing · Spring 2026</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Advisor <span className="text-gradient-primary">Overview</span></h1>
        </div>
        <button
    className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
    style={{ background: "var(--gradient-accent)", color: "var(--accent-foreground)" }}
  >
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-sm">
          Couldn't reach the student-profile analytics service ({error}). Is it running on port 5010?
        </div>
      ) : null}

      {
    /* Summary cards */
  }
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => {
    const Icon = s.icon;
    return <div key={s.label} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</span>
                <div
      className="h-9 w-9 rounded-lg flex items-center justify-center"
      style={{ background: `color-mix(in oklab, ${s.tone} 18%, transparent)`, color: s.tone }}
    >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display text-3xl font-bold" style={{ color: s.tone }}>{loading ? "…" : s.value}</div>
            </div>;
  })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {
    /* Struggling areas */
  }
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--emotion-frustrated)" }} /> Weakest LO Categories
          </div>
          <div className="space-y-4">
            {(overview?.struggling_areas ?? []).map((s) => <div key={s.lo_level}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium capitalize">{s.lo_level}</span>
                  <span className="text-xs font-mono text-muted-foreground">{s.avg_score}% avg · {s.count} scores</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{
    width: `${s.avg_score}%`,
    background: `linear-gradient(90deg, var(--emotion-confused), var(--emotion-frustrated))`
  }} />
                </div>
              </div>)}
            {!loading && !overview?.struggling_areas?.length ? (
              <p className="text-xs text-muted-foreground">No learning-outcome data recorded yet.</p>
            ) : null}
          </div>
        </div>

        {
    /* Fairness audit */
  }
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4" style={{ color: "var(--amber)" }} /> Fairness Audit (Disparate Impact)
            </div>
            {fairness?.available ? (
              <span
    className="text-[11px] px-2 py-1 rounded-full font-mono"
    style={{
      background: `color-mix(in oklab, ${fairness.fair ? "var(--emotion-happy)" : "var(--emotion-angry)"} 18%, transparent)`,
      color: fairness.fair ? "var(--emotion-happy)" : "var(--emotion-angry)",
    }}
  >
                {fairness.fair ? "✓ All groups within tolerance" : `⚠ ${fairness.flagged_groups.join(", ")} outside tolerance`}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {fairness?.available
              ? `Proficiency (≥85%) achievement rate per demographic group vs. the best-performing group (target ratio 0.8–1.25).`
              : fairness?.reason || "Not enough demographic data to compute a fairness audit yet."}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fairnessGroups.map((f) => <div
    key={f.group}
    className="rounded-xl p-3 border border-border"
    style={{ background: "color-mix(in oklab, var(--card) 50%, transparent)" }}
  >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{f.group}</div>
                <div className="text-xs flex justify-between">
                  <span>Proficiency</span><span className="font-mono" style={{ color: "var(--emotion-happy)" }}>{Math.round(f.proficiencyRate * 100)}%</span>
                </div>
                <div className="text-xs flex justify-between mt-0.5">
                  <span>DI Ratio</span><span className="font-mono" style={{ color: f.flagged ? "var(--emotion-angry)" : "var(--teal)" }}>{f.ratio}</span>
                </div>
                <div className="mt-2 h-1 rounded-full overflow-hidden bg-secondary">
                  <div className="h-full" style={{ width: `${f.proficiencyRate * 100}%`, background: "var(--gradient-primary)" }} />
                </div>
              </div>)}
          </div>
        </div>
      </div>

      {
    /* Leaderboard */
  }
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Student Performance List
          </div>
          <div className="flex gap-2">
            {["All", "At-Risk", "Top Performers"].map((f) => <button
    key={f}
    onClick={() => setFilter(f)}
    className="text-xs px-3 py-1.5 rounded-full border border-border"
    style={{ background: filter === f ? "var(--gradient-primary)" : "transparent", color: filter === f ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
  >
                {f}
              </button>)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Student</th>
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">LO Avg</th>
                <th className="py-3 pr-4">Trend</th>
                <th className="py-3 pr-4">Mood</th>
                <th className="py-3 pr-4">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, i) => {
    const riskColor = s.risk === "high" ? "var(--emotion-angry)" : s.risk === "med" ? "var(--emotion-confused)" : "var(--emotion-happy)";
    const trend = trendLabel(s.trend);
    const trendColor = trend === "up" ? "var(--emotion-happy)" : trend === "down" ? "var(--emotion-angry)" : "var(--muted-foreground)";
    const emotionKey = toEmotionKey(s.dominant_emotion);
    const e = emotionKey ? EMOTIONS[emotionKey] : null;
    return <tr key={s.student_id} className="border-b border-border/50 hover:bg-card/40">
                    <td className="py-3 pr-4 font-mono text-muted-foreground">#{i + 1}</td>
                    <td className="py-3 pr-4 font-medium">{s.full_name || s.student_id}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{s.student_id}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full" style={{ width: `${s.avg_score}%`, background: "var(--gradient-primary)" }} />
                        </div>
                        <span className="font-mono text-xs">{s.avg_score}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-xs font-mono" style={{ color: trendColor }}>
                        <TrendingUp className="h-3.5 w-3.5" style={{ transform: trend === "down" ? "scaleY(-1)" : trend === "flat" ? "rotate(90deg)" : "none" }} />
                        {trend}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {e ? <span className="text-base" title={e.label}>{e.emoji}</span> : <span className="text-xs text-muted-foreground">–</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span
      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
      style={{ background: `color-mix(in oklab, ${riskColor} 18%, transparent)`, color: riskColor }}
    >
                        {s.risk}
                      </span>
                    </td>
                  </tr>;
  })}
              {!loading && !filteredStudents.length ? (
                <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No students match this filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
export {
  Route
};
