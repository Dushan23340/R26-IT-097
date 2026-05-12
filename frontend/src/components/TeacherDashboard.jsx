import { useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Monitor,
  Users,
  Bell,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  FileText,
  MessageSquare,
  Calendar,
  Plus,
  Link,
  Play,
  PhoneOff,
  Eye,
  Target,
  Award,
  Clock,
  Zap,
  Gamepad2,
  Brain,
  BarChart3,
  RefreshCw,
  Send,
  Trophy,
  Timer,
  PartyPopper,
  Activity,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { EMOTIONS } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";
import { emotionApi } from "@/lib/emotionApi";

const SUBJECTS = ["General", "Mathematics", "Science", "English", "History", "Programming"];

function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [studentsJoined, setStudentsJoined] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");

  // Real data from FastAPI backend
  const [analytics, setAnalytics] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [effectiveness, setEffectiveness] = useState(null);
  const [pendingInterventions, setPendingInterventions] = useState([]);
  const [variationWindow, setVariationWindow] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  // Pattern & trend data
  const [pattern, setPattern] = useState(null);
  const [trend, setTrend] = useState(null);

  // Game session state
  const [activeGame, setActiveGame] = useState(null);
  const [gameTimer, setGameTimer] = useState(0);
  const [gameStatus, setGameStatus] = useState("idle"); // idle, running, completed
  const [studentMessage, setStudentMessage] = useState(null);

  // Fetch analytics periodically when live
  useEffect(() => {
    if (!isLive) return;
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchPending();
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Initial fetch
  useEffect(() => {
    fetchEffectiveness();
    fetchPending();
    fetchVariationWindow();
    fetchPattern();
    fetchTrend();
  }, []);

  // Fetch pattern & trend when live
  useEffect(() => {
    if (!isLive) return;
    fetchPattern();
    fetchTrend();
    const interval = setInterval(() => {
      fetchPattern();
      fetchTrend();
    }, 10000);
    return () => clearInterval(interval);
  }, [isLive]);

  async function fetchAnalytics() {
    try {
      const data = await emotionApi.getCurrentAnalytics();
      setAnalytics(data);
      setError(null);
    } catch (e) {
      setError("Backend unreachable. Is the emotion service running on port 8000?");
    }
  }

  async function fetchEffectiveness() {
    try {
      const data = await emotionApi.getEffectiveness();
      setEffectiveness(data);
    } catch (e) {
      console.error("Failed to fetch effectiveness", e);
    }
  }

  async function fetchPending() {
    try {
      const data = await emotionApi.getPendingInterventions();
      setPendingInterventions(data.pending || []);
    } catch (e) {
      console.error("Failed to fetch pending", e);
    }
  }

  async function fetchVariationWindow() {
    try {
      const data = await emotionApi.getVariationWindow();
      setVariationWindow(data);
    } catch (e) {
      console.error("Failed to fetch variation window", e);
    }
  }

  async function fetchPattern() {
    try {
      const data = await emotionApi.getPattern();
      setPattern(data);
    } catch (e) {
      console.error("Failed to fetch pattern", e);
    }
  }

  async function fetchTrend() {
    try {
      const data = await emotionApi.getTrend(10);
      setTrend(data);
    } catch (e) {
      console.error("Failed to fetch trend", e);
    }
  }

  async function handleGenerateRecommendation() {
    setLoading((l) => ({ ...l, rec: true }));
    try {
      const dominant = analytics?.dominant_emotion || "BORED";
      const data = await emotionApi.generateRecommendation(dominant, selectedSubject);
      setRecommendation(data);
      await fetchVariationWindow();
      await fetchPending();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading((l) => ({ ...l, rec: false }));
    }
  }

  async function handleSubmitFeedback(interventionId) {
    setLoading((l) => ({ ...l, [interventionId]: true }));
    try {
      await fetchAnalytics();
      const post = {};
      if (analytics && analytics.distribution) {
        analytics.distribution.forEach((d) => {
          post[d.emotion] = d.percentage;
        });
      }
      await emotionApi.submitFeedback(interventionId, post);
      await fetchPending();
      await fetchEffectiveness();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading((l) => ({ ...l, [interventionId]: false }));
    }
  }

  const GAME_ROUTE_MAP = {
    gm_math_bored_03: "/fraction-room",
  };

  function handleLaunchGame() {
    if (!recommendation) return;

    const gameRoute = GAME_ROUTE_MAP[recommendation.recommendation?.game_id];
    if (gameRoute) {
      router.navigate({ to: gameRoute });
      return;
    }

    const duration = recommendation.recommendation?.estimated_duration_minutes || 5;
    setActiveGame(recommendation);
    setGameTimer(duration * 60); // seconds
    setGameStatus("running");
    setStudentMessage({
      type: "start",
      title: `Game Started: ${recommendation.recommendation.title}`,
      body: "Good luck! Do your best!",
    });
    setTimeout(() => setStudentMessage(null), 5000);
  }

  function handleCompleteGame() {
    if (!activeGame) return;
    setGameStatus("completed");
    setStudentMessage({
      type: "win",
      title: "Congratulations!",
      body: `You completed "${activeGame.recommendation.title}"! Great job!`,
    });
    // Auto-submit feedback
    if (activeGame.intervention_id) {
      handleSubmitFeedback(activeGame.intervention_id);
    }
    setActiveGame(null);
    setGameTimer(0);
    setTimeout(() => setStudentMessage(null), 8000);
  }

  // Game countdown timer
  useEffect(() => {
    if (gameStatus !== "running" || gameTimer <= 0) return;
    const interval = setInterval(() => {
      setGameTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          handleCompleteGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus, gameTimer]);

  // Build emotion distribution map from analytics
  const emotionMap = {};
  if (analytics && analytics.distribution) {
    analytics.distribution.forEach((d) => {
      const key = d.emotion.toLowerCase();
      emotionMap[key] = d.percentage;
    });
  }

  const handleStartClass = () => {
    setIsLive(true);
    setStudentsJoined(18);
    fetchAnalytics();
  };
  const handleEndClass = () => {
    setIsLive(false);
    setIsSharingScreen(false);
    setStudentsJoined(0);
  };
  const handleShareScreen = () => {
    setIsSharingScreen(!isSharingScreen);
  };
  const students = [
    { id: "1", name: "Aisha K.", emotion: "happy", status: "active", score: 85 },
    { id: "2", name: "Ben R.", emotion: "confused", status: "active", score: 62 },
    { id: "3", name: "Chen W.", emotion: "happy", status: "active", score: 90 },
    { id: "4", name: "Diya P.", emotion: "neutral", status: "active", score: 75 },
    { id: "5", name: "Eli M.", emotion: "bored", status: "inactive", score: 55 },
    { id: "6", name: "Fatima A.", emotion: "happy", status: "active", score: 88 },
    { id: "7", name: "Gabe S.", emotion: "confused", status: "active", score: 60 },
    { id: "8", name: "Hana L.", emotion: "neutral", status: "active", score: 72 },
    { id: "9", name: "Ivan O.", emotion: "happy", status: "active", score: 82 },
    { id: "10", name: "Jules N.", emotion: "frustrated", status: "inactive", score: 48 },
    { id: "11", name: "Kavi T.", emotion: "happy", status: "active", score: 87 },
    { id: "12", name: "Lina B.", emotion: "neutral", status: "active", score: 70 }
  ];
  const alerts = [
    {
      id: "1",
      message: "High confusion detected (20%) - Consider explaining again",
      type: "warning",
      time: "2 min ago"
    },
    {
      id: "2",
      message: "3 students showing frustration - May need individual help",
      type: "danger",
      time: "5 min ago"
    },
    {
      id: "3",
      message: "Engagement dropped - Start a quick activity",
      type: "warning",
      time: "10 min ago"
    }
  ];
  const smartSuggestions = [
    {
      id: "1",
      message: "20% of students are confused - Explain the concept again with examples",
      action: "Show Recap Material",
      icon: "alert"
    },
    {
      id: "2",
      message: "Engagement is dropping - Start an interactive quiz to re-engage",
      action: "Launch Quick Quiz",
      icon: "game"
    },
    {
      id: "3",
      message: "Most students are doing well - Introduce advanced challenge",
      action: "Add Challenge Question",
      icon: "lightbulb"
    }
  ];
  const upcomingClasses = [
    {
      id: "1",
      subject: "Physics - Mechanics",
      time: "2:00 PM Today",
      students: 24,
      link: "abc-123-xyz"
    },
    {
      id: "2",
      subject: "Math - Calculus",
      time: "10:00 AM Tomorrow",
      students: 28,
      link: "def-456-uvw"
    }
  ];
  const classStats = {
    averageScore: 74,
    weakTopics: ["Quadratic Equations", "Newton's Third Law", "Chemical Bonding"],
    overallProgress: 68
  };
  return <div className="space-y-6 stagger-children max-w-7xl mx-auto">
      {
    /* Alerts Panel */
  }
      {showAlerts && <div className="fixed top-20 right-6 z-50 w-96 glass rounded-2xl shadow-2xl border border-border/60">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Real-Time Alerts
            </h3>
            <button
    onClick={() => setShowAlerts(false)}
    className="p-1 hover:bg-secondary rounded-full"
  >
              ×
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.map((alert) => <div key={alert.id} className="p-4 border-b border-border/40 last:border-b-0">
                <div className="flex gap-3">
                  {alert.type === "danger" && <AlertTriangle className="h-5 w-5 text-emotion-angry flex-shrink-0 mt-0.5" />}
                  {alert.type === "warning" && <AlertTriangle className="h-5 w-5 text-emotion-confused flex-shrink-0 mt-0.5" />}
                  {alert.type === "info" && <Bell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              </div>)}
          </div>
        </div>}

      {
    /* 1. Live Class Control Panel */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold mb-2">
              Teacher Dashboard 👨‍🏫
            </h1>
            <p className="text-muted-foreground mb-4">
              {isLive ? "Live class in progress" : "Ready to start your next class"}
            </p>

            {
    /* Class Status */
  }
            <div className="flex items-center gap-4 mb-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isLive ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                <div className={`h-2 w-2 rounded-full ${isLive ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`} />
                {isLive ? "LIVE" : "Not Started"}
              </div>
              {isLive && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{studentsJoined} students joined</span>
                </div>}
            </div>

            {
    /* Control Buttons */
  }
            <div className="flex flex-wrap gap-3">
              {!isLive ? <button
    onClick={handleStartClass}
    className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-105"
    style={{
      background: "var(--gradient-primary)",
      color: "var(--primary-foreground)",
      boxShadow: "var(--shadow-glow)"
    }}
  >
                  <Play className="h-4 w-4" />
                  Start Class
                </button> : <>
                  <button
    onClick={handleShareScreen}
    className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-105 ${isSharingScreen ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}`}
  >
                    <Monitor className="h-4 w-4" />
                    {isSharingScreen ? "Sharing Screen" : "Share Screen"}
                  </button>
                  <button
    onClick={handleEndClass}
    className="px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
  >
                    <PhoneOff className="h-4 w-4" />
                    End Class
                  </button>
                </>}
            </div>
          </div>

          {
    /* Notifications Bell */
  }
          <button
    onClick={() => setShowAlerts(!showAlerts)}
    className="relative p-3 rounded-full glass hover:scale-105 transition-transform"
  >
            <Bell className="h-6 w-6" />
            {alerts.length > 0 && <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-destructive border-2 border-background" />}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Pattern Detection Alert */}
      {pattern && pattern.pattern_detected && (
        <div className="glass rounded-2xl p-4 border border-amber/30 bg-amber/5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber">
                Persistent Pattern Detected: {pattern.detected_emotion}
              </p>
              <p className="text-xs text-muted-foreground">
                This emotion has persisted above threshold for 2 consecutive aggregation cycles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Real-Time Emotion Summary */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Class Emotion Overview
          </h2>
          {analytics && (
            <div className="text-sm text-muted-foreground">
              Dominant: <span className="font-semibold text-foreground">{analytics.dominant_emotion}</span> ({analytics.dominant_percentage}%)
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {analytics && analytics.distribution ? (
            analytics.distribution.map((item) => {
              const key = item.emotion.toLowerCase();
              const e = EMOTIONS[key] || { emoji: "❓", label: item.emotion, color: "#888" };
              return (
                <div
                  key={item.emotion}
                  className="p-4 rounded-xl border border-border/60 text-center"
                  style={{ background: `${e.color}08` }}
                >
                  <div className="text-3xl mb-1">{e.emoji}</div>
                  <p className="text-xs font-semibold mb-1">{e.label}</p>
                  <p className="text-xl font-bold" style={{ color: e.color }}>
                    {item.percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">{item.count} students</p>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              {isLive ? (
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              ) : (
                <>
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Start a class to see real-time emotion analytics</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2b. Emotion Trend Chart */}
      {trend && trend.snapshots && trend.snapshots.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Emotion Trend (Last {trend.count} Snapshots)
            </h2>
          </div>
          <div className="space-y-3">
            {trend.snapshots.map((snap, idx) => {
              const dist = snap.distribution || {};
              const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                    {new Date(snap.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1 h-6 rounded-full bg-secondary overflow-hidden flex">
                    {Object.entries(dist).map(([emotion, pct]) => {
                      const key = emotion.toLowerCase();
                      const e = EMOTIONS[key] || { color: "#888" };
                      return (
                        <div
                          key={emotion}
                          className="h-full transition-all"
                          style={{
                            width: `${(pct / total) * 100}%`,
                            background: e.color,
                          }}
                          title={`${emotion}: ${pct}%`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs font-medium w-20 text-right">
                    {snap.dominant_emotion}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Engagement Score Banner */}
      {analytics && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-secondary"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-emotion-happy"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${analytics.class_engagement_score}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold">{Math.round(analytics.class_engagement_score)}%</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Class Engagement Score</h3>
                <p className="text-sm text-muted-foreground">
                  {analytics.active_students} of {analytics.total_students} students active
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Window</p>
              <p className="text-sm font-semibold">{analytics.window_seconds}s</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Effectiveness Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Avg. Emotion Reduction
          </h3>
          <div className="text-center">
            <div className={`text-5xl font-bold mb-2 ${effectiveness && effectiveness.target_met ? "text-emotion-happy" : "text-emotion-confused"}`}>
              {effectiveness ? `${effectiveness.average_reduction_pct}%` : "--"}
            </div>
            <p className="text-sm text-muted-foreground">
              Target: {effectiveness ? effectiveness.target_reduction_pct : 20}% minimum
            </p>
            {effectiveness && effectiveness.target_met && (
              <p className="text-xs text-emotion-happy mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Target met!
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Interventions
          </h3>
          <div className="text-center mb-3">
            <div className="text-5xl font-bold mb-2">
              {effectiveness ? effectiveness.completed_interventions : 0}
              <span className="text-lg text-muted-foreground">/{effectiveness ? effectiveness.total_interventions : 0}</span>
            </div>
            <p className="text-sm text-muted-foreground">Completed / Total</p>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-primary"
              style={{
                width: effectiveness && effectiveness.total_interventions > 0
                  ? `${(effectiveness.completed_interventions / effectiveness.total_interventions) * 100}%`
                  : "0%"
              }}
            />
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Variation Window
          </h3>
          <div className="space-y-2">
            {variationWindow && variationWindow.blocked_game_types.length > 0 ? (
              variationWindow.blocked_game_types.map((gt, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span>{gt} (blocked)</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emotion-happy/5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emotion-happy flex-shrink-0" />
                <span>All game types available</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Window: {variationWindow ? variationWindow.window_minutes : 30} minutes
            </p>
          </div>
        </div>
      </div>

      {
    /* 4. Student List */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Students ({students.length})
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-emotion-happy" />
            <span>{students.filter((s) => s.status === "active").length} Active</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {students.map((student) => {
    const e = EMOTIONS[student.emotion];
    return <div
      key={student.id}
      className={`p-3 rounded-xl border transition-all hover:scale-105 ${student.status === "inactive" ? "opacity-50" : ""}`}
      style={{
        borderColor: `${e.color}30`,
        background: `${e.color}08`
      }}
    >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl">{e.emoji}</div>
                  <div className={`h-2 w-2 rounded-full ${student.status === "active" ? "bg-emotion-happy" : "bg-muted-foreground"}`} />
                </div>
                <p className="text-sm font-medium truncate mb-1">{student.name}</p>
                <p className="text-xs" style={{ color: e.color }}>{e.label}</p>
              </div>;
  })}
        </div>
      </div>

      {/* 5. Game Recommendation Panel */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Game Recommendation Engine
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border border-border bg-background"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleGenerateRecommendation}
              disabled={loading.rec}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading.rec ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Recommend
            </button>
          </div>
        </div>

        {recommendation ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{recommendation.trigger_reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subject: <span className="font-medium text-foreground">{recommendation.subject}</span>
                  {" | "}Game Type: <span className="font-medium text-foreground">{recommendation.game_type}</span>
                  {" | "}ID: <span className="font-mono text-xs">{recommendation.intervention_id}</span>
                </p>
              </div>
            </div>

            {/* Primary Recommendation */}
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{recommendation.recommendation.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{recommendation.recommendation.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">{recommendation.recommendation.difficulty}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">{recommendation.recommendation.estimated_duration_minutes} min</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">Score: {recommendation.recommendation.engagement_score}</span>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleLaunchGame}
                      disabled={gameStatus === "running"}
                      className="inline-flex items-center gap-2 rounded-lg bg-emotion-happy px-4 py-2 text-sm font-semibold text-white hover:bg-emotion-happy/90 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      {recommendation.recommendation?.game_id === "gm_math_bored_03" ? `Start ${recommendation.recommendation.title}` : "Start Game"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Alternatives */}
            {recommendation.alternatives && recommendation.alternatives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">ALTERNATIVES</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendation.alternatives.map((alt) => (
                    <div key={alt.game_id} className="p-3 rounded-lg border border-border/60">
                      <p className="text-sm font-medium">{alt.title}</p>
                      <p className="text-xs text-muted-foreground">{alt.game_type} | {alt.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game Controls */}
            {gameStatus === "running" && activeGame && (
              <div className="p-4 rounded-xl border border-amber/30 bg-amber/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Timer className="h-5 w-5 text-amber animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold">Game in Progress</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(gameTimer / 60)}:{String(gameTimer % 60).padStart(2, "0")} remaining
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCompleteGame}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emotion-happy text-white hover:bg-emotion-happy/90 transition-colors flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4" />
                    Mark Complete
                  </button>
                </div>
              </div>
            )}

            {recommendation && gameStatus !== "running" && (
              <div className="flex gap-3">
                <button
                  onClick={handleLaunchGame}
                  disabled={gameStatus === "running"}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emotion-happy/10 text-emotion-happy hover:bg-emotion-happy/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {recommendation.recommendation?.game_id === "gm_math_bored_03" ? "Open Fraction Room" : "Start Game"}
                </button>
                <button
                  onClick={() => handleSubmitFeedback(recommendation.intervention_id)}
                  disabled={loading[recommendation.intervention_id]}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading[recommendation.intervention_id] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Record Result
                </button>
              </div>
            )}

            {/* Variation Window Info */}
            {variationWindow && variationWindow.blocked_game_types.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Blocked types (30min): {variationWindow.blocked_game_types.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Click "Recommend" to generate a subject-aware game suggestion</p>
          </div>
        )}
      </div>

      {/* 5b. Pending Interventions */}
      {pendingInterventions.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber" />
            Pending Interventions ({pendingInterventions.length})
          </h2>
          <div className="space-y-3">
            {pendingInterventions.map((inv) => (
              <div key={inv.intervention_id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                <div>
                  <p className="text-sm font-medium">{inv.game_title}</p>
                  <p className="text-xs text-muted-foreground">{inv.subject} | {new Date(inv.timestamp).toLocaleTimeString()}</p>
                </div>
                <button
                  onClick={() => handleSubmitFeedback(inv.intervention_id)}
                  disabled={loading[inv.intervention_id]}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emotion-happy/10 text-emotion-happy hover:bg-emotion-happy/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {loading[inv.intervention_id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Record Result
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {
    /* 6. Quick Actions */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <FileText className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Start Quiz</h3>
            <p className="text-sm text-muted-foreground">Launch a quick quiz for the class</p>
          </button>
          
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <Calendar className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Assign Activity</h3>
            <p className="text-sm text-muted-foreground">Give students a practice task</p>
          </button>
          
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <MessageSquare className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Send Message</h3>
            <p className="text-sm text-muted-foreground">Broadcast message to all students</p>
          </button>
        </div>
      </div>

      {
    /* 7. Class Management */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Class Management
          </h2>
          <button
    className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-2 transition-all hover:scale-105"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
            <Plus className="h-4 w-4" />
            Create New Class
          </button>
        </div>
        
        <div className="space-y-3">
          {upcomingClasses.map((cls) => <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-colors">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{cls.subject}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {cls.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {cls.students} students
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-mono">
                  <Link className="h-3 w-3" />
                  {cls.link}
                </div>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors">
                  Share Link
                </button>
              </div>
            </div>)}
        </div>
      </div>

      {/* Student Notification Overlay */}
      {studentMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
          <div
            className={`mx-4 p-4 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-bottom-4 ${
              studentMessage.type === "win"
                ? "bg-emotion-happy/10 border-emotion-happy/30"
                : "bg-primary/10 border-primary/30"
            }`}
          >
            {studentMessage.type === "win" ? (
              <PartyPopper className="h-6 w-6 text-emotion-happy flex-shrink-0 mt-0.5" />
            ) : (
              <Play className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`font-semibold ${studentMessage.type === "win" ? "text-emotion-happy" : "text-primary"}`}>
                {studentMessage.title}
              </h4>
              <p className="text-sm text-foreground mt-1">{studentMessage.body}</p>
            </div>
            <button
              onClick={() => setStudentMessage(null)}
              className="p-1 hover:bg-background rounded-full flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>;
}
export {
  TeacherDashboard
};
