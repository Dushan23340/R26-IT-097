import { createFileRoute } from "@tanstack/react-router";
import { Users, Award, AlertTriangle, Download, Scale, TrendingUp } from "lucide-react";
import { EMOTIONS, type EmotionKey } from "@/lib/emotions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Overview — AdaptiveMind" },
      { name: "description", content: "Institutional analytics, fairness audit, and student leaderboard for academic advisors." },
      { property: "og:title", content: "Admin Overview — AdaptiveMind" },
      { property: "og:description", content: "Institutional analytics and fairness audit." },
    ],
  }),
  component: AdminView,
});

const summary = [
  { label: "Total Students", value: "248", icon: Users, tone: "var(--teal)" },
  { label: "Avg LO Achievement", value: "76.4%", icon: Award, tone: "var(--emotion-happy)" },
  { label: "At-Risk Students", value: "18", icon: AlertTriangle, tone: "var(--emotion-frustrated)" },
  { label: "Fairness Score", value: "0.93", icon: Scale, tone: "var(--amber)" },
];

const struggling = [
  { area: "Recursion & Backtracking", count: 47, severity: 0.78 },
  { area: "Dynamic Programming", count: 38, severity: 0.71 },
  { area: "Graph Algorithms", count: 29, severity: 0.55 },
  { area: "Complexity Analysis", count: 22, severity: 0.48 },
];

const fairness = [
  { group: "Group A", parity: 0.94, recall: 0.91 },
  { group: "Group B", parity: 0.92, recall: 0.93 },
  { group: "Group C", parity: 0.95, recall: 0.89 },
  { group: "Group D", parity: 0.91, recall: 0.92 },
];

const leaderboard: { name: string; id: string; lo: number; trend: "up" | "down" | "flat"; emotion: EmotionKey; risk: "low" | "med" | "high" }[] = [
  { name: "Maya Chen",      id: "2024-1145", lo: 94, trend: "up",   emotion: "happy",      risk: "low" },
  { name: "Jordan Patel",   id: "2024-1167", lo: 91, trend: "up",   emotion: "happy",      risk: "low" },
  { name: "Aisha Kumar",    id: "2024-1289", lo: 88, trend: "up",   emotion: "neutral",    risk: "low" },
  { name: "Tom Jensen",     id: "2024-1302", lo: 76, trend: "flat", emotion: "neutral",    risk: "low" },
  { name: "Sara Hasan",     id: "2024-1421", lo: 64, trend: "down", emotion: "confused",   risk: "med" },
  { name: "Vik Petrov",     id: "2024-1488", lo: 52, trend: "down", emotion: "frustrated", risk: "high" },
  { name: "Wren Quill",     id: "2024-1503", lo: 48, trend: "down", emotion: "bored",      risk: "high" },
];

function AdminView() {
  return (
    <div className="space-y-6 stagger-children">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Faculty of Computing · Spring 2026</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Advisor <span className="text-gradient-primary">Overview</span></h1>
        </div>
        <button className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
                style={{ background: "var(--gradient-accent)", color: "var(--accent-foreground)" }}>
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</span>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                     style={{ background: `color-mix(in oklab, ${s.tone} 18%, transparent)`, color: s.tone }}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="font-display text-3xl font-bold" style={{ color: s.tone }}>{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Struggling areas */}
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--emotion-frustrated)" }} /> Top Struggling Areas
          </div>
          <div className="space-y-4">
            {struggling.map((s) => (
              <div key={s.area}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium">{s.area}</span>
                  <span className="text-xs font-mono text-muted-foreground">{s.count} students</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${s.severity * 100}%`,
                    background: `linear-gradient(90deg, var(--emotion-confused), var(--emotion-frustrated))`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fairness audit */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4" style={{ color: "var(--amber)" }} /> Fairness Audit
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full font-mono"
                  style={{ background: "color-mix(in oklab, var(--emotion-happy) 18%, transparent)", color: "var(--emotion-happy)" }}>
              ✓ All groups within tolerance
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Demographic parity and recall across student demographic groups (target ≥ 0.85).</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fairness.map((f) => (
              <div key={f.group} className="rounded-xl p-3 border border-border"
                   style={{ background: "color-mix(in oklab, var(--card) 50%, transparent)" }}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{f.group}</div>
                <div className="text-xs flex justify-between">
                  <span>Parity</span><span className="font-mono" style={{ color: "var(--emotion-happy)" }}>{f.parity}</span>
                </div>
                <div className="text-xs flex justify-between mt-0.5">
                  <span>Recall</span><span className="font-mono" style={{ color: "var(--teal)" }}>{f.recall}</span>
                </div>
                <div className="mt-2 h-1 rounded-full overflow-hidden bg-secondary">
                  <div className="h-full" style={{ width: `${f.parity * 100}%`, background: "var(--gradient-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Student Performance List
          </div>
          <div className="flex gap-2">
            {["All", "At-Risk", "Top Performers"].map((f, i) => (
              <button key={f} className="text-xs px-3 py-1.5 rounded-full border border-border"
                      style={{ background: i === 0 ? "var(--gradient-primary)" : "transparent", color: i === 0 ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                {f}
              </button>
            ))}
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
              {leaderboard.map((s, i) => {
                const riskColor = s.risk === "high" ? "var(--emotion-angry)" : s.risk === "med" ? "var(--emotion-confused)" : "var(--emotion-happy)";
                const trendColor = s.trend === "up" ? "var(--emotion-happy)" : s.trend === "down" ? "var(--emotion-angry)" : "var(--muted-foreground)";
                const e = EMOTIONS[s.emotion];
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-card/40">
                    <td className="py-3 pr-4 font-mono text-muted-foreground">#{i + 1}</td>
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{s.id}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full" style={{ width: `${s.lo}%`, background: "var(--gradient-primary)" }} />
                        </div>
                        <span className="font-mono text-xs">{s.lo}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-xs font-mono" style={{ color: trendColor }}>
                        <TrendingUp className="h-3.5 w-3.5" style={{ transform: s.trend === "down" ? "scaleY(-1)" : s.trend === "flat" ? "rotate(90deg)" : "none" }} />
                        {s.trend}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-base" title={e.label}>{e.emoji}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
                            style={{ background: `color-mix(in oklab, ${riskColor} 18%, transparent)`, color: riskColor }}>
                        {s.risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
