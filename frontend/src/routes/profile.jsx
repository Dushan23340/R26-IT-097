import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import { Activity, TrendingUp, Calendar, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MasteryRing } from "@/components/MasteryRing";
import { studentProfileApi } from "@/lib/studentProfileApi";
import { toEmotionKey } from "@/lib/emotions";

const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Student Analytics — AdaptiveMind" },
      { name: "description", content: "Multi-session learning outcomes, emotion-performance correlation, and stability analytics." },
      { property: "og:title", content: "Student Analytics — AdaptiveMind" },
      { property: "og:description", content: "Multi-session LO trends and emotion-performance correlation." }
    ]
  }),
  component: ProfileView
});

const NEGATIVE_EMOTIONS = new Set(["bored", "confused", "frustrated", "angry"]);

// The backend exposes std-dev directly (a stats engine, not a UI metric) -
// this is a display-only conversion to the 0-100 ring MasteryRing expects.
// std_dev of 0 -> 100% stability, std_dev >= 50 -> 0%. Not a backend value.
function stabilityToPercent(stdDev) {
  if (stdDev == null) return null;
  return Math.max(0, Math.min(100, Math.round(100 - stdDev * 2)));
}

// Groups raw lo_history + emotional_states rows (both session-scoped) into
// one row per session: avg LO score, dominant emotion, negative-emotion %.
function buildSessionRows(loHistory, emotionalStates) {
  const bySession = new Map();

  for (const row of loHistory) {
    const sid = row.session_id;
    if (!bySession.has(sid)) {
      bySession.set(sid, {
        session_id: sid,
        start_time: row.start_time,
        lesson_id: row.lesson_id,
        scores: [],
        emotionCounts: {},
      });
    }
    bySession.get(sid).scores.push(Number(row.score));
  }

  for (const row of emotionalStates) {
    const sid = row.session_id;
    const bucket = bySession.get(sid);
    if (!bucket) continue;
    bucket.emotionCounts[row.emotion_label] = (bucket.emotionCounts[row.emotion_label] || 0) + 1;
  }

  return Array.from(bySession.values())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .map((s, idx) => {
      const avgScore = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
      const emotionEntries = Object.entries(s.emotionCounts);
      const totalEmotions = emotionEntries.reduce((sum, [, c]) => sum + c, 0);
      const dominantEmotion = emotionEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const negativeCount = emotionEntries
        .filter(([label]) => NEGATIVE_EMOTIONS.has(label.toLowerCase()))
        .reduce((sum, [, c]) => sum + c, 0);
      const negativePct = totalEmotions > 0 ? Math.round((negativeCount / totalEmotions) * 100) : null;

      return {
        session_id: s.session_id,
        label: `L${idx + 1}`,
        lesson_id: s.lesson_id,
        lo: Math.round(avgScore),
        dominantEmotion,
        negativePct,
      };
    });
}

function ProfileView() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState(null);
  const [trend, setTrend] = useState(null);
  const [stability, setStability] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    studentProfileApi
      .getStudents()
      .then((data) => {
        const list = data.students || [];
        setStudents(list);
        if (list.length) setSelectedId(list[0].student_id);
        else setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to reach analytics-service");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      studentProfileApi.getStudentHistory(selectedId),
      studentProfileApi.getStudentTrend(selectedId),
      studentProfileApi.getStudentStability(selectedId),
      studentProfileApi.getStudentEmotionCorrelation(selectedId),
      studentProfileApi.getApprovedRecommendations(selectedId),
    ])
      .then(([historyData, trendData, stabilityData, correlationData, recsData]) => {
        if (cancelled) return;
        setHistory(historyData);
        setTrend(trendData);
        setStability(stabilityData);
        setCorrelation(correlationData);
        setRecommendations(recsData.recommendations || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load student analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const sessionRows = useMemo(() => {
    if (!history) return [];
    return buildSessionRows(history.lo_history || [], history.emotional_states || []);
  }, [history]);

  const scatterData = useMemo(
    () =>
      sessionRows
        .filter((s) => s.negativePct != null)
        .map((s) => ({ negativePct: s.negativePct, score: s.lo, z: 100, label: s.label })),
    [sessionRows]
  );

  const selectedStudent = students.find((s) => s.student_id === selectedId);
  const avgLo = sessionRows.length
    ? Math.round(sessionRows.reduce((sum, s) => sum + s.lo, 0) / sessionRows.length)
    : null;
  const stabilityPercent = stabilityToPercent(stability?.std_dev);

  const strongestCorrelation = correlation
    ? Object.entries(correlation)
        .filter(([, v]) => v.available && v.meaningful)
        .sort((a, b) => Math.abs(b[1].r) - Math.abs(a[1].r))[0]
    : null;

  async function handleAnalyze() {
    if (!selectedId) return;
    setAnalyzing(true);
    try {
      await studentProfileApi.analyzeStudent(selectedId);
      const recsData = await studentProfileApi.getApprovedRecommendations(selectedId);
      setRecommendations(recsData.recommendations || []);
    } catch (e) {
      setError(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return <div className="space-y-6 stagger-children">
      {
    /* Student selector + header */
  }
      <div className="glass rounded-2xl p-6 flex flex-wrap items-center gap-6">
        <div
    className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-display font-bold flex-shrink-0"
    style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
  >
          {(selectedStudent?.full_name || selectedId || "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Student Profile</div>
          {students.length > 0 ? (
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="font-display text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none cursor-pointer -ml-1"
            >
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>{s.full_name || s.student_id}</option>
              ))}
            </select>
          ) : (
            <h1 className="font-display text-2xl sm:text-3xl font-bold">{loading ? "Loading..." : "No students found"}</h1>
          )}
          <div className="text-sm text-muted-foreground mt-1">
            {selectedStudent?.grade_level || ""} {selectedStudent?.demographic_group ? `· ${selectedStudent.demographic_group}` : ""} · ID {selectedId}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Avg LO" value={avgLo != null ? `${avgLo}%` : "–"} tone={avgLo == null ? "neutral" : avgLo >= 75 ? "good" : avgLo >= 50 ? "warn" : "bad"} />
          <Stat label="Sessions" value={String(sessionRows.length)} tone="neutral" />
          <Stat label="Stability" value={stabilityPercent != null ? (stabilityPercent >= 70 ? "High" : stabilityPercent >= 40 ? "Medium" : "Low") : "–"} tone={stabilityPercent == null ? "neutral" : stabilityPercent >= 70 ? "good" : "warn"} />
        </div>
      </div>

      {error ? (
        <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error} (is analytics-service running on port 5010?)
        </div>
      ) : null}

      {trend?.available === false && !loading ? (
        <div className="glass rounded-2xl p-4 border border-amber/30 bg-amber/5 text-sm text-muted-foreground">
          Not enough sessions yet for trend analysis: {trend.reason}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {
    /* LO Trend */
  }
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> LO Mastery Across Sessions
              {trend?.available && (
                <span className="text-[11px] font-normal text-muted-foreground ml-2">
                  ({trend.direction}{trend.significant ? ", p=" + trend.p_value : ""})
                </span>
              )}
            </div>
          </div>
          <div className="h-72">
            {sessionRows.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={sessionRows}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="lo" stroke="var(--teal)" strokeWidth={3} dot={{ fill: "var(--teal)", r: 4 }} name="LO Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "No session data yet."}
              </div>
            )}
          </div>
        </div>

        {
    /* Stability */
  }
        <div className="glass rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="text-sm font-semibold flex items-center gap-2 self-start">
            <Activity className="h-4 w-4 text-primary" /> Stability Analysis
          </div>
          <div className="my-6">
            <MasteryRing value={stabilityPercent ?? 0} size={170} label="Stability" sublabel={stability?.available ? `std dev ${stability.std_dev}` : "insufficient data"} />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full text-left">
            <div className="rounded-lg p-3 border border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Std Dev</div>
              <div className="font-display text-2xl font-bold">{stability?.available ? stability.std_dev : "–"}</div>
            </div>
            <div className="rounded-lg p-3 border border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Variance</div>
              <div className="font-display text-2xl font-bold">{stability?.available ? stability.variance : "–"}</div>
            </div>
          </div>
        </div>
      </div>

      {
    /* Correlation scatter */
  }
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Negative Emotion % vs. Performance (per session)</div>
          <div className="text-xs text-muted-foreground">
            {strongestCorrelation
              ? `${strongestCorrelation[0]}: r = ${strongestCorrelation[1].r} · ${strongestCorrelation[1].direction}`
              : "no meaningful correlation detected yet"}
          </div>
        </div>
        <div className="h-72">
          {scatterData.length > 0 ? (
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
    type="number"
    dataKey="negativePct"
    name="Negative emotion %"
    stroke="var(--muted-foreground)"
    fontSize={11}
    domain={[0, 100]}
    label={{ value: "Negative Emotion %", position: "insideBottom", offset: -5, fill: "var(--muted-foreground)", fontSize: 11 }}
  />
                <YAxis
    type="number"
    dataKey="score"
    name="LO Score"
    stroke="var(--muted-foreground)"
    fontSize={11}
    domain={[0, 100]}
    label={{ value: "LO Score %", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }}
  />
                <ZAxis dataKey="z" range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Scatter data={scatterData} fill="var(--teal)" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "No emotion data recorded for this student yet."}
            </div>
          )}
        </div>
      </div>

      {
    /* Expert-in-the-loop recommendations */
  }
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Expert-Validated Recommendations
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedId}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {analyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
            Run Analysis
          </button>
        </div>
        {recommendations.length > 0 ? (
          <div className="space-y-2">
            {recommendations.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-border/60 text-sm">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.insight_type}</span>
                <p className="mt-1">{r.modified_text || r.recommendation_text}</p>
                <p className="text-xs text-muted-foreground mt-1">Reviewed by {r.reviewed_by}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No expert-approved recommendations yet. "Run Analysis" queues any statistically significant findings
            for advisor review (see the Admin → pending recommendations queue).
          </p>
        )}
      </div>

      {
    /* Lesson breakdown */
  }
      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Lesson-by-Lesson Breakdown
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">Session</th>
                <th className="py-3 pr-4">Lesson</th>
                <th className="py-3 pr-4">LO Score</th>
                <th className="py-3 pr-4">Dominant Emotion</th>
                <th className="py-3 pr-4">Negative %</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((s) => <tr key={s.session_id} className="border-b border-border/50 hover:bg-card/40">
                  <td className="py-3 pr-4 font-mono text-muted-foreground">{s.label}</td>
                  <td className="py-3 pr-4 font-medium">{s.lesson_id}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full" style={{ width: `${s.lo}%`, background: "var(--gradient-primary)" }} />
                      </div>
                      <span className="font-mono text-xs">{s.lo}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {toEmotionKey(s.dominantEmotion) ? <EmotionBadge emotion={toEmotionKey(s.dominantEmotion)} size="sm" /> : <span className="text-xs text-muted-foreground">–</span>}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{s.negativePct != null ? `${s.negativePct}%` : "–"}</td>
                </tr>)}
              {sessionRows.length === 0 && !loading ? (
                <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No sessions recorded yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
function Stat({ label, value, tone }) {
  const color = tone === "good" ? "var(--emotion-happy)" : tone === "warn" || tone === "bad" ? "var(--emotion-confused)" : "var(--teal)";
  return <div
    className="rounded-xl px-4 py-3 border border-border min-w-[100px]"
    style={{ background: `color-mix(in oklab, ${color} 8%, transparent)` }}
  >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold" style={{ color }}>{value}</div>
    </div>;
}
export {
  Route
};
