import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { getActiveRecommendation, joinActiveGame, finishActiveGame } from "@/services/analyticsApi";

// Session telemetry for a game page: registers a "join" with the backend
// when this page IS the teacher's currently broadcast game (matched by
// gameKey against GET /recommendation/active), and exposes reportFinish()
// so the game can report a win/loss + score when it ends. If the student
// opened the game outside of a live broadcast (e.g. a direct link), no
// session_id exists and both join and reportFinish are no-ops - there's
// nothing for the teacher's live panel to attach the result to.
function useGameSession(gameKey) {
  const { user } = useAuth();
  const sessionIdRef = useRef(null);
  // Proxy for "time spent" - measured from when this page mounted (game
  // page loading is what a broadcast join represents) to when the game
  // reports a result, not from a mid-page "Start" click, since not every
  // game surfaces that moment to this hook.
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    async function join() {
      try {
        const data = await getActiveRecommendation();
        if (cancelled || data?.active_game !== gameKey || !data.session_id) return;
        sessionIdRef.current = data.session_id;
        await joinActiveGame({
          studentId: String(user.id ?? user.email ?? "unknown_student"),
          sessionId: data.session_id,
        });
      } catch (error) {
        // best-effort - the game must keep working even if this fails
      }
    }

    join();
    return () => {
      cancelled = true;
    };
  }, [gameKey, user]);

  async function reportFinish(outcome, score, { correctCount, totalCount } = {}) {
    if (!sessionIdRef.current || !user) return;
    try {
      await finishActiveGame({
        studentId: String(user.id ?? user.email ?? "unknown_student"),
        studentName: user.name ?? null,
        sessionId: sessionIdRef.current,
        outcome,
        score,
        correctCount,
        totalCount,
        durationSeconds: Math.round((Date.now() - mountedAtRef.current) / 1000),
      });
    } catch (error) {
      // best-effort
    }
  }

  return { reportFinish };
}

export { useGameSession };
