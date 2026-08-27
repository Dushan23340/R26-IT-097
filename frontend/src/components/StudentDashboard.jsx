import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Play,
  Calendar,
  BookOpen,
  FileText,
  TrendingUp,
  TrendingDown,
  Bell,
  Video,
  Monitor,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  X,
  CheckCircle2,
  Clock,
  Target,
  Award,
  AlertCircle,
  MousePointerClick,
  RefreshCw,
  ExternalLink,
  UserCheck
} from "lucide-react";
import { EMOTIONS } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { studentProfileApi } from "@/lib/studentProfileApi";
import { emotionApi } from "@/lib/emotionApi";
import EmotionDetector from "@/components/EmotionDetector";

const SUBJECT_MASTERY_THRESHOLD = 75; // matches mastery.py's MASTERY_THRESHOLD

const RESOURCE_TYPE_ICON = {
  video: Play,
  reading: BookOpen,
  interactive: MousePointerClick,
  quiz: FileText,
};
const RESOURCE_TYPE_ACTION = {
  video: "Watch Now",
  reading: "Read Article",
  interactive: "Try It",
  quiz: "Take Quiz",
};

function StudentDashboard() {
  const { user } = useAuth();
  const studentId = String(user?.id ?? user?._id ?? user?.email ?? "anonymous");
  const [emotion, setEmotion] = useState("neutral");
  const [attention, setAttention] = useState(87);
  const [engagement, setEngagement] = useState(92);
  const [inLiveClass, setInLiveClass] = useState(false);
  const [currentLiveClass, setCurrentLiveClass] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Real lessons (adaptive-learning backend) and real weak-LO resource
  // recommendations (analytics-service lookup + semantic_recommender) -
  // replaces the previously hardcoded, non-functional placeholder arrays.
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  // Statistically-grounded recommendations a teacher/advisor approved via
  // analytics-service's expert-in-the-loop queue (IT22197146 SO5/Figure 3) -
  // distinct from the weak-LO resource links above.
  const [advisorRecommendations, setAdvisorRecommendations] = useState([]);

  // Real per-session LO history from analytics-service, used to derive
  // Quick Stats and Your Progress below - replaces the previously
  // hardcoded "12 quizzes / 78% / 5 day streak" and per-subject numbers.
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    adaptiveApiService
      .getLessons()
      .then((res) => setLessons(res.data || []))
      .catch(() => setLessons([]))
      .finally(() => setLoadingLessons(false));

    adaptiveApiService
      .getStudentRecommendations(studentId)
      .then((res) => {
        setRecommendations(res.data?.recommendations || []);
        setAdvisorRecommendations(res.data?.advisor_recommendations || []);
      })
      .catch(() => {
        setRecommendations([]);
        setAdvisorRecommendations([]);
      })
      .finally(() => setLoadingRecommendations(false));

    studentProfileApi
      .getStudentHistory(studentId)
      .then((data) => setHistory(data))
      .catch(() => setHistory(null))
      .finally(() => setLoadingHistory(false));
  }, [studentId]);

  // Real "live class" equivalent: whatever the teacher has actually
  // broadcast right now via the Teacher Console's game recommendation
  // engine (GET /recommendation/active on emotion-backend) - replaces the
  // previously hardcoded, permanently-"live" fake schedule. There's no
  // real class-scheduling system in this platform, so "upcoming classes"
  // has no honest data source and isn't shown.
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  useEffect(() => {
    let cancelled = false;
    function poll() {
      emotionApi
        .getActiveRecommendation()
        .then((data) => {
          if (!cancelled) setActiveBroadcast(data?.active_game ? data : null);
        })
        .catch(() => {
          if (!cancelled) setActiveBroadcast(null);
        });
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Real live-class broadcast (distinct from the game broadcast above) -
  // the teacher's actual "Start Class" button on the Teacher Console,
  // not a fake permanently-live schedule. Joining turns on real webcam
  // emotion capture via the existing EmotionDetector flow below.
  const [classSession, setClassSession] = useState(null);
  useEffect(() => {
    let cancelled = false;
    function poll() {
      emotionApi
        .getClassSessionState()
        .then((data) => {
          if (!cancelled) setClassSession(data?.is_live ? data : null);
        })
        .catch(() => {
          if (!cancelled) setClassSession(null);
        });
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // classSession (the poll above) and inLiveClass/currentLiveClass (the
  // full-screen Live Class view's own gate, set by handleJoinClassSession/
  // the hang-up button) used to be two disconnected pieces of state - the
  // teacher ending the class flips classSession to null within 5s, but
  // nothing ever told inLiveClass to follow, so a joined student's screen
  // stayed stuck on "LIVE" forever until they manually hung up. This
  // brings them back to the dashboard within one poll cycle of the
  // teacher actually ending it.
  useEffect(() => {
    if (!classSession && inLiveClass) {
      setInLiveClass(false);
      setCurrentLiveClass(null);
    }
  }, [classSession, inLiveClass]);

  function handleJoinClassSession() {
    if (!classSession) return;
    emotionApi.joinClassSession(studentId, classSession.session_id, user?.name).catch(() => {
      // best-effort - joining the UI still works even if the join call fails
    });
    setInLiveClass(true);
    setCurrentLiveClass({ subject: classSession.subject, teacher: classSession.started_by });
  }

  // Real "Start Quiz" broadcast (Teacher Console Quick Actions) - same poll
  // pattern as the live-class broadcast above. Dismissible per broadcast_id
  // so it doesn't keep re-popping every 5s once the student has seen it.
  const [quizBroadcast, setQuizBroadcast] = useState(null);
  const [dismissedQuizBroadcastId, setDismissedQuizBroadcastId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    function poll() {
      emotionApi
        .getQuizBroadcastState()
        .then((data) => {
          if (!cancelled) setQuizBroadcast(data?.is_active ? data : null);
        })
        .catch(() => {
          if (!cancelled) setQuizBroadcast(null);
        });
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  const showQuizPrompt = quizBroadcast && quizBroadcast.broadcast_id !== dismissedQuizBroadcastId;

  // Real "Send Message" broadcast (Teacher Console Quick Actions) - same
  // poll + dismiss-by-broadcast_id pattern as the quiz broadcast above.
  const [messageBroadcast, setMessageBroadcast] = useState(null);
  const [dismissedMessageBroadcastId, setDismissedMessageBroadcastId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    function poll() {
      emotionApi
        .getMessageBroadcastState()
        .then((data) => {
          if (!cancelled) setMessageBroadcast(data?.is_active ? data : null);
        })
        .catch(() => {
          if (!cancelled) setMessageBroadcast(null);
        });
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  const showMessagePrompt = messageBroadcast && messageBroadcast.broadcast_id !== dismissedMessageBroadcastId;

  const lessonSubjectById = useMemo(() => {
    const map = {};
    lessons.forEach((l) => {
      map[l.lesson_id] = l.subject;
    });
    return map;
  }, [lessons]);

  // One row per session (averaging its LO-level scores), chronological -
  // the same grouping profile.jsx uses for its trend chart.
  const sessionAverages = useMemo(() => {
    if (!history?.lo_history?.length) return [];
    const bySession = new Map();
    for (const row of history.lo_history) {
      if (!bySession.has(row.session_id)) {
        bySession.set(row.session_id, { session_id: row.session_id, lesson_id: row.lesson_id, start_time: row.start_time, scores: [] });
      }
      bySession.get(row.session_id).scores.push(Number(row.score));
    }
    return Array.from(bySession.values())
      .map((s) => ({ ...s, avgScore: s.scores.reduce((a, b) => a + b, 0) / s.scores.length }))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [history]);

  const quizzesCompleted = sessionAverages.length;
  const avgScore = quizzesCompleted > 0
    ? Math.round(sessionAverages.reduce((sum, s) => sum + s.avgScore, 0) / quizzesCompleted)
    : null;

  // Consecutive most-recent calendar days (local time) with at least one
  // completed session, counting back from today.
  const studyStreak = useMemo(() => {
    if (sessionAverages.length === 0) return 0;
    const activeDays = new Set(sessionAverages.map((s) => new Date(s.start_time).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (activeDays.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [sessionAverages]);

  // Per-subject average, grouped via each session's lesson -> subject
  // (from the real lesson catalog, not a fixed subject list) - trend is
  // simply latest-session vs earliest-session average for that subject.
  const progressBySubject = useMemo(() => {
    const bySubject = new Map();
    for (const s of sessionAverages) {
      const subject = lessonSubjectById[s.lesson_id] || s.lesson_id;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(s);
    }
    return Array.from(bySubject.entries())
      .map(([subject, sessions]) => {
        const score = Math.round(sessions.reduce((sum, s) => sum + s.avgScore, 0) / sessions.length);
        let trend = "stable";
        if (sessions.length >= 2) {
          const delta = sessions[sessions.length - 1].avgScore - sessions[0].avgScore;
          trend = delta > 5 ? "up" : delta < -5 ? "down" : "stable";
        }
        return { subject, score, trend, weak: score < SUBJECT_MASTERY_THRESHOLD };
      })
      .sort((a, b) => b.score - a.score);
  }, [sessionAverages, lessonSubjectById]);

  const mapStudentStateToUiKey = (state) => {
    const s = (state || "").toLowerCase();
    if (s.includes("engaged")) return "engaged";
    if (s.includes("bored")) return "bored";
    if (s.includes("confused")) return "confused";
    if (s.includes("frustrated")) return "frustrated";
    if (s.includes("angry")) return "angry";
    return "neutral";
  };
  const notifications = [
    {
      id: "1",
      message: "Great job on your last quiz! \u{1F389}",
      type: "success",
      time: "2 hours ago"
    },
    {
      id: "2",
      message: "You need to improve in Chemistry - try the recommended practice",
      type: "warning",
      time: "5 hours ago"
    },
    {
      id: "3",
      message: "New live class scheduled for tomorrow at 10 AM",
      type: "info",
      time: "1 day ago"
    }
  ];
  const currentEmotion = EMOTIONS[emotion];
  if (inLiveClass && currentLiveClass) {
    return <div className="min-h-screen bg-background">
        {
      /* Live Class Header */
    }
        <div className="glass border-b border-border/60 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">{currentLiveClass.subject}</h2>
              <p className="text-sm text-muted-foreground">{currentLiveClass.teacher}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                LIVE
              </div>
              <button
      onClick={() => setShowNotifications(!showNotifications)}
      className="relative p-2 rounded-full hover:bg-secondary transition-colors"
    >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && <div className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />}
              </button>
            </div>
          </div>
        </div>

        {
      /* Screen Sharing Area */
    }
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {
      /* Main Screen Share */
    }
            <div className="lg:col-span-3">
              <div className="glass rounded-2xl overflow-hidden aspect-video relative">
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-background">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Teacher's Screen</p>
                    <p className="text-sm text-muted-foreground">Screen sharing in progress...</p>
                  </div>
                </div>
                
                {
      /* Controls */
    }
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <button
      onClick={() => setIsMuted(!isMuted)}
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                  <button
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    <Video className="h-5 w-5" />
                  </button>
                  <button
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    <Maximize2 className="h-5 w-5" />
                  </button>
                  <button
      onClick={() => {
        setInLiveClass(false);
        setCurrentLiveClass(null);
      }}
      className="p-3 rounded-full bg-destructive hover:bg-destructive/90 hover:scale-105 transition-transform"
    >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {
      /* Sidebar - Student Info & Emotion */
    }
            <div className="space-y-4">
              {
      /* Webcam & Emotion */
    }
              <div className="glass rounded-2xl p-4">
                <EmotionDetector
                  className="mb-3"
                  studentId={user?.id ?? user?._id ?? user?.email ?? "default_student"}
                  intervalMs={2500}
                  onEmotion={({ studentState, metrics }) => {
                    const nextState = studentState || "Unknown"
                    if (nextState === "No face detected") return;
                    setEmotion(mapStudentStateToUiKey(nextState))

                    const stability = Number(metrics?.stabilityScore || 0)
                    const transition = Number(metrics?.transitionRate || 0)
                    const counts = metrics?.emotionCounts || {}
                    const totalCount = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0) || 1
                    const negativeCount = Number(counts?.Bored || 0) + Number(counts?.Confused || 0) + Number(counts?.Frustrated || 0)
                    const negativeRatio = Math.min(1, negativeCount / totalCount)

                    setAttention(Math.max(10, Math.min(100, Math.round(70 + stability * 20 - transition * 10 - negativeRatio * 15))))
                    setEngagement(
                      Math.max(
                        10,
                        Math.min(
                          100,
                          Math.round(
                            Number(metrics?.engagementIndicators?.engagementScore || 0) ||
                              Math.round(60 + stability * 25 - negativeRatio * 20)
                          )
                        )
                      )
                    )
                  }}
                />
                <div className="text-center">
                  <p className="text-sm font-medium mb-1">You</p>
                  <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
      style={{
        background: `${currentEmotion.color}15`,
        color: currentEmotion.color
      }}
    >
                    <span>{currentEmotion.emoji}</span>
                    <span>{currentEmotion.label}</span>
                  </div>
                </div>
              </div>

              {
      /* Quick Stats */
    }
              <div className="glass rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attention</span>
                    <span className="font-medium">{attention}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Engagement</span>
                    <span className="font-medium">{engagement}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>;
  }
  return <div className="space-y-6 stagger-children max-w-7xl mx-auto">
      {
    /* Notifications Panel */
  }
      {showNotifications && <div className="fixed top-20 right-6 z-50 w-80 glass rounded-2xl shadow-2xl border border-border/60">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-secondary rounded-full">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => <div key={notif.id} className="p-4 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors">
                <div className="flex gap-3">
                  {notif.type === "success" && <CheckCircle2 className="h-5 w-5 text-emotion-happy flex-shrink-0 mt-0.5" />}
                  {notif.type === "warning" && <AlertCircle className="h-5 w-5 text-emotion-confused flex-shrink-0 mt-0.5" />}
                  {notif.type === "info" && <Bell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                  </div>
                </div>
              </div>)}
          </div>
        </div>}

      {
    /* 1. Top Header - Simple Summary */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold mb-2">
              Welcome back, {user?.name || "Student"}! 👋
            </h1>
            <p className="text-muted-foreground mb-4">Here's your learning overview for today</p>
            
            {
    /* Progress Bar */
  }
            <div className="max-w-md">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold">{loadingHistory || avgScore == null ? "–" : `${avgScore}%`}</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div
    className="h-full rounded-full transition-all duration-500"
    style={{
      width: `${avgScore ?? 0}%`,
      background: "var(--gradient-primary)"
    }}
  />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {avgScore == null
                  ? "Take a lesson quiz to see your progress"
                  : avgScore >= 70
                  ? "\u{1F389} Doing Well!"
                  : "\u{1F4AA} Keep Practicing!"}
              </p>
            </div>
          </div>

          {
    /* Emotion Indicator */
  }
          <div className="flex items-center gap-4">
            <div
    className="text-center px-6 py-4 rounded-xl"
    style={{ background: `${currentEmotion.color}10` }}
  >
              <div className="text-5xl mb-2">{currentEmotion.emoji}</div>
              <p className="text-sm font-medium" style={{ color: currentEmotion.color }}>
                {currentEmotion.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {
    /* Real live-class broadcast - the teacher's actual "Start Class" on
       the Teacher Console, not a fake permanently-live schedule. */
  }
      {classSession && (
        <div className="glass rounded-2xl p-6 border-2 border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <div>
              <p className="text-sm font-medium text-destructive">LIVE NOW</p>
              <h3 className="font-semibold text-lg">{classSession.subject}</h3>
              <p className="text-sm text-muted-foreground">{classSession.started_by}</p>
            </div>
          </div>
          <button
            onClick={handleJoinClassSession}
            className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-105"
            style={{
              background: "var(--gradient-primary)",
              color: "var(--primary-foreground)",
              boxShadow: "var(--shadow-glow)"
            }}
          >
            <Play className="h-4 w-4" />
            Join Live Class
          </button>
        </div>
      )}

      {
    /* Real "Start Quiz" broadcast from the Teacher Console's Quick
       Actions - dismissible, re-appears if the teacher starts a new one. */
  }
      {showQuizPrompt && (
        <div className="glass rounded-2xl p-6 border-2 border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-medium text-primary">QUIZ STARTED</p>
              <h3 className="font-semibold text-lg">{quizBroadcast.lesson_title}</h3>
              <p className="text-sm text-muted-foreground">{quizBroadcast.started_by}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/lessons"
              search={{ lesson_id: quizBroadcast.lesson_id }}
              className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-105"
              style={{
                background: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
                boxShadow: "var(--shadow-glow)"
              }}
            >
              <Play className="h-4 w-4" />
              Take Quiz Now
            </Link>
            <button
              onClick={() => setDismissedQuizBroadcastId(quizBroadcast.broadcast_id)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {
    /* Real "Send Message" broadcast from the Teacher Console's Quick
       Actions - dismissible, re-appears if the teacher sends a new one. */
  }
      {showMessagePrompt && (
        <div className="glass rounded-2xl p-6 border-2 border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-medium text-primary">MESSAGE FROM {(messageBroadcast.sent_by || "TEACHER").toUpperCase()}</p>
              <p className="text-base">{messageBroadcast.message}</p>
            </div>
          </div>
          <button
            onClick={() => setDismissedMessageBroadcastId(messageBroadcast.broadcast_id)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Live Activity
            </h2>
          </div>

          {
    /* Real teacher-broadcast game (GET /recommendation/active), not a
       fake video-call schedule - there's no real class-scheduling system
       to show an "upcoming classes" list from. */
  }
          {activeBroadcast ? (
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium text-destructive">LIVE NOW</span>
                </div>
                {activeBroadcast.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Started {new Date(activeBroadcast.updated_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-lg mb-1">{activeBroadcast.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your teacher started this activity for the class{activeBroadcast.badge ? ` · ${activeBroadcast.badge}` : ""}
              </p>
              <Link
                to={activeBroadcast.route}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                style={{
                  background: "var(--gradient-primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "var(--shadow-glow)"
                }}
              >
                <Play className="h-4 w-4" />
                Join Now
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No live activity right now - your teacher will start one from the Teacher Console when needed.
            </div>
          )}
        </div>

        {
    /* 3. Quick Stats & Emotion */
  }
        <div className="space-y-6">
          {
    /* Simple Emotion Status */
  }
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-4">Your Status</h3>
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">{currentEmotion.emoji}</div>
              <p className="font-semibold text-lg" style={{ color: currentEmotion.color }}>
                {currentEmotion.label}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {emotion === "happy" && "You're doing great! Keep it up!"}
                {emotion === "neutral" && "Steady focus detected. Good pace!"}
                {emotion === "confused" && "Take your time. We're here to help."}
                {emotion === "angry" && "It's okay to feel stuck. Try a short break or ask for help."}
              </p>
            </div>
          </div>

          {
    /* Quick Progress */
  }
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Quizzes Completed</span>
                <span className="font-semibold">{loadingHistory ? "–" : quizzesCompleted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg. Score</span>
                <span className="font-semibold">{loadingHistory || avgScore == null ? "–" : `${avgScore}%`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Study Streak</span>
                <span className="font-semibold">
                  {loadingHistory ? "–" : `${studyStreak} day${studyStreak === 1 ? "" : "s"}${studyStreak > 0 ? " 🔥" : ""}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
    /* 4. Progress Section - real per-subject averages from analytics-service
       session history, grouped via each session's actual lesson subject. */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Your Progress
        </h2>

        {loadingHistory ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : progressBySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No quiz results yet - take a lesson quiz to see your progress by subject.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {progressBySubject.map((item) => <div
    key={item.subject}
    className={`p-4 rounded-xl border ${item.weak ? "border-destructive/30 bg-destructive/5" : "border-border/60"}`}
  >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{item.subject}</h3>
                {item.trend === "up" && <TrendingUp className="h-4 w-4 text-emotion-happy" />}
                {item.trend === "down" && <TrendingDown className="h-4 w-4 text-emotion-angry" />}
              </div>

              <div className="text-2xl font-bold mb-2">{item.score}%</div>

              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${item.score}%`,
      background: item.weak ? "var(--emotion-angry)" : "var(--gradient-primary)"
    }}
  />
              </div>

              {item.weak && <p className="text-xs text-destructive font-medium">Needs Practice</p>}
            </div>)}
          </div>
        )}
      </div>

      {
    /* 5. Recommendations - real resources for whichever LOs were still
       weak in this student's most recent lesson quiz (semantic_recommender
       via analytics-service), not a static placeholder list. */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Recommended for You
        </h2>

        {!loadingRecommendations && advisorRecommendations.length > 0 && (
          <div className="mb-4 space-y-2">
            {advisorRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl border border-primary/40 bg-primary/5 flex items-start gap-3"
              >
                <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">From your advisor</p>
                  <p className="text-sm text-foreground">{rec.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loadingRecommendations ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              No recommendations yet - take a lesson quiz and we'll suggest resources for anything you haven't mastered.
            </p>
            <Link
              to="/lessons"
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
            >
              Go to Adaptive Learning
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((res) => {
              const TypeIcon = RESOURCE_TYPE_ICON[res.type] || FileText;
              return (
                <div key={res.id} className="p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-all hover:shadow-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <TypeIcon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{res.difficulty}</span>
                  </div>

                  <h3 className="font-semibold mb-1">{res.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {res.lesson_title} &middot; {res.lo_level}
                  </p>

                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                  >
                    {RESOURCE_TYPE_ACTION[res.type] || "Open"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {
    /* 6. Quiz Section - real lessons from the adaptive-learning backend */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Available Quizzes
        </h2>

        {loadingLessons ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No lessons available.</p>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => <div key={lesson.lesson_id} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-all">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{lesson.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{lesson.subject}</span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {lesson.question_count} questions
                    </span>
                  </div>
                </div>

                <Link
                  to="/lessons"
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-primary-foreground transition-all hover:scale-105"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                >
                  Start Quiz
                </Link>
              </div>)}
          </div>
        )}
      </div>
    </div>;
}
export {
  StudentDashboard
};
