# Research Paper Data Pack — Full System (R26-IT-097)

**AI-Powered Adaptive Learning Platform Using Real-Time Emotion Recognition.**
All figures below are extracted from this repo (code + freshly re-run scripts/tests).
Marked **✘ NOT DONE** = genuinely not measured in the project — do not invent a number.
Component A (emotion recognition) has its own deeper pack:
[`emotion-service/PAPER_DATA_PACK.md`](emotion-service/PAPER_DATA_PACK.md).

---

## 0. System overview

Six services, monorepo:

| Service | Stack | Owner | Role |
|---|---|---|---|
| `frontend/` | Vite + React (JSX), ~18.6k LOC | shared | student + teacher UI, 12 playable games, live-class UI |
| `backend/` | Node/Express + PostgreSQL (`core.users`) | shared | user accounts, JWT auth (migrated off MongoDB; 9 real accounts preserved) |
| `emotion-service/` | Flask + TensorFlow/Keras (:5002) | **IT22140784** | real-time facial emotion recognition (Component A) |
| `emotion-backend/` | FastAPI + Redis | **IT22242754** | class-level emotion analytics, game recommendation, live class, WebRTC (Component D) |
| `adaptive-learning/backend/` | Flask + Redis + MinIO | **IT22186492** | learning outcomes, per-student quiz generation, mastery, adaptive recommendation (Component B) |
| `analytics-service/` | Flask + PostgreSQL (:5010) | **IT22197146** | persistent profiles, statistical analytics, fairness audit, expert-in-the-loop (Component C) |

Data stores: **PostgreSQL** (users + analytics), **Redis** (emotion-backend session/rec
state, adaptive-learning attempt state — survives restart), **MinIO** object storage
(lesson-note PDFs, Postgres metadata).

**Shared pseudonymisation (FR10):** `anonymize_student_id(raw_id) = "anon_" +
SHA-256(f"{SALT}:{raw_id}")[:16]` — the *identical* algorithm + salt is copied into
emotion-service, emotion-backend and adaptive-learning, so one real ID resolves to the
same pseudonym across every service with no shared live lookup. analytics-service keys
on the same pseudonym. One-way (needs salt to reverse), deterministic (history stays
linked). Documented as pseudonymisation, not irreversible anonymisation (a teacher must
be able to re-identify a struggling student).

**Inter-service calls are best-effort / non-blocking everywhere** — a down service
never breaks a student action.

---

## 1. Component A — Real-Time Emotion Recognition (IT22140784)

Full detail in [`emotion-service/PAPER_DATA_PACK.md`](emotion-service/PAPER_DATA_PACK.md).
Headline numbers:

- 6 states (Angry/Bored/Confused/Frustrated/Happy/Normal). Dataset 46,439 images
  (FER-2013 + AffectNet + DAiSEE, incl. **1,721 recovered real DAiSEE Frustrated
  crops**); 80/20 split, test n = 9,288.
- **Deployed fused model (MobileNetV2 + 56-dim MediaPipe blendshape/head-pose branch,
  2.63 M params, ~26 MB): 87 % accuracy, 0.82 macro-F1.** Frustrated recall
  **0.47 → 0.84** vs the previous version, no Confused regression.
- Occlusion handling (Cutout + fixed eye/mouth region weighting): accuracy loss under
  30 % synthetic occlusion **−2 pts** vs a no-handling baseline's **−11 pts**.
- Face-validity gate (MediaPipe landmarks; reject |yaw|>35° / |pitch|>30°).
- Raw-signal 60 s temporal module: `stability_score`, `transition_rate`,
  `current_continuous_duration` + engagement/attention scores.
- **24 FPS in-process, 23.7 FPS live HTTP, ≤ 47 ms p95** (Apple-Silicon CPU; i3/4 GB
  not available — ✘).
- Proposal-faithful from-scratch depthwise-separable CNN reference: **0.18 M params,
  2.3 MB, 79 % accuracy.**

---

## 2. Component B — Learning Outcome Achievement & Adaptive Support (IT22186492)

`adaptive-learning/backend/` (Flask). Regenerate: `.venv/bin/python3 -m
quiz_gen.train_model`, `.venv/bin/python3 -m quiz_gen.verify_generation`.

### 2.1 LO framework
- **Bloom's Taxonomy, 6 cognitive levels**: remember, understand, apply, analyze,
  evaluate, create. **3 items per level → 18 questions per quiz.**
- **6 Mathematics lessons**: `fractions-bodmas`, `number-patterns`, `area-of-shapes`,
  `binary-numbers`, `percentages`, `sets`. Narrowed from the original 10 quiz.pdf
  lessons to exactly the 6 that have a teacher-validated recommendation video
  (§2.5); the other 4 (pythagorean-theorem, circumference-of-a-circle,
  data-representation, angles-of-a-polygon) removed entirely incl. their generators.
- Static content (`lessons.py`): 18 hand-authored questions/lesson verbatim from the
  project's `quiz.pdf`, each tagged `lo_level`, `difficulty` (easy/medium/hard),
  `answer_type` (`fraction` | free-text), optional `accepted_answers`, `set` (1|2 for
  retakes).

### 2.2 Per-student quiz generation (`quiz_gen/`)
- **Template registry** (`templates.py`): 16–18 parametric templates per lesson,
  each valid for specific Bloom levels. **Parametric solvers** (`solvers*.py`) own
  correctness — a generated question's answer is always solver-computed, never
  model-produced.
- **Trained template-selector MLP** (`model.py`, `template_selector.pt`):
  - 2-layer MLP (`Linear(FEATURE_DIM, 16) → ReLU → Linear(16, 1)`), FEATURE_DIM =
    6 lesson one-hot + 6 level one-hot + ~78 keyword flags from the template slug.
  - Scores `(lesson, level, template)` triples. **BCEWithLogitsLoss**; positives =
    registry-valid triples, negatives = mismatched level/lesson.
  - **Training (just run): 939 examples, 300 epochs, Adam lr 0.05, loss
    0.6535 → 0.1215, train accuracy 94.4 %.**
  - At generation: `softmax(scores / temperature=0.7)` sample **only among
    registry-valid templates** for that slot → learned preference, zero path to
    influence correctness. Falls back to uniform random if the checkpoint is absent.
  - Prefers a not-yet-used template for each of a level's 3 slots (variety).
- **Batch correctness verification** (`verify_generation.py`, just run at 200/lesson):

  | Lesson | Quizzes | Questions | Templates registered / used | Errors |
  |---|---|---|---|---|
  | number-patterns | 200 | 3,600 | 16 / 16 | **0** |
  | fractions-bodmas | 200 | 3,600 | 18 / 18 | **0** |
  | binary-numbers | 200 | 3,600 | 18 / 18 | **0** |
  | area-of-shapes | 200 | 3,600 | 18 / 18 | **0** |
  | percentages | 200 | 3,600 | 17 / 17 | **0** |
  | sets | 200 | 3,600 | 17 / 17 | **0** |
  | **Total** | **1,200** | **21,600** | 104 / 104 | **0** |

  Every generated answer self-grades correct via the *same* `mastery._is_correct`
  used on real submissions; every quiz has exactly 3 per level; no template goes
  unused. (Default harness runs 1,000/lesson.)

### 2.3 Mastery model (`mastery.py`)
- **Raw-correct-count tiers per LO**: 3/3 → `good`, 2/3 → `average`, 0–1/3 → `weak`.
  For non-3-item lessons: ratio ≥ 0.9 → good, ≥ 0.5 → average, else weak.
- Replaced an earlier `Weighted Correctness × Difficulty × Cognitive Level` percentile
  model with a 75 % threshold (that formula is gone; `percentile_mastery_score`,
  `mastered`, `overall_percentile_mastery` still returned as plain % for backward
  compatibility with the analytics push and the profile mastery-trend chart).
- `weak_los` (tier ≠ good) drives the recommendation engine; `quiz_set` 1/2 gives a
  retake different questions per LO.

### 2.4 Free-text answer grading (`mastery.py`)
Three tiers, in order:
1. **Exact match** (whitespace/case-normalised) against `answer` + `accepted_answers`.
2. **Fraction equivalence** (`_normalize_fraction`): whole / simple / mixed numbers,
   reduced to lowest terms — `8/12` accepted for `2/3`. Mirrors the JS
   `normalizeFraction()` verified in `fraction-chef-recipe-rescue.jsx`.
3. **Sentence-BERT semantic fallback** (`all-MiniLM-L6-v2`, shared lru-cached
   singleton with the recommender — no second model in memory): cosine similarity
   **≥ 0.80**. Calibrated empirically against this lesson content — every wrong-answer
   similarity observed stayed **< 0.76**; 0.80 sits above that with a margin, a
   deliberate **precision-over-recall** choice (a false positive credits a wrong
   answer; a false negative only trips an unneeded recommendation).
   - **Contrast/comparison answers excluded entirely** (markers `;`, `while`,
     `whereas`, `but`, `versus`, `vs`, `compared to`): sentence embeddings are
     insensitive to negation/clause order — a swapped finite-vs-infinite-set
     definition (definitively wrong) scored **0.92** vs a genuine correct
     paraphrase's **0.78**.
   - Bare numbers/symbols excluded (covered by exact / fraction match).

### 2.5 Emotion-informed recommendation (`semantic_recommender.py`, SO3)
- **For the 6 covered lessons:** returns the **teacher/expert-validated
  (lesson × emotion) YouTube video** directly (`validated_recommendations.py`),
  blended with the matching (lesson × Bloom-level) short note
  (`lesson_resources.py`) — "watch this" + "read this", neither replaces the other.
  Validated URLs were extracted from the source PDF's own hyperlink annotations
  (PyMuPDF link-annotation extraction, not guessed) and cross-checked; **2 ambiguous
  cells** (fractions-bodmas/confused, area-of-shapes/angry) keep a YouTube
  search-query fallback rather than guess.
- **For uncovered lessons:** **Sentence-BERT semantic ranking** — embed the LO
  description and each resource descriptor, rank by cosine similarity ("beyond
  keyword search"), then re-weight (`resolve_recommendation_strategy`, **+0.15
  boost**) by:
  - emotion: confused → easy + reading; frustrated/angry → easy + interactive;
    bored/happy → hard; normal → no bias.
  - mastery tier: weak → easy; average → medium.
- Live emotion is pulled best-effort from emotion-service `GET /students` at
  quiz-submission time (`analytics_bridge.get_live_emotion`, matches on the shared
  pseudonym) so the bias has real data instead of always `emotion=None`.

### 2.6 Adaptive support extras
- **Trend-aware escalation** (`app.py`): after 2 attempts where an LO stays weak and
  hasn't improved (≥ 10 mastery-% gain / tier change) → the results screen offers
  "rejoin the live class" / "ask your teacher" instead of another retake loop; an
  "ask teacher" request is recorded (Redis) and shown in the Teacher Console
  "Students Needing Help" panel, auto-resolving when the student later clears it.
- **Cross-device resume**: quiz/results state persisted server-side (Redis, per
  student) via `/api/students/<id>/attempt-state` — logging in on another laptop
  restores the screen instead of forcing a retake of a now-live-class-gated quiz.
- Lesson-note PDFs served from **MinIO** via Postgres `core.resources` metadata.

### 2.7 ✘ NOT DONE (Component B)
- Controlled **A/B evaluation** (adaptive vs non-adaptive baseline) with real students.
- **SUS** usability study of the feedback interface.
- The proposal's "15–25 % LO improvement / up to 40 % engagement / recommendation
  acceptance ≥ 60 % / relevance ≥ 4.0 Likert / mastery accuracy ≥ 80 % vs teacher
  ratings" targets are **unvalidated projections**.

---

## 3. Component C — Student Profile Management & Statistical Progress Analytics (IT22197146)

`analytics-service/` (Flask + PostgreSQL 15). Tests: `.venv/bin/python -m pytest -q`
→ **26 passed**.

### 3.1 Persistent profile schema (`models/schema.sql` + migrations 001/002)
5 core tables, all indexed for `(student_id, created_at)` time-series and
`(session_id, student_id)` joins:

| Table | Key columns |
|---|---|
| `student_profiles` | student_id (PK, = pseudonym), full_name, email, enrollment_date, grade_level, **demographic_group** (mig 001) |
| `learning_sessions` | session_id (UUID), student_id, lesson_id, lesson_title, start/end time, duration_seconds, **difficulty** easy/medium/hard (mig 001) |
| `lo_achievement_scores` | session_id, student_id, **lo_level** (Bloom, CHECK constraint), score `NUMERIC(5,2)` 0–100 |
| `emotional_states` | session_id, student_id, timestamp, **emotion_label**, confidence 0–1 — vocab fixed in mig 001 to `happy/normal/confused/bored/frustrated/angry` (original schema wrongly had happy/neutral/sad/angry/surprised/confused/bored) |
| `engagement_metrics` | session_id, student_id, engagement_score 0–1, time_on_task_seconds, interaction_count, quiz_attempts |
| `recommendations` (mig 001) | insight_type ∈ {trend, stability, emotion_correlation, engagement_comparison}, recommendation_text, `statistical_evidence` JSONB, status ∈ {pending, approved, modified, rejected}, modified_text, reviewed_by/at, rejection_rationale, lesson_id (mig 002) |
| `intervention_outcomes` (mig 002) | recommendation_id, pre_session_id + pre_score, post_session_id + post_score, outcome ∈ {pending, improved, no_significant_change, declined} |
| `fairness_audits` (mig 002) | metric ∈ {disparate_impact, variance_calibration}, groups_compared / metric_values / threshold JSONB, status ∈ {open, reviewed} |

### 3.2 Statistical Analytics Engine (`statistics_service.py`, SO2)
Five analyses, each a **real scipy statistical test** (not a heuristic), min 3 sessions.
Pure functions — no DB access, tested against synthetic arrays.

| # | Analysis | Method | Decision rule |
|---|---|---|---|
| 1 | **LO trend** | OLS `scipy.stats.linregress` of session-avg score vs session index | p < 0.05 → improving (slope>0) / declining; else stable |
| 2 | **Stability** | population variance + std-dev of session-avg scores | at-risk if student std > **class-mean std + 1.5·SD** (`compute_class_stability_baseline`) |
| 3 | **Emotion–LO correlation** | **Pearson's r** per emotion: session %-of-that-emotion vs session avg score | \|r\| ≥ **0.3** = "meaningful" (effect-size gate); p reported separately |
| 4 | **Engagement–performance** | **Mann–Whitney U** (non-parametric), LO scores in high- (≥ 0.6) vs low-engagement sessions | p < 0.05 significant |
| 5 | **Difficulty–achievement** | OLS regression, score vs difficulty ordinal (easy 1 / medium 2 / hard 3) | needs ≥ 3 tagged sessions across ≥ 2 levels; NULL-difficulty excluded |

### 3.3 Lesson-by-lesson outcome intelligence (`lesson_intelligence_service.py`, SO3)
Regroups the same rows by `lesson_id`, reuses trend + stability per lesson, adds
dominant emotion (mode) + avg engagement, emits a **verdict** per lesson:
`strength` (latest ≥ 75, not declining, not unstable) / `weakness` / `neutral`.
Per-lesson "unstable" = std-dev > **15 percentile points** (absolute bar, cheaper
than a per-lesson class baseline).

### 3.4 Fairness auditing (`fairness_service.py` + `fairness_audit_service.py`, SO4 / FR09)
Two statistical checks, min 3 students/group, ≥ 2 groups:
1. **Disparate impact** — the **80 % rule**: each demographic group's proficiency rate
   (score ≥ **75**) ÷ the most-favourable group's rate; ratio outside **[0.8, 1.25]**
   → flagged.
2. **Variance calibration** — **Levene's test** across groups' score distributions;
   p < 0.05 → unequal reliability → flagged.
Only out-of-range results are **persisted** to `fairness_audits` as `open` alerts
(one per metric until reviewed — no duplicate row per poll).

### 3.5 Expert-in-the-loop validation (`validation_service.py`, SO5, proposal Fig 3)
- Significant findings → `recommendations` table as **`pending`** (never straight to a
  student's path). Teacher/advisor reviews `statistical_evidence` via API → chooses
  `approve` / `modify` / `reject`.
- Only `approve`/`modify` forward to the LO component
  (`lo_component_bridge.forward_recommendation`). `reject` archives with rationale.
- `_has_open_recommendation` dedup — re-running analysis no longer queues unbounded
  near-identical duplicates.
- The `emotion_correlation` text only says "**statistically significant**" when
  `p < 0.05` — else "a notable (though not yet statistically significant) negative
  correlation". Caught a real generated example: r = −0.7559 but p = 0.4544.

### 3.6 Intervention outcome tracking (`intervention_service.py`, SO5 second half)
- On approve/modify → `intervention_outcomes` row anchored to `pre_score` (the
  student's latest session for that lesson **at review time**, not looked up later).
- **Reactively resolved**: `routes/profiles.py` calls `try_resolve_pending()` after
  every `POST /lo-scores`; once a newer session for the same student+lesson lands, the
  post-score is (re)computed and the outcome classified: **improved / declined**
  (± 5 percentile points) / **no_significant_change**. Never claims causation —
  labels describe what was observed.
- `effectiveness_summary()` = per insight-type: applications, improved / no-change /
  declined counts, avg improvement points — the exact shape of the proposal's SO5
  example table.

### 3.7 Data ingress
`adaptive-learning/backend/analytics_bridge.py` pushes real quiz outcomes
(pseudonymised student_id, per-LO scores, session, lesson difficulty) to
analytics-service on **every quiz submission** (best-effort, non-blocking). Emotion +
engagement rows flow from emotion-service / emotion-backend.

### 3.8 ✘ NOT DONE (Component C)
- **Expert evaluation study** — teacher ratings of insight relevance / recommendation
  quality (proposal target: mean Likert ≥ 4.0).
- **Trend-classification accuracy** vs expert teacher labels (target ≥ 85 %).
- **Real demographic data** — fairness runs on `demographic_group` which needs
  consent-gated collection; only synthetic so far.
- **AES-256 at rest** — the proposal claims it; not implemented at the DB layer in
  code (role-based access is enforced via the Node backend's JWT).

---

## 4. Component D — Emotion-Based Analytics & Educational Game Recommendation (IT22242754)

`emotion-backend/` (FastAPI + Redis). Config in `app/config.py`.

### 4.1 Class-level emotion aggregation (`analytics_service.py`)
- Per-student **latest-reading** distribution over a **60 s sliding window**.
- `aggregate_and_store()` runs on a FastAPI-lifespan **background tick every
  `AGGREGATION_INTERVAL_SECONDS = 30 s`**, feeding *both* the pattern detector and the
  dashboard trend from the **same** distribution the teacher sees at
  `/analytics/current` — not a raw per-event count (which would over-weight whoever
  polls most). `calculate_emotion_distribution` is side-effect-free.
- Empty class → `{}` → every streak resets (no data → no pattern).

### 4.2 Dominant-pattern detection (`pattern_detection_service.py`)
A negative emotion must **exceed its class-% threshold**:

| Emotion | Threshold |
|---|---|
| BORED | > 30 % of the class |
| CONFUSED | > 25 % |
| FRUSTRATED | > 20 % |

**AND** stay above it, unbroken, for **`PATTERN_SUSTAINED_SECONDS = 600 s` (10 min)**
(env-overridable; set low for demos) before it fires. Per-emotion unbroken
streak-start tracking; a single over-threshold snapshot or a flickering threshold
never fires. Ties → most severe first (**FRUSTRATED > CONFUSED > BORED**).
`/analytics/pattern` returns `sustained_seconds` + per-emotion `streak_seconds`
(dashboard shows "bored 7m 30s — alerts at 10m").

### 4.3 Game recommendation engine (`recommendation_engine.py`)
- Subject-aware, **time-based variation window = 30 min** (`RecommendationEngine(
  variation_window_minutes=30)`): recently-used game *types* are filtered out; if all
  filtered → least-recent type; never the exact same game twice in a row when an
  alternative exists. History in Redis (`recommendation:history`).
- **⚠ Divergence from the proposal:** the `(subject × dominant-emotion) → game-type`
  mapping is currently **switched OFF** by explicit instruction ("only show games when
  the teacher clicks Recommend"). The engine currently draws from **all** real games
  for the subject (`get_all_games_for`) with the variation-window logic; the
  emotion→bucket table still exists in `game_catalog.py` and is one line from being
  re-enabled (`get_games_for(subject, emotion)`). Per-emotion `trigger_reason` text is
  still surfaced.
- **Lesson-aware**: if the teacher picks a real lesson, narrows to games tagged to
  that `lesson_id`; if none tagged → falls back to the subject pool and reports
  `lesson_matched=False` (honest, not faked relevance).

### 4.4 Game catalog (`game_catalog.py`)
- **78 `GameRecommendation` entries** across subjects (General, Mathematics) × 6
  emotion buckets, each tagged `game_type` (quiz / collaborative / concept-based /
  escape room / calm-down / interactive / simulation / story-based / …),
  `difficulty`, `target_emotion`, `estimated_duration_minutes`, `engagement_score`,
  and (for Mathematics) a real `lesson_id`.
- **12 games are actually built and playable** (frontend routes): fraction-room,
  pirate-navigator, fish-tank-shop, pattern-islands, dark-room-escape, equations-eco,
  eco-blooms-land-sale, magicians-triangle-house, alchemists-potion-lab,
  time-guardians-rounding-clock, laser-heist-parallel-museum,
  fraction-chef-recipe-rescue. Each has a matching lesson + 10 Bloom's-taxonomy
  questions (geometry games' diagrams verified against a standalone trigonometry
  check before wiring in), and reports real results to the Teacher Console via
  `useGameSession` / `reportFinish` — no fake in-game dashboards.

### 4.5 Live class + broadcasts
- `active_recommendation.py`: "Recommend" **live-assigns** a game to joined students,
  real-time results panel (name, score, status, time). Start Quiz / Assign Activity /
  Send Message broadcasts mirror the same pattern.
- `intervention_tracker.py` (Redis): records a game intervention and measures
  class-level negative-emotion % before/after.
- **Real WebRTC screen share** (teacher → students, mesh topology) + text chat over a
  dedicated WebSocket signalling channel (emotion-backend's first WebSocket — the
  right tool for SDP/ICE, vs the platform's usual polling).
- Teacher dashboard (`frontend/src/routes/teacher.jsx`, `TeacherDashboard.jsx`): live
  roster (name + emotion + No-Face/Occluded/Looking-Away indicator), class emotion
  distribution, session trend, pattern-detection status, game recommendation panel +
  history, class analytics + fairness snapshot, attention-drop toast alerts.

### 4.6 ✘ NOT DONE (Component D)
- **SUS** usability study of the teacher dashboard (proposal target ≥ 70).
- **Emotion-aggregation accuracy** vs known synthetic input distributions as a formal
  test (the logic is straightforward % arithmetic, but no test asserts it).
- The "**≥ 20 % reduction in class negative emotion** after a game" engagement metric.
- Teacher **relevance-rating** study (target Likert ≥ 4.0).
- No automated test suite in `emotion-backend/`.
- Emotion→game mapping is off (see 4.3) — a deliberate product decision, but a gap vs
  the proposal's SO3.

---

## 5. Cross-component integration & data flow

```
                webcam frame (base64)
Student UI ──────────────────────────► emotion-service  POST /predict   (Component A)
                                          │  6-class + confidence + 60s temporal features (JSON)
                                          ├──► emotion-backend  (Component D)
                                          │      • 60s class distribution, 30s aggregation tick
                                          │      • sustained-streak pattern detection
                                          │      • game recommendation (variation window)
                                          │      • teacher dashboard / live class / WebRTC
                                          │      └──► analytics-service  (aggregated class emotion)
                                          └──► analytics-service  emotional_states rows  (Component C)

Student takes quiz ──► adaptive-learning  (Component B)
   • per-student 18-Q quiz (template MLP + solvers, 0 errors / 21,600 verified)
   • mastery tiers (good/average/weak per LO)
   • Sentence-BERT + emotion-biased recommendation (live emotion pulled from A)
   └──► analytics-service  learning_sessions + lo_achievement_scores + difficulty  (Component C)

analytics-service  (Component C, PostgreSQL)
   • 5 scipy statistical analyses over the accumulated multi-session profile
   • lesson-by-lesson intelligence, fairness audit (80% rule + Levene)
   • expert-in-the-loop: pending → teacher approve/modify/reject
   • approved recommendation ──► forwarded back to adaptive-learning (Component B)
   • intervention outcome tracked when the next session's scores land
```

**Emotion ↔ quiz linkage:** a live class's analytics `session_id` is threaded through
`lesson_progress.mark_completed`; quiz submission then copies that class's real emotion
readings onto its own session (`POST /sessions/<id>/copy-emotional-states`) so a single
session has **both** emotion and LO scores — needed for the Component C emotion–LO
correlation and the profile "negative emotion % vs performance" chart.
**Live-verified end-to-end:** 3 real live-class + quiz cycles, clean negative
correlation (0 % negative emotion → 100 % score, 100 % → 0 %).

**Shared emotion vocabulary:** `HAPPY / NORMAL / CONFUSED / BORED / FRUSTRATED / ANGRY`
across A, C (post-migration), D. (Component B maps the same 6 to recommendation bias
keys.)

---

## 6. Shared: stack, privacy, SDG

- **Backends:** Flask (A, B, C), FastAPI (D), Node/Express (auth). **PyTorch**
  (B's template selector), **TensorFlow/Keras** (A's CNN), **scipy**
  (C's statistics), **sentence-transformers `all-MiniLM-L6-v2`** (B's grading +
  recommendation), **MediaPipe** (A's landmarks/blendshapes). **PostgreSQL** (users,
  analytics), **Redis** (D + B state), **MinIO** (PDFs). **React + Vite** frontend.
- **Privacy:** shared SHA-256 pseudonymisation across 4 services (§0); emotion-service
  stores no raw facial image beyond the current frame (FR09); analytics-service
  fairness alerts persisted (FR09); all inter-service calls best-effort.
- **Datasets** used in reported work are all public / academic (FER-2013, AffectNet,
  DAiSEE, quiz.pdf content). **No live human-subject data collection** — any pilot is
  gated on informed consent, parental consent < 18, IRB approval, fairness audit.
- **SDG alignment** (proposal): SDG 4 (Quality Education), 10 (Reduced Inequalities),
  16 (ethical/transparent AI — expert-in-the-loop + fairness audit), 12 (lightweight,
  low-energy models).

---

## 7. Objective → evidence, per component

### Component A (IT22140784) — see `emotion-service/PAPER_DATA_PACK.md` §14
SO1 ✔ (87 %, exceeds 80 %) · SO2 ✔ implemented / ✘ expert-label validation ·
SO3 ✔ (Δ −2 vs −11 pts, caveat: 3-class baseline) · SO4 ✔ on available HW / ✘ i3 ·
SO5 ✔ JSON API + integration, live-verified / ✘ formal report · SO6 ~ partial.

### Component B (IT22186492)
| SO | Status | Evidence |
|---|---|---|
| SO1 Bloom LO framework + automated quiz gen | ✔ | 6 lessons × 18 Q (3/Bloom level); template-MLP + solvers; **21,600 generated Q, 0 errors** |
| SO2 proficiency / percentile mastery model | ✔ | raw-count `good/average/weak` tiers per LO (+ % kept for compat) |
| SO3 emotion-informed personalised recommendation | ✔ | teacher-validated (lesson × emotion) videos + Sentence-BERT semantic ranking, emotion/mastery re-weighting |
| SO4 real-time feedback interface, mastery-focused | ✔ | results screen + trend-aware "extra help" escalation + cross-device resume |
| SO5 controlled adaptive-vs-baseline evaluation + surveys | ✘ NOT DONE | no A/B study, no SUS; targets are projections |
| SO6 (optional) cognitive-load / engagement impact | ✘ NOT DONE | |

### Component C (IT22197146)
| SO | Status | Evidence |
|---|---|---|
| SO1 persistent multi-session profile model | ✔ | PostgreSQL 5-table schema + 2 migrations, indexed for longitudinal queries |
| SO2 statistical analytics engine (trend, stability, emotion-corr, engagement, difficulty) | ✔ | 5 real scipy tests (`linregress`, `pstdev`, `pearsonr`, `mannwhitneyu`, OLS); **26 unit tests pass** |
| SO3 lesson-by-lesson outcome intelligence | ✔ | `lesson_intelligence_service.py` — per-lesson trend + stability + verdict |
| SO4 benchmarking + fairness evaluation | ✔ | class-baseline benchmarking; disparate-impact 80 % rule + Levene; alerts persisted |
| SO5 expert-in-the-loop validation + outcome tracking | ✔ | `recommendations` pending→approve/modify/reject; `intervention_outcomes` improved/declined/no-change |
| — expert evaluation study / 85 % trend-accuracy / real demographics / AES-256 | ✘ NOT DONE | |

### Component D (IT22242754)
| SO | Status | Evidence |
|---|---|---|
| SO1 real-time emotion aggregation, ≥ 30 s refresh | ✔ | 60 s window, 30 s background tick, per-student distribution |
| SO2 interactive teacher dashboard | ✔ | live roster + distribution + trend + pattern status + game panel + WebRTC; **✘ SUS ≥ 70 not measured** |
| SO3 subject-aware game recommendation, variation window | ✔ (partial) | 30-min variation window, lesson-aware narrowing; **emotion→game mapping currently OFF** |
| SO4 platform integration (emotion in, class data out to IT22197146) | ✔ | consumes emotion-service, forwards aggregated class emotion to analytics-service |
| SO5 mixed-methods evaluation (engagement metrics + SUS) | ✘ NOT DONE | no ≥ 20 % negative-emotion-reduction metric, no SUS, no relevance study |

---

## 8. Whole-system honest gaps (put in Limitations / Future Work)

1. **No study with real student cohorts** — every component's evaluation is technical
   (accuracy, latency, statistical validity, generation correctness) or
   live-functional, not a controlled trial. The proposal's outcome targets
   (LO +15–25 %, engagement +40 %, SUS ≥ 70, Likert ≥ 4.0, trend-accuracy 85 %) are
   unvalidated.
2. **Emotion recognition** not benchmarked on the proposal's i3/4 GB CPU target.
3. **Component D emotion→game mapping is disabled** (product decision).
4. **Fairness audit** runs on synthetic `demographic_group` data — real demographics
   need consent-gated collection.
5. **Component A temporal features** and **Component C statistical outputs** are not
   validated against expert-labelled ground truth.
6. **AES-256 at rest** (Component C proposal claim) not implemented at the DB layer.
7. Integration is verified **functionally / end-to-end**, not via a formal
   schema-conformance / contract test suite.

---

## 9. Suggested system-level figures

| Fig | Content | Source |
|---|---|---|
| 1 | 4-component platform architecture + 6 services + data stores + data flow (§5) | this doc |
| 2 | Component A: two-branch fused model + real-time pipeline | `emotion-service/PAPER_DATA_PACK.md` §15 |
| 3 | Component A: v3→v5 per-class F1 bar chart (Frustrated recall 0.47→0.84) | `evaluate_fused_model_v5.py` / `_v3.py` |
| 4 | Component A: occlusion Δ (baseline −11 vs handled −2 pts) | §1 / `evaluate_fused_model_v2_occlusion.py` |
| 5 | Component B: quiz-generation pipeline (registry → template-selector MLP → solver → self-verify) + the 21,600-Q / 0-error table | §2.2 |
| 6 | Component B: mastery-tier + recommendation flow (weak LO → validated video + emotion/mastery re-weighting) | §2.3–2.5 |
| 7 | Component C: PostgreSQL ER diagram (5 tables + 3 mig tables) | `models/schema.sql` + migrations |
| 8 | Component C: expert-in-the-loop workflow (pending → approve/modify/reject → forward → outcome tracked) | §3.5–3.6 |
| 9 | Component C: one worked statistical analysis (e.g. emotion–LO Pearson scatter, or stability at-risk vs class baseline) | `statistics_service.py` on real/synthetic profile |
| 10 | Component D: pattern-detection timeline (BORED % vs 30 % threshold, 10-min sustained bar) + game recommendation | `pattern_detection_service.py` |
| 11 | Component D: teacher dashboard screenshot | `frontend/src/routes/teacher.jsx` |
| 12 | Emotion ↔ quiz linkage: negative-emotion % vs quiz score (0 %→100 %, 100 %→0 %) | live-verified, §5 |
```
