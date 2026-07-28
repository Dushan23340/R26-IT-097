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
import { Activity, TrendingUp, Calendar, RefreshCw, AlertTriangle, Sparkles, Mail, ShieldCheck, Users, Scale, Gamepad2, Clock, Video } from "lucide-react";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MasteryRing } from "@/components/MasteryRing";
import { studentProfileApi } from "@/lib/studentProfileApi";
import { emotionApi } from "@/lib/emotionApi";
import { toEmotionKey } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";

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

// Quiz-taking (lessons.jsx) never turns on webcam emotion capture, so
// emotional_states rows only ever exist for real "Join Live Class"
// sessions (lesson_id="live-class" - see emotion-backend's
// student_profile_bridge.create_session). Grouped separately from
// buildSessionRows above, which is quiz-score-scoped and would otherwise
// silently drop these (it only creates a row per lo_history entry).
function buildLiveClassSessions(emotionalStates) {
  const bySession = new Map();

  for (const row of emotionalStates) {
    if (row.lesson_id !== "live-class") continue;
    const sid = row.session_id;
    if (!bySession.has(sid)) {
      bySession.set(sid, {
        session_id: sid,
        subject: row.lesson_title || "Live Class",
        start_time: row.start_time,
        emotionCounts: {},
        readingCount: 0,
      });
    }
    const bucket = bySession.get(sid);
    bucket.emotionCounts[row.emotion_label] = (bucket.emotionCounts[row.emotion_label] || 0) + 1;
    bucket.readingCount += 1;
  }

  return Array.from(bySession.values())
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    .map((s) => {
      const emotionEntries = Object.entries(s.emotionCounts);
      const dominantEmotion = emotionEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const negativeCount = emotionEntries
        .filter(([label]) => NEGATIVE_EMOTIONS.has(label.toLowerCase()))
        .reduce((sum, [, c]) => sum + c, 0);
      const negativePct = s.readingCount > 0 ? Math.round((negativeCount / s.readingCount) * 100) : null;

      return {
        session_id: s.session_id,
        subject: s.subject,
        start_time: s.start_time,
        dominantEmotion,
        negativePct,
        readingCount: s.readingCount,
      };
    });
}

// Route entry point - dispatches by role instead of unconditionally
// showing the student-analytics tool (which used to render for teachers
// too, defaulting to whichever student happened to be first in the list -
// confusing when a teacher expects to see their own account here).
function ProfileView() {
  const { user } = useAuth();
  if (user?.role === "teacher") {
    return <TeacherProfileCard user={user} />;
  }
  return <StudentAnalyticsView />;
}

// Real, no relative-time library in this project - short and good enough
// for an activity feed spanning minutes to a few days.
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function TeacherProfileCard({ user }) {
  const [overview, setOverview] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [effectiveness, setEffectiveness] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      studentProfileApi.getClassOverview(),
      studentProfileApi.getPendingRecommendations(),
      emotionApi.getEffectiveness(),
      emotionApi.getRecommendationHistory(10080), // last 7 days
    ])
      .then(([overviewData, pendingData, effData, historyData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setPendingCount((pendingData?.recommendations || []).length);
        setEffectiveness(effData);
        setHistory((historyData?.history || []).slice(-8).reverse());
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load class analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fairness = overview?.fairness;
  const strugglingAreas = (overview?.struggling_areas || []).slice().sort((a, b) => a.avg_score - b.avg_score);

  return (
    <div className="space-y-6 stagger-children">
      <div className="glass rounded-2xl p-6 flex flex-wrap items-center gap-6">
        <div
          className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-display font-bold flex-shrink-0"
          style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
        >
          {(user?.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Teacher Profile</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{user?.name || "Teacher"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user?.email}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Teacher</span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Students" value={overview ? String(overview.total_students) : "–"} tone="neutral" />
          <Stat label="At-Risk" value={overview ? String(overview.at_risk_count) : "–"} tone={overview?.at_risk_count > 0 ? "warn" : "good"} />
          <Stat label="Class Avg LO" value={overview?.avg_lo_score != null ? `${overview.avg_lo_score}%` : "–"} tone={overview?.avg_lo_score == null ? "neutral" : overview.avg_lo_score >= 75 ? "good" : overview.avg_lo_score >= 50 ? "warn" : "bad"} />
          <Stat label="Pending Insights" value={pendingCount != null ? String(pendingCount) : "–"} tone={pendingCount > 0 ? "warn" : "neutral"} />
        </div>
      </div>

      {error ? (
        <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error} (is analytics-service running on port 5010?)
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {
    /* Where the class is struggling - real, previously-unsurfaced data
       from analytics-service's class/overview (struggling_areas), broken
       down by Bloom's-taxonomy LO level across every student. */
  }
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" /> Where Your Class Is Struggling
          </div>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : strugglingAreas.length > 0 ? (
            <div className="space-y-3">
              {strugglingAreas.map((area) => (
                <div key={area.lo_level}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium capitalize">{area.lo_level}</span>
                    <span className="text-muted-foreground">{area.avg_score}% avg · {area.count} responses</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${area.avg_score}%`,
                        background: area.avg_score < 60 ? "var(--emotion-confused)" : area.avg_score < 75 ? "var(--emotion-bored, #f59e0b)" : "var(--gradient-primary)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No quiz data recorded across the class yet.</p>
          )}
        </div>

        {
    /* Fairness/equity snapshot - real disparate-impact analysis already
       computed by analytics-service but never shown anywhere in the UI
       until now. */
  }
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Scale className="h-4 w-4 text-primary" /> Fairness & Equity Snapshot
          </div>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : fairness?.available ? (
            <div>
              <div className={`text-xs font-medium mb-3 ${fairness.fair ? "text-emotion-happy" : "text-emotion-confused"}`}>
                {fairness.fair ? "No disparate impact detected across demographic groups." : `Flagged: ${fairness.flagged_groups.join(", ")}`}
              </div>
              <div className="space-y-2">
                {Object.entries(fairness.proficiency_rates).map(([group, rate]) => (
                  <div key={group} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{group}</span>
                    <span className="text-muted-foreground">
                      {Math.round(rate * 100)}% proficient · impact ratio {fairness.disparate_impact_ratios[group]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Acceptable range: {fairness.acceptable_range[0]}–{fairness.acceptable_range[1]} (4/5ths rule), mastery threshold {fairness.mastery_threshold}%.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not enough demographic data yet to compute fairness metrics.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {
    /* Intervention effectiveness - condensed version of the same real
       metric the Teacher Console tracks, for an at-a-glance summary here. */
  }
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" /> Intervention Effectiveness
          </div>
          {effectiveness ? (
            <div className="flex items-center gap-6">
              <div className={`text-4xl font-display font-bold ${effectiveness.target_met ? "text-emotion-happy" : "text-emotion-confused"}`}>
                {effectiveness.average_reduction_pct}%
              </div>
              <div className="text-xs text-muted-foreground">
                <div>avg. negative-emotion reduction</div>
                <div>target: {effectiveness.target_reduction_pct}% minimum</div>
                <div className="mt-1">{effectiveness.completed_interventions}/{effectiveness.total_interventions} interventions completed</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No interventions recorded yet.</p>
          )}
        </div>

        {
    /* Recent activity feed - real recommendation-engine history, not
       shown as a timeline anywhere else in the UI. */
  }
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Gamepad2 className="h-4 w-4 text-primary" /> Recently Assigned Games
          </div>
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-medium">{h.subject}</span>
                    <span className="text-muted-foreground"> · {h.game_type} · triggered by {h.emotion}</span>
                  </div>
                  <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0 ml-2">
                    <Clock className="h-3 w-3" /> {timeAgo(h.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No games assigned in the last 7 days.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" /> Looking for a specific student's learning analytics? Open Teacher Console to browse the class
        and start a recommendation - individual student profiles are viewed from there.
      </p>
    </div>
  );
}

function StudentAnalyticsView() {
  const { user } = useAuth();
  // Must match the student_id lessons.jsx/analytics_bridge.py use when
  // pushing quiz results, or this page looks up the wrong (or no) record.
  const selectedId = String(user?.id ?? user?._id ?? user?.email ?? "anonymous");

  const [ownProfile, setOwnProfile] = useState(null);
  const [history, setHistory] = useState(null);
  const [trend, setTrend] = useState(null);
  const [stability, setStability] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  // Grade/demographic display metadata only - this is NOT a student picker,
  // it just looks up this student's own row for header display. A student
  // who hasn't submitted a quiz yet won't have a row, which is fine.
  useEffect(() => {
    studentProfileApi
      .getStudents()
      .then((data) => {
        const own = (data.students || []).find((s) => s.student_id === selectedId);
        setOwnProfile(own || null);
      })
      .catch(() => {
        // best-effort - header just falls back to the auth user's name
      });
  }, [selectedId]);

  useEffect(() => {
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

  const liveClassSessions = useMemo(() => {
    if (!history) return [];
    return buildLiveClassSessions(history.emotional_states || []);
  }, [history]);

  const scatterData = useMemo(
    () =>
      sessionRows
        .filter((s) => s.negativePct != null)
        .map((s) => ({ negativePct: s.negativePct, score: s.lo, z: 100, label: s.label })),
    [sessionRows]
  );

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

  const displayName = ownProfile?.full_name || user?.name || selectedId;

  return <div className="space-y-6 stagger-children">
      {
    /* Header - always this student's own profile, never a picker */
  }
      <div className="glass rounded-2xl p-6 flex flex-wrap items-center gap-6">
        <div
    className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-display font-bold flex-shrink-0"
    style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
  >
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Student Profile</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{displayName}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {ownProfile?.grade_level || ""} {ownProfile?.demographic_group ? `· ${ownProfile.demographic_group}` : ""}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Avg LO" value={avgLo != null ? `${avgLo}%` : "–"} tone={avgLo == null ? "neutral" : avgLo >= 75 ? "good" : avgLo >= 50 ? "warn" : "bad"} />
          <Stat label="Sessions" value={String(sessionRows.length)} tone="neutral" />
          <Stat label="Stability" value={stabilityPercent != null ? (stabilityPercent >= 70 ? "High" : stabilityPercent >= 40 ? "Medium" : "Low") : "–"} tone={stabilityPercent == null ? "neutral" : stabilityPercent >= 70 ? "good" : "warn"} />
        </div>
      </div>

      {sessionRows.length === 0 && !loading && !error ? (
        <div className="glass rounded-2xl p-4 border border-primary/20 bg-primary/5 text-sm text-muted-foreground">
          No lesson data yet - take a quiz from Adaptive Learning and it'll show up here.
        </div>
      ) : null}

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
            <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground text-center px-6">
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>No emotion data tied to a quiz session yet.</span>
                  <span className="text-xs mt-1">Quiz-taking doesn't capture webcam emotion - see Live Class Emotion History below for real emotion data from joined classes.</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {
    /* Live Class Emotion History - real emotion data from "Join Live
       Class" sessions, kept separate from the quiz-score correlation
       chart above since quiz-taking itself never captures emotion. */
  }
      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Video className="h-4 w-4 text-primary" /> Live Class Emotion History
        </div>
        {liveClassSessions.length > 0 ? (
          <div className="space-y-2">
            {liveClassSessions.map((s) => (
              <div key={s.session_id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 text-sm">
                <div>
                  <div className="font-medium">{s.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.start_time).toLocaleString()} · {s.readingCount} reading{s.readingCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {toEmotionKey(s.dominantEmotion) ? <EmotionBadge emotion={toEmotionKey(s.dominantEmotion)} size="sm" /> : <span className="text-xs text-muted-foreground">–</span>}
                  <span className="text-xs font-mono text-muted-foreground w-14 text-right">
                    {s.negativePct != null ? `${s.negativePct}% neg` : "–"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No live-class sessions joined yet - emotion capture only runs while joined to a teacher's live class (webcam on).
          </p>
        )}
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
