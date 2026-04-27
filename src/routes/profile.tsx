import { createFileRoute } from "@tanstack/react-router";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Activity, TrendingUp, Calendar } from "lucide-react";
import { EMOTIONS, type EmotionKey } from "@/lib/emotions";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MasteryRing } from "@/components/MasteryRing";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Student Analytics — AdaptiveMind" },
      { name: "description", content: "Multi-session learning outcomes, emotion-performance correlation, and stability analytics." },
      { property: "og:title", content: "Student Analytics — AdaptiveMind" },
      { property: "og:description", content: "Multi-session LO trends and emotion-performance correlation." },
    ],
  }),
  component: ProfileView,
});

const sessionTrend = [
  { lesson: "L1", lo: 58, eng: 64 },
  { lesson: "L2", lo: 62, eng: 70 },
  { lesson: "L3", lo: 55, eng: 52 },
  { lesson: "L4", lo: 71, eng: 76 },
  { lesson: "L5", lo: 79, eng: 82 },
  { lesson: "L6", lo: 74, eng: 71 },
  { lesson: "L7", lo: 84, eng: 88 },
  { lesson: "L8", lo: 88, eng: 90 },
];

const scatter = Array.from({ length: 30 }, (_, i) => ({
  emotion: 30 + Math.random() * 70,
  score: 30 + Math.random() * 70,
  z: 100,
}));

const lessons: { id: string; title: string; lo: number; emotion: EmotionKey; eng: number; rec: string }[] = [
  { id: "L8", title: "Dynamic Programming Intro", lo: 88, emotion: "happy", eng: 92, rec: "Advance to advanced track" },
  { id: "L7", title: "Greedy Algorithms", lo: 84, emotion: "neutral", eng: 88, rec: "Maintain pace" },
  { id: "L6", title: "Graph Traversal", lo: 74, emotion: "confused", eng: 71, rec: "Review BFS visualization" },
  { id: "L5", title: "Sorting Algorithms", lo: 79, emotion: "happy", eng: 82, rec: "Try harder problems" },
  { id: "L4", title: "Binary Search Trees", lo: 71, emotion: "neutral", eng: 76, rec: "Practice rotations" },
  { id: "L3", title: "Recursion Basics", lo: 55, emotion: "frustrated", eng: 52, rec: "Schedule 1:1 tutoring" },
];

function ProfileView() {
  const stdDev = 10.8;
  const variance = 116.7;

  return (
    <div className="space-y-6 stagger-children">
      {/* Profile header */}
      <div className="glass rounded-2xl p-6 flex flex-wrap items-center gap-6">
        <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-display font-bold flex-shrink-0"
             style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}>
          AK
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Student Profile</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Aisha Kumar</h1>
          <div className="text-sm text-muted-foreground mt-1">CS2040 · Year 2 · ID 2024-1289</div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Avg LO" value="74%" tone="good" />
          <Stat label="Sessions" value="8" tone="neutral" />
          <Stat label="Stability" value="High" tone="good" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LO Trend */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> LO Mastery Across Sessions
            </div>
            <div className="flex gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} /> LO Score</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} /> Engagement</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={sessionTrend}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="lesson" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="lo" stroke="var(--teal)" strokeWidth={3} dot={{ fill: "var(--teal)", r: 4 }} />
                <Line type="monotone" dataKey="eng" stroke="var(--amber)" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: "var(--amber)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stability */}
        <div className="glass rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="text-sm font-semibold flex items-center gap-2 self-start">
            <Activity className="h-4 w-4 text-primary" /> Stability Analysis
          </div>
          <div className="my-6">
            <MasteryRing value={82} size={170} label="Stability" sublabel="High consistency" />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full text-left">
            <div className="rounded-lg p-3 border border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Std Dev</div>
              <div className="font-display text-2xl font-bold">{stdDev}</div>
            </div>
            <div className="rounded-lg p-3 border border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Variance</div>
              <div className="font-display text-2xl font-bold">{variance}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Correlation scatter */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Emotion vs. Performance Correlation</div>
          <div className="text-xs text-muted-foreground">r = 0.71 · strong positive</div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="emotion" name="Positive emotion %" stroke="var(--muted-foreground)" fontSize={11}
                     label={{ value: "Positive Emotion %", position: "insideBottom", offset: -5, fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis type="number" dataKey="score" name="LO Score" stroke="var(--muted-foreground)" fontSize={11}
                     label={{ value: "LO Score %", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
              <ZAxis dataKey="z" range={[60, 60]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Scatter data={scatter} fill="var(--teal)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lesson breakdown */}
      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Lesson-by-Lesson Breakdown
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Lesson</th>
                <th className="py-3 pr-4">Topic</th>
                <th className="py-3 pr-4">LO Score</th>
                <th className="py-3 pr-4">Dominant Emotion</th>
                <th className="py-3 pr-4">Engagement</th>
                <th className="py-3 pr-4">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-card/40">
                  <td className="py-3 pr-4 font-mono text-muted-foreground">{l.id}</td>
                  <td className="py-3 pr-4 font-medium">{l.title}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full" style={{ width: `${l.lo}%`, background: "var(--gradient-primary)" }} />
                      </div>
                      <span className="font-mono text-xs">{l.lo}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4"><EmotionBadge emotion={l.emotion} size="sm" /></td>
                  <td className="py-3 pr-4 font-mono text-xs">{l.eng}%</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground italic">{l.rec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const color = tone === "good" ? "var(--emotion-happy)" : tone === "warn" ? "var(--emotion-confused)" : "var(--teal)";
  return (
    <div className="rounded-xl px-4 py-3 border border-border min-w-[100px]"
         style={{ background: `color-mix(in oklab, ${color} 8%, transparent)` }}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
