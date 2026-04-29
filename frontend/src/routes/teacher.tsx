import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Users, Gamepad2, Lightbulb, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { EMOTIONS, type EmotionKey } from "@/lib/emotions";
import { EmotionBadge } from "@/components/EmotionBadge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Dashboard — AdaptiveMind" },
      { name: "description", content: "Live class-wide emotion analytics, student grid, and intervention suggestions for educators." },
      { property: "og:title", content: "Teacher Dashboard — AdaptiveMind" },
      { property: "og:description", content: "Live class-wide emotion analytics and interventions." },
    ],
  }),
  component: TeacherDashboard,
});

// Export the component for use in other files
export { TeacherView };

function TeacherDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    router.navigate({ to: "/login" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect students to student dashboard
  if (user?.role === "student") {
    router.navigate({ to: "/" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show teacher dashboard for teachers
  return <TeacherView />;
}

const STUDENT_NAMES = [
  "Aisha K.", "Ben R.", "Chen W.", "Diya P.", "Eli M.", "Fatima A.",
  "Gabe S.", "Hana L.", "Ivan O.", "Jules N.", "Kavi T.", "Lina B.",
  "Mia C.", "Nuwan D.", "Omar Z.", "Priya V.", "Quinn E.", "Ravi G.",
  "Sara H.", "Tom J.", "Uma K.", "Vik P.", "Wren Q.", "Yara F.",
];

function TeacherView() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const students = useMemo(() => {
    const keys: EmotionKey[] = ["happy", "neutral", "neutral", "confused", "bored", "frustrated", "happy", "neutral"];
    return STUDENT_NAMES.map((name, i) => ({
      name,
      emotion: keys[(i + tick) % keys.length],
      score: 50 + ((i * 13 + tick * 3) % 50),
    }));
  }, [tick]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => { counts[s.emotion] = (counts[s.emotion] ?? 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      key, value, ...EMOTIONS[key as EmotionKey],
    }));
  }, [students]);

  const dominantEmotion = useMemo(
    () => distribution.slice().sort((a, b) => b.value - a.value)[0]?.key as EmotionKey ?? "neutral",
    [distribution]
  );

  const trend = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({
      t: `${i * 2}m`,
      engaged: 60 + Math.sin(i / 3) * 18 + Math.random() * 6,
      confused: 25 + Math.cos(i / 4) * 12 + Math.random() * 5,
      bored: 15 + Math.sin(i / 5) * 8 + Math.random() * 4,
    })),
    []
  );

  const games = getGameRecs(dominantEmotion);
  const insights = getInsights(distribution, students.length);

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">CS2040 · 24 students · Hall B</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Teacher <span className="text-gradient-accent">Console</span></h1>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">Dominant mood</span>
          <EmotionBadge emotion={dominantEmotion} size="lg" pulse />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution */}
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Class Emotion Mix
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="label" cx="50%" cy="50%"
                     innerRadius={50} outerRadius={85} paddingAngle={3} stroke="none">
                  {distribution.map((d) => <Cell key={d.key} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {distribution.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.label}
                </span>
                <span className="font-mono text-muted-foreground">{Math.round((d.value / students.length) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trend */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Engagement Trend (this session)
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="engaged" stroke="var(--emotion-happy)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="confused" stroke="var(--emotion-confused)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="bored" stroke="var(--emotion-bored)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((ins, i) => (
          <div key={i} className="glass rounded-2xl p-5 border-l-4" style={{ borderLeftColor: ins.color }}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: `color-mix(in oklab, ${ins.color} 18%, transparent)`, color: ins.color }}>
                {ins.icon === "alert" ? <AlertTriangle className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-sm font-semibold">{ins.title}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.body}</p>
                <button className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: ins.color }}>
                  {ins.action} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student grid */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Live Student Grid
            </div>
            <span className="text-[11px] text-muted-foreground">Updated {tick * 4}s ago</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {students.map((s) => {
              const e = EMOTIONS[s.emotion];
              return (
                <div key={s.name} className="rounded-xl p-2 transition-all hover:scale-105"
                     style={{ background: `color-mix(in oklab, ${e.color} 10%, transparent)`, border: `1px solid color-mix(in oklab, ${e.color} 25%, transparent)` }}>
                  <div className="aspect-square rounded-lg flex items-center justify-center text-3xl"
                       style={{ background: "color-mix(in oklab, var(--background) 60%, transparent)" }}>
                    {e.emoji}
                  </div>
                  <div className="text-[11px] font-medium mt-1.5 truncate">{s.name}</div>
                  <div className="text-[10px] font-mono" style={{ color: e.color }}>{e.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game recommendations */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="h-4 w-4" style={{ color: "var(--amber)" }} />
            <span className="text-sm font-semibold">Suggested Activities</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Triggered by class mood</p>
          <div className="space-y-3">
            {games.map((g, i) => (
              <div key={i} className="p-3 rounded-xl border border-border" style={{ background: "color-mix(in oklab, var(--card) 60%, transparent)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold">{g.title}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                        style={{ background: `color-mix(in oklab, ${g.tagColor} 18%, transparent)`, color: g.tagColor }}>
                    {g.subject}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{g.desc}</p>
                <div className="text-[10px] text-muted-foreground italic">⚡ {g.trigger}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGameRecs(dom: EmotionKey) {
  if (dom === "bored" || dom === "neutral") {
    return [
      { title: "Algorithm Race", subject: "CS", tagColor: "var(--teal)", desc: "Live Kahoot-style quiz on time complexity.", trigger: "Triggered by 30% Boredom" },
      { title: "Code Detective", subject: "CS", tagColor: "var(--amber)", desc: "Spot the bug in 60-second rounds.", trigger: "Re-engagement booster" },
    ];
  }
  if (dom === "confused") {
    return [
      { title: "Concept Match-Up", subject: "CS", tagColor: "var(--teal)", desc: "Drag-and-drop algorithm names to definitions.", trigger: "Triggered by 45% Confusion" },
      { title: "Step-by-Step Replay", subject: "CS", tagColor: "var(--amber)", desc: "Walk through binary search with visual aids.", trigger: "Clarification activity" },
    ];
  }
  return [
    { title: "Lightning Round", subject: "CS", tagColor: "var(--teal)", desc: "Push the pace — 30s per advanced question.", trigger: "Class is in flow" },
    { title: "Build-an-Algorithm", subject: "CS", tagColor: "var(--amber)", desc: "Collaborative challenge: design a sort.", trigger: "High engagement detected" },
  ];
}

function getInsights(dist: { key: string; value: number }[], total: number) {
  const conf = (dist.find((d) => d.key === "confused")?.value ?? 0) / total;
  const bored = (dist.find((d) => d.key === "bored")?.value ?? 0) / total;
  const happy = (dist.find((d) => d.key === "happy")?.value ?? 0) / total;
  const out: { title: string; body: string; action: string; icon: "alert" | "lightbulb"; color: string }[] = [];
  if (conf > 0.25) out.push({ title: `${Math.round(conf * 100)}% confused`, body: "A 5-minute recap on this concept could improve mastery for the majority of the class.", action: "Trigger Recap", icon: "alert", color: "var(--emotion-confused)" });
  if (bored > 0.15) out.push({ title: `${Math.round(bored * 100)}% disengaged`, body: "Inject an interactive game to re-capture attention and reset focus.", action: "Launch Game", icon: "lightbulb", color: "var(--emotion-bored)" });
  if (happy > 0.4) out.push({ title: "Class is in flow", body: "Perfect window to introduce a stretch problem or pair-programming task.", action: "Add Challenge", icon: "lightbulb", color: "var(--emotion-happy)" });
  while (out.length < 3) out.push({ title: "Pacing on track", body: "No interventions recommended right now. Continue with planned content.", action: "View Plan", icon: "lightbulb", color: "var(--teal)" });
  return out.slice(0, 3);
}
