import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Camera, Sparkles, BookOpen, PlayCircle, FileText, ChevronRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { EMOTIONS, type EmotionKey } from "@/lib/emotions";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MasteryRing } from "@/components/MasteryRing";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Learning — AdaptiveMind" },
      { name: "description", content: "Live emotion-aware adaptive learning view with real-time feedback and recommendations." },
      { property: "og:title", content: "Student Learning — AdaptiveMind" },
      { property: "og:description", content: "Live emotion-aware adaptive learning view." },
    ],
  }),
  component: SmartDashboard,
});

// Export the component for use in other files
export { StudentView };

const EMOTION_SEQUENCE: EmotionKey[] = ["neutral", "happy", "neutral", "confused", "confused", "bored", "neutral", "happy"];

function SmartDashboard() {
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

  // Redirect teachers to teacher dashboard
  if (user?.role === "teacher") {
    router.navigate({ to: "/teacher" });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show student dashboard for students
  return <StudentView />;
}

function StudentView() {
  const [tick, setTick] = useState(0);
  const [emotion, setEmotion] = useState<EmotionKey>("neutral");
  const [mastery, setMastery] = useState(64);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(87);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setEmotion(EMOTION_SEQUENCE[(tick + 1) % EMOTION_SEQUENCE.length]);
      setMastery((m) => Math.min(98, m + Math.random() * 1.5));
      setFaceConfidence(Math.round(85 + Math.random() * 10));
    }, 3000);
    return () => clearInterval(id);
  }, [tick]);

  const timeline = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        t: `${i}m`,
        engagement: 50 + Math.sin(i / 2) * 25 + Math.random() * 10,
        focus: 55 + Math.cos(i / 3) * 20 + Math.random() * 8,
      })),
    []
  );

  const question = {
    q: "What is the time complexity of binary search on a sorted array of n elements?",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    correct: 1,
  };

  const e = EMOTIONS[emotion];
  const recs = getRecommendations(emotion);

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Lesson 04 · Algorithms</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Searching & <span className="text-gradient-primary">Sorting</span></h1>
          <p className="text-muted-foreground mt-1 text-sm">Adaptive flow — content and pacing adjust to your real-time emotional state.</p>
        </div>
        <EmotionBadge emotion={emotion} pulse size="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webcam panel */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="h-4 w-4 text-primary" /> Live Emotion Feed
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emotion-frustrated animate-pulse" style={{ background: "var(--emotion-frustrated)" }} />
              REC · 12:24
            </div>
          </div>

          <div className="relative aspect-video rounded-xl overflow-hidden border border-border"
               style={{ background: "radial-gradient(ellipse at center, oklch(0.28 0.05 252) 0%, oklch(0.16 0.03 250) 70%)" }}>
            <div className="grid-texture absolute inset-0 opacity-40" />
            {/* simulated face */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[120px] opacity-90 drop-shadow-2xl" style={{ filter: `drop-shadow(0 0 30px ${e.color})` }}>
                {e.emoji}
              </div>
            </div>
            {/* face detection box */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-56 rounded-lg"
                 style={{ border: `2px dashed ${e.color}`, boxShadow: `0 0 24px ${e.color}` }}>
              <div className="absolute -top-7 left-0 text-[11px] font-mono px-2 py-0.5 rounded"
                   style={{ background: e.color, color: "var(--background)" }}>
                FACE · {faceConfidence}%
              </div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <EmotionBadge emotion={emotion} pulse />
              <div className="text-[11px] font-mono text-muted-foreground bg-background/60 px-2 py-1 rounded">
                model: ResNet-Aff · {tick * 3}s
              </div>
            </div>
          </div>

          {/* Timeline chart */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Emotion Timeline</div>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--teal)" }} /> Engagement</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} /> Focus</span>
              </div>
            </div>
            <div className="h-36">
              <ResponsiveContainer>
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="engagement" stroke="var(--teal)" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="focus" stroke="var(--amber)" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* LO Mastery */}
        <div className="glass rounded-2xl p-5 flex flex-col">
          <div className="text-sm font-semibold mb-1">Learning Outcome</div>
          <div className="text-xs text-muted-foreground mb-4">LO-3.2 · Apply divide-and-conquer to search problems</div>
          <div className="flex-1 flex items-center justify-center py-4">
            <MasteryRing value={mastery} size={180} label="Mastery" sublabel={mastery >= 75 ? "On Track" : "Building"} />
          </div>
          <div className="space-y-2 mt-4">
            {[
              { label: "Concept understanding", v: 82 },
              { label: "Algorithm tracing", v: 67 },
              { label: "Complexity analysis", v: 54 },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono">{s.v}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.v}%`, background: "var(--gradient-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adaptive Quiz */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber" style={{ color: "var(--amber)" }} />
              <span className="text-sm font-semibold">Adaptive Quiz</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-2">Question 3 of 8</span>
            </div>
            <span className="text-xs text-muted-foreground">Difficulty auto-tuned to {e.label.toLowerCase()}</span>
          </div>

          <h3 className="font-display text-xl font-semibold mb-5">{question.q}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((opt, i) => {
              const isSel = selected === i;
              const isCorrect = submitted && i === question.correct;
              const isWrong = submitted && isSel && i !== question.correct;
              return (
                <button
                  key={i}
                  onClick={() => !submitted && setSelected(i)}
                  className="text-left p-4 rounded-xl border transition-all flex items-center justify-between group"
                  style={{
                    borderColor: isCorrect ? "var(--emotion-happy)" : isWrong ? "var(--emotion-angry)" : isSel ? "var(--teal)" : "var(--border)",
                    background: isCorrect ? "color-mix(in oklab, var(--emotion-happy) 12%, transparent)" :
                                isWrong ? "color-mix(in oklab, var(--emotion-angry) 12%, transparent)" :
                                isSel ? "color-mix(in oklab, var(--teal) 12%, transparent)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-mono border border-border">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </span>
                  {isCorrect && <CheckCircle2 className="h-5 w-5" style={{ color: "var(--emotion-happy)" }} />}
                  {isWrong && <XCircle className="h-5 w-5" style={{ color: "var(--emotion-angry)" }} />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div
              className="text-xs px-3 py-2 rounded-lg flex-1"
              style={{
                background: `color-mix(in oklab, ${e.color} 10%, transparent)`,
                color: e.color,
                border: `1px solid color-mix(in oklab, ${e.color} 30%, transparent)`,
              }}
            >
              {feedbackFor(emotion)}
            </div>
            <button
              disabled={selected === null}
              onClick={() => setSubmitted(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
            >
              Submit
            </button>
          </div>
        </div>

        {/* Recommendations */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Recommended for you</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Tuned to your <span style={{ color: e.color }}>{e.label.toLowerCase()}</span> state
          </p>
          <div className="space-y-3">
            {recs.map((r, i) => (
              <a key={i} className="block group cursor-pointer p-3 rounded-xl border border-border hover:border-primary/50 transition-all"
                 style={{ background: "color-mix(in oklab, var(--card) 50%, transparent)" }}>
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: "var(--gradient-primary)", opacity: 0.9 }}>
                    {r.icon === "video" ? <PlayCircle className="h-5 w-5 text-primary-foreground" /> : <FileText className="h-5 w-5 text-primary-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">{r.meta}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground self-center group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function feedbackFor(e: EmotionKey): string {
  switch (e) {
    case "happy": return "🎉 You're in flow — keep going! Difficulty nudged up slightly.";
    case "neutral": return "✓ Steady focus detected. Maintaining current pace.";
    case "confused": return "💡 Detected confusion — switching to a guided walkthrough.";
    case "bored": return "⚡ Engagement dipping — injecting an interactive challenge.";
    case "frustrated": return "🌿 Take a breath. Reducing difficulty and offering a hint.";
    case "angry": return "🛑 Suggesting a 2-minute break before continuing.";
  }
}

function getRecommendations(e: EmotionKey) {
  const base = [
    { icon: "video", title: "Binary Search Visualized", meta: "4 min · MIT OpenCourseWare" },
    { icon: "doc", title: "Practice Set: Search Trees", meta: "8 problems · Adaptive" },
    { icon: "video", title: "Big-O in Plain English", meta: "6 min · Khan Academy" },
  ];
  if (e === "confused" || e === "frustrated") {
    return [
      { icon: "video", title: "Step-by-Step Walkthrough", meta: "Slower pace · 5 min" },
      { icon: "doc", title: "Visual Cheatsheet", meta: "1-page summary" },
      { icon: "video", title: "Beginner-friendly Recap", meta: "8 min" },
    ];
  }
  if (e === "bored") {
    return [
      { icon: "video", title: "🎮 Algorithm Battle Game", meta: "Interactive · 10 min" },
      { icon: "doc", title: "Real-world Case Study", meta: "Google Maps routing" },
      { icon: "video", title: "Speed-Run Challenge", meta: "Beat the clock!" },
    ];
  }
  return base;
}
