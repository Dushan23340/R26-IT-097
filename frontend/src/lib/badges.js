// Achievement badges, worked out from data the platform already has (the
// learner's quiz history in analytics-service, live-class readings, the
// usability survey). Nothing extra is stored: the same history always
// gives the same badges, on any device.

// history: analytics-service /students/<id>/history ({ lo_history, emotional_states })
// -> one row per quiz session: { session_id, lesson_id, start_time, score }
export function sessionsFromHistory(history) {
  const bySession = new Map();
  for (const row of history?.lo_history || []) {
    if (!bySession.has(row.session_id)) {
      bySession.set(row.session_id, { session_id: row.session_id, lesson_id: row.lesson_id, start_time: row.start_time, scores: [] });
    }
    bySession.get(row.session_id).scores.push(Number(row.score));
  }
  return [...bySession.values()]
    .map((s) => ({ ...s, score: s.scores.reduce((a, b) => a + b, 0) / s.scores.length }))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

// Live classes = distinct live-class sessions with webcam emotion readings
// (analytics-service files them under lesson_id "live-class").
export function liveClassCount(history) {
  return new Set((history?.emotional_states || []).filter((e) => e.lesson_id === "live-class").map((e) => e.session_id).filter(Boolean)).size;
}

// Longest run of consecutive calendar days with at least one quiz.
export function longestStreak(sessions) {
  const days = [...new Set(sessions.map((s) => new Date(s.start_time).toDateString()))].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev != null && Math.round((day - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

// Biggest rise between a learner's first and best later score on one lesson.
function biggestComeback(sessions) {
  const byLesson = new Map();
  for (const s of sessions) {
    if (!byLesson.has(s.lesson_id)) byLesson.set(s.lesson_id, []);
    byLesson.get(s.lesson_id).push(s.score);
  }
  let best = 0;
  for (const scores of byLesson.values()) {
    if (scores.length > 1) best = Math.max(best, Math.max(...scores.slice(1)) - scores[0]);
  }
  return Math.round(best);
}

function bestPerLesson(sessions) {
  const best = new Map();
  for (const s of sessions) best.set(s.lesson_id, Math.max(best.get(s.lesson_id) ?? 0, s.score));
  return best;
}

// icon: a lucide-react icon name, resolved by components/Achievements.jsx.
export const BADGES = [
  { id: "first-steps", icon: "Footprints", title: "First steps", description: "Complete your first quiz", tier: "bronze", target: 1, measure: (m) => m.quizzes },
  { id: "quiz-explorer", icon: "Compass", title: "Quiz explorer", description: "Complete 5 quizzes", tier: "silver", target: 5, measure: (m) => m.quizzes },
  { id: "quiz-champion", icon: "Trophy", title: "Quiz champion", description: "Complete 10 quizzes", tier: "gold", target: 10, measure: (m) => m.quizzes },
  { id: "perfect-score", icon: "Star", title: "Perfect score", description: "Score 100% on a quiz", tier: "gold", target: 100, measure: (m) => m.bestScore, unit: "%" },
  { id: "high-flyer", icon: "Rocket", title: "High flyer", description: "Average 80% or more over at least 3 quizzes", tier: "silver", target: 80, measure: (m) => (m.quizzes >= 3 ? m.average : Math.min(m.average, 79)), unit: "%" },
  { id: "lesson-master", icon: "GraduationCap", title: "Lesson master", description: "Score 80% or more on 3 different lessons", tier: "gold", target: 3, measure: (m) => m.masteredLessons },
  { id: "all-rounder", icon: "LayoutGrid", title: "All-rounder", description: "Try every lesson at least once", tier: "silver", target: (m) => Math.max(m.lessonCount, 1), measure: (m) => m.lessonsTried },
  { id: "comeback", icon: "TrendingUp", title: "Comeback", description: "Improve a lesson's score by 20 points on a retake", tier: "silver", target: 20, measure: (m) => m.comeback, unit: " pts" },
  { id: "streak-3", icon: "Flame", title: "On a roll", description: "Take quizzes on 3 days in a row", tier: "bronze", target: 3, measure: (m) => m.streak },
  { id: "streak-7", icon: "Zap", title: "Unstoppable", description: "Take quizzes on 7 days in a row", tier: "gold", target: 7, measure: (m) => m.streak },
  { id: "live-learner", icon: "Video", title: "Live learner", description: "Join 3 live classes with your webcam on", tier: "bronze", target: 3, measure: (m) => m.liveClasses },
  { id: "voice-heard", icon: "MessageSquareHeart", title: "Voice heard", description: "Tell us how easy AdaptiveMind is to use", tier: "bronze", target: 1, measure: (m) => (m.surveyDone ? 1 : 0) },
];

// -> [{ ...badge, earned, current, target, progress (0-1) }]
export function computeBadges({ history, surveyDone = false, lessonCount = 6 }) {
  const sessions = sessionsFromHistory(history);
  const best = bestPerLesson(sessions);
  const metrics = {
    quizzes: sessions.length,
    bestScore: Math.round(Math.max(0, ...sessions.map((s) => s.score))),
    average: sessions.length ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) : 0,
    masteredLessons: [...best.values()].filter((v) => v >= 80).length,
    lessonsTried: best.size,
    lessonCount,
    comeback: biggestComeback(sessions),
    streak: longestStreak(sessions),
    liveClasses: liveClassCount(history),
    surveyDone,
  };
  return BADGES.map((b) => {
    const target = typeof b.target === "function" ? b.target(metrics) : b.target;
    const current = Math.max(0, b.measure(metrics));
    return { ...b, target, current: Math.min(current, target), earned: current >= target, progress: Math.min(1, current / target) };
  });
}
