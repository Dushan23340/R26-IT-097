import { useState, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
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
  Activity,
  TrendingUp,
  Sparkles,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  ShieldAlert
} from "lucide-react";
import { EMOTIONS, toEmotionKey } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";
import { emotionApi } from "@/lib/emotionApi";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { getStudents as getLiveStudents } from "@/services/emotionApi";
import { studentProfileApi } from "@/lib/studentProfileApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SUBJECTS = ["General", "Mathematics", "Science", "English", "History", "Programming"];

function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [studentsJoined, setStudentsJoined] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  // Optional real-lesson narrowing for the Game Recommendation Engine -
  // shared list (also reused by the "Start Quiz" picker below instead of
  // fetching lessons twice).
  const [allLessons, setAllLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");

  useEffect(() => {
    adaptiveApiService
      .getLessons()
      .then((res) => setAllLessons(res.data || []))
      .catch(() => {
        // silent - the Recommend/Start Quiz pickers just show no lessons
      });
  }, []);

  // Real "Start Quiz" broadcast (Quick Actions) - teacher picks one of
  // adaptive-learning's real lessons; students see a live prompt to jump
  // into it (StudentDashboard.jsx polls /quiz-broadcast/state).
  const [showQuizPicker, setShowQuizPicker] = useState(false);
  const [quizLessons, setQuizLessons] = useState([]);
  const [loadingQuizLessons, setLoadingQuizLessons] = useState(false);
  const [activeQuizBroadcast, setActiveQuizBroadcast] = useState(null);

  // "Assign Activity" Quick Action - manual game broadcast picker.
  const [showActivityPicker, setShowActivityPicker] = useState(false);

  // "Send Message" Quick Action - real broadcast, built fresh (no existing
  // backend for this one, unlike quiz/activity which reuse real systems).
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeMessageBroadcast, setActiveMessageBroadcast] = useState(null);

  // Real data from FastAPI backend
  const [analytics, setAnalytics] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [effectiveness, setEffectiveness] = useState(null);
  const [variationWindow, setVariationWindow] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  // Pattern & trend data
  const [pattern, setPattern] = useState(null);
  const [trend, setTrend] = useState(null);

  // Real, live students currently being tracked by emotion-service (i.e.
  // actually connected with their camera on right now) - not a synthetic
  // roster. Empty until a student page actually starts sending frames.
  const [liveStudents, setLiveStudents] = useState([]);
  const [liveStudentsLoaded, setLiveStudentsLoaded] = useState(false);
  const [studentsError, setStudentsError] = useState(null);
  // Real roster of who's actually joined the live class (pseudonym + real
  // name) - cross-referenced against liveStudents (emotion-service's raw
  // pseudonym-keyed tracker) below to show real names instead of anon_*
  // ids, scoped to this class instead of every pseudonym ever tracked.
  const [joinedStudents, setJoinedStudents] = useState([]);

  // What's currently broadcast live to students (set via handleLaunchGame
  // below POSTing to /recommendation/active) - polled so the recommendation
  // panel can show "Live for students: X" without a page refresh.
  const [broadcastGame, setBroadcastGame] = useState(null);
  // Live join/finish counts + per-student results for that same session.
  const [sessionStats, setSessionStats] = useState(null);
  const [ending, setEnding] = useState(false);

  // Expert-in-the-loop queue (IT22197146 SO5) - statistically-generated
  // insights from analytics-service wait here for a teacher/advisor
  // approve/modify/reject decision before they count as "approved".
  const [pendingRecommendations, setPendingRecommendations] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // Class-wide LO/stability/fairness snapshot from analytics-service, used
  // for the "at-risk" alert below (distinct from the live in-class
  // negative-emotion alert, which only reflects the current moment).
  const [classOverview, setClassOverview] = useState(null);

  async function fetchPendingRecommendations() {
    try {
      const data = await studentProfileApi.getPendingRecommendations();
      setPendingRecommendations(data.recommendations || []);
    } catch (e) {
      // silent — best-effort, analytics-service may not be running
    }
  }

  async function fetchClassOverview() {
    try {
      const data = await studentProfileApi.getClassOverview();
      setClassOverview(data);
    } catch (e) {
      // silent — same best-effort reasoning
    }
  }

  useEffect(() => {
    fetchPendingRecommendations();
    fetchClassOverview();
    const interval = setInterval(() => {
      fetchPendingRecommendations();
      fetchClassOverview();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleReview(id, action) {
    setReviewingId(id);
    try {
      await studentProfileApi.reviewRecommendation(id, {
        action,
        reviewer: user?.name || user?.email || "teacher",
        modified_text: action === "modify" ? editText : undefined,
      });
      setPendingRecommendations((prev) => prev.filter((r) => r.id !== id));
      setEditingId(null);
      setEditText("");
      toast.success(
        action === "approve" ? "Insight approved" : action === "modify" ? "Insight approved with edits" : "Insight rejected"
      );
    } catch (e) {
      toast.error("Couldn't submit review - try again.");
    } finally {
      setReviewingId(null);
    }
  }

  async function fetchActiveRecommendation() {
    try {
      const data = await emotionApi.getActiveRecommendation();
      setBroadcastGame(data?.active_game ? data : null);
    } catch (e) {
      // silent — live-status badge is best-effort, not required for the dashboard to function
    }
  }

  async function fetchActiveStats() {
    try {
      const data = await emotionApi.getActiveStats();
      setSessionStats(data?.active_game ? data : null);
    } catch (e) {
      // silent — same best-effort reasoning as fetchActiveRecommendation
    }
  }

  useEffect(() => {
    fetchActiveRecommendation();
    fetchActiveStats();
    const interval = setInterval(() => {
      fetchActiveRecommendation();
      fetchActiveStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleEndGame() {
    setEnding(true);
    try {
      await emotionApi.endActiveRecommendation();
      setBroadcastGame(null);
      setSessionStats(null);
      toast.success("Game ended for the class");
    } catch (e) {
      toast.error("Couldn't end the game - try again.");
    } finally {
      setEnding(false);
    }
  }

  // Fetch analytics periodically when live
  useEffect(() => {
    if (!isLive) return;
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Initial fetch
  useEffect(() => {
    fetchEffectiveness();
    fetchVariationWindow();
    fetchPattern();
    fetchTrend();
  }, []);

  async function fetchLiveStudents() {
    try {
      const data = await getLiveStudents();
      // getStudents() (services/emotionApi.js) returns the raw
      // {count, students: [...]} body, not a bare array - Array.isArray(data)
      // was always false here, so this silently fell back to [] on every
      // successful fetch too, not just failures.
      setLiveStudents(Array.isArray(data?.students) ? data.students : []);
      setStudentsError(null);
    } catch (e) {
      setStudentsError(e.message || "Failed to load live student data");
    } finally {
      setLiveStudentsLoaded(true);
    }
  }

  // Poll students actually connected right now (emotion-service's live,
  // in-memory tracker - not a stored roster), so the panel reflects who's
  // really here instead of a fixed list.
  useEffect(() => {
    fetchLiveStudents();
    const interval = setInterval(fetchLiveStudents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real joined-roster poll (unconditional, not gated on isLive, for the
  // same remount-rehydration reason as the class-session state poll above -
  // returns [] when no class is live, which is exactly what we want).
  useEffect(() => {
    async function poll() {
      try {
        const data = await emotionApi.getClassSessionStudents();
        setJoinedStudents(Array.isArray(data?.students) ? data.students : []);
      } catch (e) {
        // silent - best-effort
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
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
    setError(null);

    const fallbackRecommendation = {
      timestamp: new Date().toISOString(),
      dominant_emotion: analytics?.dominant_emotion || "BORED",
      trigger_reason: "Using the local Fraction Room recommendation.",
      recommendation: {
        game_id: "gm_math_bored_03",
        title: "Fraction Room Rescue",
        description: "A grade-9 fraction escape room with hidden papers, brackets, and BODMAS puzzles.",
        subject: "Mathematics",
        game_type: "escape room game",
        difficulty: "Medium",
        target_emotion: analytics?.dominant_emotion || "BORED",
        estimated_duration_minutes: 5,
        engagement_score: 9.6,
      },
      alternatives: [
        {
          game_id: "gm_math_circle_track_04",
          title: "Track & Field Analytics",
          description: "Practice circle circumference and lane staggers in a track field challenge.",
          subject: "Mathematics",
          game_type: "analytics game",
          difficulty: "Easy",
          estimated_duration_minutes: 4,
          engagement_score: 9.4,
        },
      ],
      intervention_id: "local-fallback",
    };

    try {
      if (!analytics) {
        await fetchAnalytics();
      }
      const dominant = analytics?.dominant_emotion || "BORED";
      console.log("Generating recommendation for emotion:", dominant, "subject:", selectedSubject, "lesson:", selectedLessonId);
      const data = await emotionApi.generateRecommendation(dominant, selectedSubject, selectedLessonId);
      console.log("Recommendation data:", data);

      const normalizedRecommendation = data?.recommendation
        ? data
        : {
            ...fallbackRecommendation,
            trigger_reason: data?.trigger_reason || fallbackRecommendation.trigger_reason,
            recommendation: {
              ...fallbackRecommendation.recommendation,
              game_id: data?.game_id || data?.recommendation?.game_id || fallbackRecommendation.recommendation.game_id,
              title: data?.game_title || data?.recommendation?.title || fallbackRecommendation.recommendation.title,
              description:
                data?.description || data?.recommendation?.description || fallbackRecommendation.recommendation.description,
              subject: data?.subject || data?.recommendation?.subject || fallbackRecommendation.recommendation.subject,
              game_type: data?.game_type || data?.recommendation?.game_type || fallbackRecommendation.recommendation.game_type,
              difficulty: data?.difficulty || data?.recommendation?.difficulty || fallbackRecommendation.recommendation.difficulty,
              target_emotion:
                data?.target_emotion || data?.recommendation?.target_emotion || fallbackRecommendation.recommendation.target_emotion,
              estimated_duration_minutes:
                data?.estimated_duration_minutes || data?.recommendation?.estimated_duration_minutes || fallbackRecommendation.recommendation.estimated_duration_minutes,
              engagement_score:
                data?.engagement_score || data?.recommendation?.engagement_score || fallbackRecommendation.recommendation.engagement_score,
            },
          };

      setRecommendation(normalizedRecommendation);
      await fetchVariationWindow();
    } catch (e) {
      console.error("Recommendation error:", e);
      setError("Unable to connect to recommendation backend. Showing local Fraction Room recommendation.");
      setRecommendation(fallbackRecommendation);
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
      await fetchEffectiveness();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading((l) => ({ ...l, [interventionId]: false }));
    }
  }

  const recommendedGame = recommendation?.recommendation || recommendation;

  // Single source of truth for which recommendation-engine game_ids map to
  // an actually playable game, and which broadcast key
  // (emotion-backend's GAME_LIBRARY, see active_recommendation.py) switches
  // students to it live. Add an entry here whenever a new real game is
  // wired up on the backend's REAL_GAME_PREFERENCE table.
  const REAL_GAMES = {
    gm_math_bored_03: { route: "/fraction-room", gameKey: "fraction_room" },
    gm_math_fraction_happy: { route: "/fraction-room", gameKey: "fraction_room" },
    gm_math_fraction_confused: { route: "/fraction-room", gameKey: "fraction_room" },
    gm_math_dark_room_01: { route: "/dark-room-escape", gameKey: "dark_room" },
    gm_math_pirate_01: { route: "/pirate-navigator", gameKey: "pirate" },
    gm_math_pirate_02: { route: "/pirate-navigator", gameKey: "pirate" },
    gm_math_pirate_normal: { route: "/pirate-navigator", gameKey: "pirate" },
    gm_math_equations_eco_01: { route: "/equations-eco", gameKey: "equations_eco" },
    gm_math_fish_tank_01: { route: "/fish-tank-shop", gameKey: "fish_tank_shop" },
    gm_math_pattern_islands_01: { route: "/pattern-islands", gameKey: "pattern_islands" },
    gm_math_eco_blooms_normal: { route: "/eco-blooms-land-sale", gameKey: "eco_blooms_land" },
    gm_math_eco_blooms_bored: { route: "/eco-blooms-land-sale", gameKey: "eco_blooms_land" },
    gm_math_magician_confused: { route: "/magicians-triangle-house", gameKey: "magicians_triangle_house" },
    gm_math_alchemist_bored: { route: "/alchemists-potion-lab", gameKey: "alchemists_potion_lab" },
    gm_math_time_guardians_normal: { route: "/time-guardians-rounding-clock", gameKey: "time_guardians_rounding_clock" },
    gm_math_laser_heist_frustrated: { route: "/laser-heist-parallel-museum", gameKey: "laser_heist_parallel_museum" },
    gm_math_fraction_chef_happy: { route: "/fraction-chef-recipe-rescue", gameKey: "fraction_chef_recipe_rescue" },
    gm_math_fraction_chef_angry: { route: "/fraction-chef-recipe-rescue", gameKey: "fraction_chef_recipe_rescue" },
  };

  function handleOpenGame(gameId) {
    const real = REAL_GAMES[gameId];
    if (!real) return;
    router.navigate({ to: real.route });
  }

  // "Assign Activity" Quick Action - a manual, teacher-picked version of
  // the same broadcast handleLaunchGame below uses for an AI recommendation.
  // Mirrors emotion-backend's GAME_LIBRARY (active_recommendation.py) since
  // there's no "list games" endpoint - same mirroring REAL_GAMES above
  // already does for game_id -> route/gameKey.
  const ACTIVITY_GAMES = [
    { gameKey: "fraction_room", title: "Fraction Room", description: "Practice fractions hands-on in an interactive room." },
    { gameKey: "dark_room", title: "Escape the Dark Room", description: "Solve math puzzles to escape." },
    { gameKey: "pirate", title: "Uncharted Waters: The Pirate Navigator", description: "Navigate using math to chart a course." },
    { gameKey: "equations_eco", title: "Equations Eco: Forest Restoration", description: "Solve equations to restore a forest ecosystem." },
    { gameKey: "fish_tank_shop", title: "Fish Tank Shop", description: "Run a shop using math for pricing and stock." },
    { gameKey: "pattern_islands", title: "Pattern Islands", description: "Identify and extend patterns across islands." },
    { gameKey: "eco_blooms_land", title: "Eco Blooms Land Sale", description: "Calculate square/rectangle/triangle areas to sell customers the matching land plot." },
    { gameKey: "magicians_triangle_house", title: "The Magician's Triangle House", description: "Use triangle angle theorems to free trapped friends from the magic house." },
    { gameKey: "alchemists_potion_lab", title: "The Alchemist's Potion Lab", description: "Simplify, add, multiply, factorize, and substitute algebraic expressions to free trapped ingredients." },
    { gameKey: "time_guardians_rounding_clock", title: "Time Guardians: Save the Rounding Clock", description: "Round to the nearest 10/100, decimal places, and significant figures to purify time crystals." },
    { gameKey: "laser_heist_parallel_museum", title: "Laser Heist: The Parallel Museum", description: "Use corresponding, alternate, co-interior, and vertically opposite angle properties to disable laser grids." },
    { gameKey: "fraction_chef_recipe_rescue", title: "Fraction Chef: The Recipe Rescue", description: "Simplify, add, subtract, multiply, divide, and compare fractions across 5 magical ovens to recover the Master Recipe Scrolls." },
  ];

  async function handleAssignActivity(game) {
    try {
      const data = await emotionApi.setActiveRecommendation(game.gameKey);
      setBroadcastGame(data);
      await fetchActiveStats();
      setShowActivityPicker(false);
      toast.success(`${game.title} assigned to the class`);
    } catch (e) {
      toast.error("Couldn't assign the activity - try again.");
    }
  }

  function openActivityPicker() {
    if (broadcastGame?.active_game) {
      toast.error("An activity is already live - end it before assigning a new one.");
      return;
    }
    setShowActivityPicker(true);
  }

  async function handleLaunchGame() {
    if (!recommendation) return;
    const gameId = recommendedGame?.game_id;
    const real = REAL_GAMES[gameId];
    if (!real) {
      setError("This recommendation doesn't have a playable game yet.");
      return;
    }

    // Broadcast only - the teacher's own browser stays on the dashboard so
    // they can monitor the live session panel below instead of getting
    // pulled into the game themselves.
    try {
      const data = await emotionApi.setActiveRecommendation(real.gameKey);
      setBroadcastGame(data);
      await fetchActiveStats();
      toast.success(`${recommendedGame.title} started for the class`);
    } catch (e) {
      toast.error("Couldn't notify students - they may need to refresh.");
    }
  }

  // Real live-class broadcast (students poll this and can Join, which
  // starts their real webcam emotion capture) - replaces the previous
  // purely-local isLive/studentsJoined=18 fake state.
  const handleStartClass = async () => {
    try {
      const data = await emotionApi.startClassSession(selectedSubject, user?.name);
      setIsLive(true);
      setStudentsJoined(0);
      setSessionId(data?.session_id ?? null);
      fetchAnalytics();
    } catch (e) {
      toast.error("Couldn't start the class - try again.");
    }
  };
  const handleEndClass = async () => {
    try {
      await emotionApi.endClassSession();
    } catch (e) {
      // best-effort - still drop the local live state below either way
    }
    setIsLive(false);
    setIsSharingScreen(false);
    setStudentsJoined(0);
    setSessionId(null);
  };

  // Class Management panel's "Create New Class" is a shortcut for the same
  // real broadcast handleStartClass starts above - starting a new one while
  // one is already live would silently reset the current session (wiping
  // its joined students), so guard against that instead of doing it.
  const handleCreateNewClass = () => {
    if (isLive) {
      toast.error("A class is already live - end it before starting a new one.");
      return;
    }
    handleStartClass();
  };

  const handleCopySessionLink = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      toast.success("Session ID copied - share it with students to join.");
    } catch (e) {
      toast.error("Couldn't copy - your browser blocked clipboard access.");
    }
  };

  // Real joined-count while live (a student calls /class-session/join when
  // they click Join on the dashboard) - polled the same way the game
  // broadcast's session stats already are.
  //
  // Unconditional (not gated on isLive) and runs on every mount: isLive is
  // local component state that resets to false whenever this component
  // unmounts and remounts (e.g. the teacher navigates to Profile and back
  // via client-side routing) - without this poll rehydrating from the
  // real backend state, a still-genuinely-live class would wrongly show
  // as "Not Started" here even though nothing was actually ended (the
  // student dashboard, which polls independently, would keep correctly
  // showing it live - a symptom of exactly this desync).
  useEffect(() => {
    async function poll() {
      try {
        const data = await emotionApi.getClassSessionState();
        setIsLive(!!data?.is_live);
        if (data?.is_live) {
          setStudentsJoined(data.joined_count ?? 0);
          setSessionId(data.session_id ?? null);
          if (data.subject) setSelectedSubject(data.subject);
        } else {
          setStudentsJoined(0);
          setSessionId(null);
        }
      } catch (e) {
        // silent - best-effort
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // "Start Quiz" Quick Action - opens a real-lesson picker, then broadcasts
  // the chosen lesson so students get a live prompt to jump into it.
  const openQuizPicker = () => {
    setShowQuizPicker(true);
    setLoadingQuizLessons(true);
    adaptiveApiService
      .getLessons()
      .then((res) => setQuizLessons(res.data || []))
      .catch(() => toast.error("Couldn't load lessons - try again."))
      .finally(() => setLoadingQuizLessons(false));
  };

  const handleLaunchQuiz = async (lesson) => {
    try {
      const data = await emotionApi.startQuizBroadcast(lesson.lesson_id, lesson.title, user?.name);
      setActiveQuizBroadcast(data ?? null);
      setShowQuizPicker(false);
      toast.success(`Quiz started: ${lesson.title}`);
    } catch (e) {
      toast.error("Couldn't start the quiz - try again.");
    }
  };

  const handleEndQuizBroadcast = async () => {
    try {
      await emotionApi.endQuizBroadcast();
    } catch (e) {
      // best-effort
    }
    setActiveQuizBroadcast(null);
  };

  // Poll so the "Start Quiz" card reflects an already-active broadcast
  // (e.g. after a page refresh), same pattern as the live-class poll above.
  useEffect(() => {
    async function poll() {
      try {
        const data = await emotionApi.getQuizBroadcastState();
        setActiveQuizBroadcast(data?.is_active ? data : null);
      } catch (e) {
        // silent - best-effort
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // "Send Message" Quick Action.
  const handleSendMessage = async () => {
    const message = messageDraft.trim();
    if (!message) return;
    setSendingMessage(true);
    try {
      const data = await emotionApi.sendMessageBroadcast(message, user?.name);
      setActiveMessageBroadcast(data ?? null);
      setShowMessageDialog(false);
      setMessageDraft("");
      toast.success("Message sent to the class");
    } catch (e) {
      toast.error("Couldn't send the message - try again.");
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    async function poll() {
      try {
        const data = await emotionApi.getMessageBroadcastState();
        setActiveMessageBroadcast(data?.is_active ? data : null);
      } catch (e) {
        // silent - best-effort
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleShareScreen = () => {
    setIsSharingScreen(!isSharingScreen);
  };
  // Real roster (joinedStudents, from class_session_store.get_joined_students -
  // who actually clicked Join for THIS class) cross-referenced with real,
  // live emotion data (liveStudents, emotion-service's pseudonym-keyed
  // tracker) matched on pseudonym === studentId, so the panel shows real
  // names instead of anon_* ids and is scoped to this class instead of
  // every pseudonym emotion-service has ever tracked. A joined student
  // with no matching entry yet just means their camera hasn't started
  // sending frames - shown as "waiting for camera", not omitted.
  const liveByPseudonym = new Map(liveStudents.map((s) => [s.studentId, s]));
  const students = joinedStudents.map((j) => {
    const live = liveByPseudonym.get(j.pseudonym);
    const lastSeenSecondsAgo = live?.lastSeenTimestamp ? Date.now() / 1000 - live.lastSeenTimestamp : Infinity;
    return {
      id: j.pseudonym,
      name: j.name,
      emotion: live ? toEmotionKey(live.currentEmotion) : null,
      status: lastSeenSecondsAgo < 15 ? "active" : "inactive",
      engagementScore: live?.engagementIndicators?.engagementScore ?? null,
    };
  });
  // Real, derived attention-drop alerts (replaces the old hardcoded mock
  // list). Sourced from: pattern_detector (sustained BORED/CONFUSED/
  // FRUSTRATED across 2 aggregation cycles), the live class engagement
  // score, and at-risk students from analytics-service.
  const alerts = [];
  if (pattern?.detected) {
    alerts.push({
      id: "pattern",
      message: `Persistent ${pattern.emotion?.toLowerCase()} detected across the class - consider starting a re-engagement activity`,
      type: pattern.emotion === "FRUSTRATED" ? "danger" : "warning",
      time: "Live",
    });
  }
  if (analytics?.class_engagement_score != null) {
    const score = Math.round(analytics.class_engagement_score);
    if (score < 30) {
      alerts.push({
        id: "engagement",
        message: `Class engagement score dropped to ${score}% - attention has fallen sharply`,
        type: "danger",
        time: "Live",
      });
    } else if (score < 50) {
      alerts.push({
        id: "engagement",
        message: `Class engagement score is ${score}% - attention may be dropping`,
        type: "warning",
        time: "Live",
      });
    }
  }
  const NEGATIVE_EMOTIONS = new Set(["bored", "confused", "frustrated", "angry"]);
  const atRiskCount = students.filter((s) => s.status === "active" && NEGATIVE_EMOTIONS.has(s.emotion)).length;
  if (atRiskCount > 0) {
    alerts.push({
      id: "at-risk",
      message: `${atRiskCount} student${atRiskCount > 1 ? "s" : ""} currently showing a negative emotion (bored/confused/frustrated/angry)`,
      type: atRiskCount >= 3 ? "danger" : "warning",
      time: "Live",
    });
  }
  // Longitudinal (not just in-the-moment) risk from analytics-service:
  // statistically volatile LO scores across sessions or a significant
  // declining trend, per IT22197146's stability/trend engine.
  if (classOverview?.at_risk_count > 0) {
    alerts.push({
      id: "lo-at-risk",
      message: `${classOverview.at_risk_count} student${classOverview.at_risk_count > 1 ? "s" : ""} flagged by learning-outcome analytics (high score variance across lessons)`,
      type: classOverview.at_risk_count >= 3 ? "danger" : "warning",
      time: "Analytics",
    });
  }
  if (pendingRecommendations.length > 0) {
    alerts.push({
      id: "pending-insights",
      message: `${pendingRecommendations.length} statistical insight${pendingRecommendations.length > 1 ? "s" : ""} waiting for your review`,
      type: "info",
      time: "Analytics",
    });
  }
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
            {alerts.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No attention-drop alerts right now.
              </div>
            )}
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
      {pattern && pattern.detected && (
        <div className="glass rounded-2xl p-4 border border-amber/30 bg-amber/5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber">
                Persistent Pattern Detected: {pattern.emotion}
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
              const e = EMOTIONS[toEmotionKey(item.emotion)] || { emoji: "❓", label: item.emotion, color: "#888" };
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
                      const e = EMOTIONS[toEmotionKey(emotion)] || { color: "#888" };
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
        
        {studentsError ? (
          <div className="text-sm text-destructive flex items-center gap-2 py-4">
            <AlertTriangle className="h-4 w-4" />
            {studentsError} (is emotion-service running on port 5002?)
          </div>
        ) : !liveStudentsLoaded ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isLive
              ? "No students have joined this class yet - they'll appear here as soon as they click Join."
              : "No live class right now - start one to see joined students here."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {students.map((student) => {
    const e = EMOTIONS[student.emotion] || { emoji: "\u{1F4F7}", label: "Waiting for camera", color: "var(--muted-foreground)" };
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
                <p className="text-[10px] text-muted-foreground mt-1">
                  {student.engagementScore != null ? `Engagement: ${student.engagementScore}%` : "No data yet"}
                </p>
              </div>;
  })}
          </div>
        )}
      </div>

      {
    /* 4b. Expert-in-the-Loop Review Queue (IT22197146 SO5) */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Statistical Insights — Expert Review
          </h2>
          <span className="text-sm text-muted-foreground">{pendingRecommendations.length} pending</span>
        </div>

        {classOverview?.at_risk_count > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm p-3 rounded-lg border border-amber/30 bg-amber/5">
            <ShieldAlert className="h-4 w-4 text-amber flex-shrink-0" />
            <span>
              {classOverview.at_risk_count} of {classOverview.total_students} students show unusually volatile
              LO scores across lessons (stronger dropout/disengagement predictor than low average performance alone).
            </span>
          </div>
        )}

        {pendingRecommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No pending insights right now — the analytics engine queues one automatically whenever a student's
            trend, stability, emotion-correlation, or engagement finding clears statistical significance.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRecommendations.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl border border-border/60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {(rec.insight_type || "insight").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">Student {rec.student_id}</span>
                </div>
                {editingId === rec.id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full text-sm p-2 rounded-lg border border-border/60 bg-background"
                  />
                ) : (
                  <p className="text-sm">{rec.recommendation_text}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(rec.id, "approve")}
                    disabled={reviewingId === rec.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emotion-happy/10 text-emotion-happy hover:bg-emotion-happy/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> Approve
                  </button>
                  {editingId === rec.id ? (
                    <button
                      type="button"
                      onClick={() => handleReview(rec.id, "modify")}
                      disabled={reviewingId === rec.id || !editText.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Save & Approve
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(rec.id);
                        setEditText(rec.recommendation_text);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border/60 hover:bg-secondary transition-colors flex items-center gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleReview(rec.id, "reject")}
                    disabled={reviewingId === rec.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                // A lesson picked under the old subject won't exist under
                // the new one - drop it rather than silently keep sending
                // a mismatched lesson_id to the backend.
                setSelectedLessonId("");
              }}
              className="px-3 py-1.5 rounded-lg text-sm border border-border bg-background"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border border-border bg-background max-w-[180px]"
              title="Optional - narrows the game to one related to this specific lesson, when available"
            >
              <option value="">Any lesson (subject-wide)</option>
              {allLessons
                .filter((l) => l.subject === selectedSubject)
                .map((l) => (
                  <option key={l.lesson_id} value={l.lesson_id}>{l.title}</option>
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

        {broadcastGame?.active_game && (
          <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "rgba(0,229,255,0.3)", backgroundColor: "rgba(0,229,255,0.05)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#00E5FF" }}>
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "#00E5FF" }} />
                Live for students: {broadcastGame.label}
                {broadcastGame.updated_at && (
                  <span className="text-muted-foreground font-normal">
                    (started {new Date(broadcastGame.updated_at).toLocaleTimeString()})
                  </span>
                )}
              </div>
              <button
                onClick={handleEndGame}
                disabled={ending}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {ending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <PhoneOff className="h-3.5 w-3.5" />}
                End Game
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <span><span className="font-bold text-foreground">{sessionStats?.joined_count ?? 0}</span> <span className="text-muted-foreground">playing</span></span>
              <span><span className="font-bold text-foreground">{sessionStats?.finished_count ?? 0}</span> <span className="text-muted-foreground">finished</span></span>
              {sessionStats?.results?.length > 0 && (
                <span>
                  <span className="font-bold text-emotion-happy">{sessionStats.results.filter((r) => r.outcome === "win").length}</span>{" "}
                  <span className="text-muted-foreground">won</span>
                  {" · "}
                  <span className="font-bold text-destructive">{sessionStats.results.filter((r) => r.outcome === "loss").length}</span>{" "}
                  <span className="text-muted-foreground">lost</span>
                </span>
              )}
            </div>

            {sessionStats?.results?.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto space-y-1.5">
                {sessionStats.results.slice().reverse().map((r, i) => (
                  <div key={`${r.student_id}-${r.timestamp}-${i}`} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-background/40">
                    <span className="text-foreground font-medium truncate max-w-[40%]">{r.student_name || r.student_id}</span>
                    <span className="text-muted-foreground">
                      {r.correct_count != null && r.total_count != null ? `${r.correct_count}/${r.total_count}` : (r.score != null ? `${Math.round(r.score)}%` : "-")}
                    </span>
                    <span className={r.outcome === "win" ? "text-emotion-happy font-semibold" : "text-destructive font-semibold"}>
                      {r.outcome === "win" ? "Passed" : "Failed"}
                    </span>
                    <span className="text-muted-foreground">
                      {r.duration_seconds != null ? `${Math.floor(r.duration_seconds / 60)}m ${r.duration_seconds % 60}s` : new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {recommendation ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{recommendation.trigger_reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subject: <span className="font-medium text-foreground">{recommendedGame?.subject || recommendation.subject}</span>
                  {" | "}Game Type: <span className="font-medium text-foreground">{recommendedGame?.game_type || recommendation.game_type}</span>
                  {" | "}ID: <span className="font-mono text-xs">{recommendation.intervention_id || recommendedGame?.game_id}</span>
                </p>
                {recommendation.lesson_id && (
                  recommendation.lesson_matched ? (
                    <p className="text-xs text-primary mt-1">
                      Related to lesson: <span className="font-medium">{allLessons.find((l) => l.lesson_id === recommendation.lesson_id)?.title || recommendation.lesson_id}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      No game tagged to this lesson yet - showing a general {recommendedGame?.subject || recommendation.subject} game instead.
                    </p>
                  )
                )}
              </div>
            </div>

            {/* Primary Recommendation */}
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    <button
                      type="button"
                      onClick={() => handleOpenGame(recommendedGame?.game_id)}
                      className="text-left text-inherit hover:text-primary underline-offset-4 hover:underline"
                    >
                      {recommendedGame?.title || "Recommended Game"}
                    </button>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{recommendedGame?.description || "No description available."}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">{recommendedGame?.difficulty || "Medium"}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">{recommendedGame?.estimated_duration_minutes || 5} min</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary">Score: {recommendedGame?.engagement_score || 0}</span>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleLaunchGame}
                      className="inline-flex items-center gap-2 rounded-lg bg-emotion-happy px-4 py-2 text-sm font-semibold text-white hover:bg-emotion-happy/90 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      {REAL_GAMES[recommendedGame?.game_id] ? `Start ${recommendedGame.title}` : "Start Game"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {recommendation && (
              <div className="flex gap-3">
                <button
                  onClick={handleLaunchGame}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emotion-happy/10 text-emotion-happy hover:bg-emotion-happy/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {REAL_GAMES[recommendedGame?.game_id] ? `Start ${recommendedGame.title}` : "Start Game"}
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

      {
    /* 6. Quick Actions */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={openQuizPicker}
            className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          >
            <FileText className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Start Quiz</h3>
            {activeQuizBroadcast ? (
              <p className="text-sm text-primary flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live: {activeQuizBroadcast.lesson_title}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Launch a quick quiz for the class</p>
            )}
          </button>
          {activeQuizBroadcast && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEndQuizBroadcast();
              }}
              className="-mt-3 mb-1 md:col-start-1 text-xs text-muted-foreground hover:text-destructive text-left"
            >
              End quiz broadcast
            </button>
          )}

          <button
            onClick={openActivityPicker}
            className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          >
            <Calendar className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Assign Activity</h3>
            {broadcastGame?.active_game ? (
              <p className="text-sm text-primary flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live: {broadcastGame.label}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Give students a practice task</p>
            )}
          </button>

          <button
            onClick={() => setShowMessageDialog(true)}
            className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          >
            <MessageSquare className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Send Message</h3>
            {activeMessageBroadcast ? (
              <p className="text-sm text-primary truncate">Sent: "{activeMessageBroadcast.message}"</p>
            ) : (
              <p className="text-sm text-muted-foreground">Broadcast message to all students</p>
            )}
          </button>
        </div>

        {showActivityPicker && (
          <Dialog open={showActivityPicker} onOpenChange={setShowActivityPicker}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign an activity</DialogTitle>
                <DialogDescription>
                  Pick a game to broadcast live - students will be switched to it immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {ACTIVITY_GAMES.map((game) => (
                  <button
                    key={game.gameKey}
                    onClick={() => handleAssignActivity(game)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{game.title}</div>
                      <div className="text-xs text-muted-foreground">{game.description}</div>
                    </div>
                    <Play className="h-4 w-4 text-primary shrink-0 ml-3" />
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showMessageDialog && (
          <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send a message</DialogTitle>
                <DialogDescription>
                  Broadcast a short message to every student currently on their dashboard.
                </DialogDescription>
              </DialogHeader>
              <textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="e.g. Great work today - don't forget the quiz due Friday!"
                className="w-full rounded-lg border border-border/60 bg-secondary/50 p-3 text-sm focus:outline-none focus:border-primary/40"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{messageDraft.length}/500</span>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageDraft.trim() || sendingMessage}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                >
                  {sendingMessage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showQuizPicker && (
          <Dialog open={showQuizPicker} onOpenChange={setShowQuizPicker}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a quiz</DialogTitle>
                <DialogDescription>
                  Pick a lesson to broadcast live - students will see a prompt to jump straight into its quiz.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {loadingQuizLessons ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading lessons...</p>
                ) : quizLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No lessons available.</p>
                ) : (
                  quizLessons.map((lesson) => (
                    <button
                      key={lesson.lesson_id}
                      onClick={() => handleLaunchQuiz(lesson)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                    >
                      <div>
                        <div className="font-medium">{lesson.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {lesson.subject} - {lesson.question_count} questions
                        </div>
                      </div>
                      <Play className="h-4 w-4 text-primary" />
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
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
    onClick={handleCreateNewClass}
    className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-2 transition-all hover:scale-105"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
            <Plus className="h-4 w-4" />
            Create New Class
          </button>
        </div>

        <div className="space-y-3">
          {isLive ? (
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-colors">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{selectedSubject}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Live now
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {studentsJoined} students joined
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-mono">
                  <Link className="h-3 w-3" />
                  {sessionId ?? "..."}
                </div>
                <button
                  onClick={handleCopySessionLink}
                  disabled={!sessionId}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Share Link
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No live class right now - click "Create New Class" to start one.</p>
            </div>
          )}
        </div>
      </div>

    </div>;
}
export {
  TeacherDashboard
};
