"""
Real "live class" broadcast - distinct from active_recommendation.py's game
broadcast. A teacher clicks "Start Class" on the Teacher Console, which
flips this shared server-side state; students poll it and can "Join",
which (client-side) turns on their real webcam emotion capture
(EmotionDetector -> emotion-service -> this service's /emotions ingest),
feeding the same real class emotion dashboard the Teacher Console already
shows. No video/audio is actually transmitted - see the "live-session mode"
scope decision this replaces "real video calling" with.

Same session_id pattern as ActiveRecommendationStore: join calls are scoped
to *this* run of the class, so a stale join from a previous session doesn't
inflate the current joined count.

Also bridges to IT22197146's analytics-service (Student Profile Management)
via student_profile_bridge.py: each joining student gets a real
learning_sessions row there, and their emotion readings (throttled - see
FORWARD_INTERVAL_SECONDS) get forwarded to it for the duration of the
class, with a final engagement summary pushed when the teacher ends class.

Pseudonym vs. real ID (FR10): emotion-service anonymises student_id before
it ever forwards an emotion event here (see /emotions ingest), so
`joined_students` and the throttle/count bookkeeping below are keyed by
PSEUDONYM to match against those already-anonymised inbound events. The
analytics-service bridge is the deliberate, documented exception - Student
Profile needs the REAL student_id so a student's live-class emotion data
links up with their quiz-submission history under the same identity
(otherwise every student would silently fragment into two disconnected
profiles). join() receives the real ID (from the frontend, same as
before), derives the pseudonym for the matching structures, and keeps the
real ID only in _real_ids, solely to pass to student_profile_bridge calls.
"""

from datetime import datetime
from typing import Dict, List, Optional, Tuple
import time
import uuid

from app.services import student_profile_bridge
from app.services.anonymize import anonymize_student_id

# Emotion readings arrive from the browser every ~2.5s; forwarding every
# single one to analytics-service would be excessive request volume over a
# 40+ minute class. 5s matches the timeline-snapshot cadence emotion-
# service's own tracker already uses (emotion_tracker.py), for consistency.
FORWARD_INTERVAL_SECONDS = 5.0
_ENGAGED_STATES = {"HAPPY", "NORMAL"}


class ClassSessionStore:
    def __init__(self) -> None:
        self.is_live: bool = False
        self.subject: Optional[str] = None
        self.started_by: Optional[str] = None
        self.started_at: Optional[datetime] = None
        self.session_id: Optional[str] = None
        # Real lesson_id from adaptive-learning/backend's lessons.py (e.g.
        # "fractions-bodmas"), not the free-text subject - lets end() tell
        # that service which lesson to mark complete for the roster below.
        # None for a class started without picking a real lesson (e.g. an
        # ad-hoc/topic-only session) - lesson-completion forwarding is
        # simply skipped in that case, everything else works as before.
        self.lesson_id: Optional[str] = None
        self.joined_students: set = set()  # pseudonyms

        # Student Profile (analytics-service) bridging state - all keyed
        # by PSEUDONYM (to match inbound already-anonymised emotion
        # events), except _real_ids which maps pseudonym -> real student_id
        # solely so the analytics-service calls themselves can use the
        # real, cross-linkable identity. Reset alongside everything else
        # in start()/end().
        self._analytics_sessions: Dict[str, str] = {}
        self._real_ids: Dict[str, str] = {}
        self._names: Dict[str, str] = {}
        self._join_times: Dict[str, float] = {}
        self._last_forward_time: Dict[str, float] = {}
        self._reading_counts: Dict[str, int] = {}
        self._engaged_counts: Dict[str, int] = {}
        # Full per-label breakdown per student (e.g. {"HAPPY": 12, "BORED": 3})
        # - same session-long lifetime as _reading_counts/_engaged_counts
        # above (only reset in start()/end(), never trimmed mid-session),
        # unlike emotion_store.py's EmotionStore which only keeps a 60s
        # rolling window and can't answer "what was this student's dominant
        # emotion across the whole class". This is what end() uses to
        # compute a real per-student dominant_emotion for lesson completion.
        self._emotion_label_counts: Dict[str, Dict[str, int]] = {}

    def start(self, subject: Optional[str], started_by: Optional[str], lesson_id: Optional[str] = None) -> None:
        self.is_live = True
        self.subject = subject or "Live Class"
        self.started_by = started_by or "Teacher"
        self.started_at = datetime.utcnow()
        self.session_id = str(uuid.uuid4())[:8]
        self.lesson_id = lesson_id
        self.joined_students = set()
        self._analytics_sessions = {}
        self._real_ids = {}
        self._names = {}
        self._join_times = {}
        self._last_forward_time = {}
        self._reading_counts = {}
        self._engaged_counts = {}
        self._emotion_label_counts = {}

    def end(self) -> Dict:
        """Computes everything BEFORE the reset below, since end() is also
        where this store forgets the whole session. Returns:
          - "engagement_summaries": (real_student_id, analytics_session_id,
            engagement_score, time_on_task_seconds, interaction_count) for
            every student who had an analytics-service session created this
            class - unchanged from before, still consumed by the route
            handler to push a final engagement_metrics row per student.
          - "lesson_id": the real lesson_id this class was for, or None.
          - "lesson_completions": [{"student_id", "dominant_emotion"}, ...]
            for every student on the joined roster (NOT gated on having an
            analytics-service link, unlike engagement_summaries - a lesson
            still gets marked complete even if that sibling service was
            briefly unreachable at join time), with dominant_emotion being
            the modal label from _emotion_label_counts, or None if this
            student never produced a countable reading."""
        now = time.time()
        engagement_summaries = []
        for pseudonym, session_id in self._analytics_sessions.items():
            real_id = self._real_ids.get(pseudonym)
            if not real_id:
                continue
            total = self._reading_counts.get(pseudonym, 0)
            engaged = self._engaged_counts.get(pseudonym, 0)
            engagement_score = (engaged / total) if total > 0 else 0.5
            time_on_task = now - self._join_times.get(pseudonym, now)
            engagement_summaries.append((real_id, session_id, engagement_score, time_on_task, total))

        lesson_id = self.lesson_id
        lesson_completions = []
        if lesson_id:
            for pseudonym in self.joined_students:
                real_id = self._real_ids.get(pseudonym)
                if not real_id:
                    continue
                label_counts = self._emotion_label_counts.get(pseudonym) or {}
                dominant_emotion = max(label_counts, key=label_counts.get) if label_counts else None
                lesson_completions.append({"student_id": real_id, "dominant_emotion": dominant_emotion})

        self.is_live = False
        self.subject = None
        self.started_by = None
        self.started_at = None
        self.session_id = None
        self.lesson_id = None
        self.joined_students = set()
        self._analytics_sessions = {}
        self._real_ids = {}
        self._names = {}
        self._join_times = {}
        self._last_forward_time = {}
        self._reading_counts = {}
        self._engaged_counts = {}
        self._emotion_label_counts = {}
        return {
            "engagement_summaries": engagement_summaries,
            "lesson_id": lesson_id,
            "lesson_completions": lesson_completions,
        }

    def join(self, student_id: str, session_id: str, student_name: Optional[str] = None) -> bool:
        """student_id here is the REAL id, exactly as the frontend sends
        it (this route is called directly, not via emotion-service's
        already-anonymising /predict) - anonymised immediately below.
        student_name is the student's real display name (StudentDashboard's
        auth user.name) - kept only in-memory, pseudonym-keyed, solely so
        the Teacher Console can show a real name next to each joined
        student's live emotion instead of their pseudonym or raw id."""
        if not self.is_live or session_id != self.session_id:
            return False

        pseudonym = anonymize_student_id(student_id)
        self.joined_students.add(pseudonym)
        self._join_times.setdefault(pseudonym, time.time())
        self._real_ids[pseudonym] = student_id
        self._names[pseudonym] = student_name or student_id

        if pseudonym not in self._analytics_sessions:
            # Synchronous but local/fast (analytics-service on localhost);
            # only happens once per student per class, not per reading, so
            # the added latency on the Join button click is negligible.
            # Real ID passed deliberately - see module docstring.
            analytics_session_id = student_profile_bridge.create_session(student_id, self.subject)
            if analytics_session_id:
                self._analytics_sessions[pseudonym] = analytics_session_id

        return True

    def record_emotion_for_bridge(self, pseudonym: str, emotion_label: str) -> Optional[Tuple[str, str]]:
        """Called from the /emotions ingest path for every incoming
        reading - pseudonym is event.student_id, already anonymised by
        emotion-service before this event was ever forwarded. Returns
        (analytics_session_id, real_student_id) to forward this reading to
        analytics-service if this student has a linked session and the
        throttle interval has elapsed - None otherwise (skip, not an
        error). reading/engaged/emotion-label counts, however, are updated
        for every joined student regardless of whether an analytics-service
        link exists, so lesson-completion tracking (end()) still gets a
        real dominant emotion even if that sibling service was briefly
        unreachable at join time."""
        if not self.is_live or pseudonym not in self.joined_students:
            return None

        now = time.time()
        if now - self._last_forward_time.get(pseudonym, 0.0) < FORWARD_INTERVAL_SECONDS:
            return None
        self._last_forward_time[pseudonym] = now

        self._reading_counts[pseudonym] = self._reading_counts.get(pseudonym, 0) + 1
        normalized = (emotion_label or "").upper()
        if normalized in _ENGAGED_STATES:
            self._engaged_counts[pseudonym] = self._engaged_counts.get(pseudonym, 0) + 1
        if normalized:
            label_counts = self._emotion_label_counts.setdefault(pseudonym, {})
            label_counts[normalized] = label_counts.get(normalized, 0) + 1

        session_id = self._analytics_sessions.get(pseudonym)
        real_id = self._real_ids.get(pseudonym)
        if not session_id or not real_id:
            return None
        return session_id, real_id

    def get_state(self) -> Dict:
        if not self.is_live:
            return {"is_live": False}
        return {
            "is_live": True,
            "subject": self.subject,
            "started_by": self.started_by,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "session_id": self.session_id,
            "lesson_id": self.lesson_id,
            "joined_count": len(self.joined_students),
        }

    def get_joined_students(self) -> List[Dict[str, str]]:
        """Real roster of who's actually joined this live class (pseudonym
        + real display name) - the Teacher Console cross-references this
        with emotion-service's live tracker (matched on pseudonym) to show
        each joined student's name next to their current emotion, instead
        of showing every pseudonym emotion-service has ever tracked."""
        if not self.is_live:
            return []
        return [
            {"pseudonym": pseudonym, "name": self._names.get(pseudonym, pseudonym)}
            for pseudonym in self.joined_students
        ]


class_session_store = ClassSessionStore()
