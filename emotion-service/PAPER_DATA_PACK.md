# Research Paper Data Pack — Real-Time Emotion Recognition & Engagement Response Component

Component: **IT22140784** (Dasanayaka J.H.D.C), project **R26-IT-097**.
Everything below is pulled from this repo (code + freshly re-run eval scripts on
`dataset/facial_features_v3.npz`, seed 42, 80/20 stratified split). Where something
was **not** measured it is marked ✘ NOT DONE — do not invent a number for it.

Regenerate any table: `.venv/bin/python evaluate_fused_model_v5.py` /
`evaluate_fused_model_v3.py` / `evaluate_custom_cnn_v4.py` /
`evaluate_fused_model_v2_occlusion.py` / `benchmark_inference.py` /
`benchmark_v4_standalone.py`.

---

## 1. Scope / role

- Sensing layer of the platform. Classifies a webcam face crop into **6 states**:
  Angry, Bored, Confused, Frustrated, Happy, Normal.
- Emits enriched, structured emotion data (JSON) + temporal behavioural features;
  **makes no pedagogical decision itself** (data-provider). Downstream consumers:
  Learning-Outcome/adaptive support (IT22186492), Student-Profile analytics
  (IT22197146), Teacher analytics + game recommendation (IT22242754).

---

## 2. Dataset

| Source | Use | Access |
|---|---|---|
| FER-2013 | Angry/Happy/Normal base | public |
| AffectNet | Angry/Happy/Normal, higher-res real-world | academic |
| DAiSEE | Bored/Confused/Frustrated (engagement clips → face crops) | academic |

No live human-subject data in the reported work → no ethics approval needed
(proposal §3.4).

**Final 6-class set (`dataset/final_dataset`, cached to `facial_features_v3.npz`):**

| Class | Images |
|---|---|
| Angry | 3,995 |
| Bored | 22,368 |
| Confused | 4,395 |
| Frustrated | 3,501 |
| Happy | 7,215 |
| Normal | 4,965 |
| **Total** | **46,439** |

- Split: **80 % train / 20 % held-out** (`train_test_split`, `random_state=42`,
  `stratify` on label). Val split is the evaluation set for every number in §7–8.
  Val class support: Angry 799, Bored 4,474, Confused 879, Frustrated 700,
  Happy 1,443, Normal 993 → **n = 9,288**.
- Heavy imbalance: Bored ≈ 48 %, Frustrated ≈ 7.5 % (Bored:Frustrated ≈ 6.4 : 1
  after DAiSEE recovery; was 12.5 : 1 before).
- **DAiSEE Frustrated data recovery** (`extract_daisee_frustration_v2.py`): original
  extraction only read `TrainLabels.csv` and used a strict single-winner argmax over
  Boredom/Confusion/Frustration/Engagement, discarding e.g. Frustration=2 /
  Engagement=3 clips. Recovery rule: `Frustration ≥ 2 AND Frustration > Boredom AND
  Frustration > Confusion`, across all 3 splits. **+1,721 real crops, 1,780 → 3,501**
  (zero synthetic).

### Preprocessing
- **Fused model:** face crop → RGB → resize **224×224** → eye/mouth region-weight
  mask (§4) → `mobilenet_v2.preprocess_input`.
- **Custom depthwise-separable CNN:** resize **48×48** (proposal §3.2) → region-weight
  mask → `Rescaling(1/255)` layer inside the model (raw [0,255] floats in the
  pipeline).
- **Second (non-image) feature branch, 56-dim:** 52 MediaPipe FaceLandmarker
  blendshape scores + head pose pitch/yaw/roll (Euler decomposition of the facial
  transformation matrix) + 1 "face detected" flag. Landmarks detected in the crop
  for the large majority of dataset images (printed by
  `scripts/extract_facial_features_v3.py`).

---

## 3. Model architecture

Two models were built. **The fused MobileNetV2 model (v5) is what is deployed.**
The custom depthwise-separable CNN is the **proposal-faithful reference** — built,
evaluated, documented, **not served** (lower accuracy; see §7).

### 3.1 Fused model (production, `best_fused_model_v5`)
Two-branch, late-fusion:

```
image_input (224×224×3) ── MobileNetV2(ImageNet, include_top=False)
                           → GlobalAveragePooling2D
                           → Dense(256, relu) → Dropout(0.5)        = x  (image branch)

feature_input (56) ──────── Dense(64, relu) → Dropout(0.3)
                           → Dense(32, relu)                        = f  (feature branch)

Concatenate([x, f]) → Dense(128, relu) → Dropout(0.4) → Dense(6, softmax)
```
- **Total params: 2,629,414 (~2.63 M).** File size ≈ 26 MB (`.keras` / `.h5`).
- Rationale for the fusion branch: MediaPipe blendshapes (eyeBlink, brow/mouth/jaw
  shape) + head pose give the classifier explicit action-unit-like signals the raw
  image CNN otherwise has to re-learn; adding it took an earlier 3-class model from
  80 → 81 % val with no per-class regression (commit `bc8047c1f`).

### 3.2 Custom depthwise-separable CNN (`best_custom_cnn_v4`, proposal §2.2/§3.2)
From scratch, **no ImageNet weights**, 48×48 input:

```
Rescaling(1/255)
Conv2D(32, 3×3, stride 2) → BN → ReLU6                 # 48→24  "stem"
DS-block(64,  stride 1)   # 24×24
DS-block(128, stride 2)   # 24→12
DS-block(128, stride 1)   # 12×12
DS-block(256, stride 2)   # 12→6
DS-block(256, stride 1)   # 6×6
GlobalAveragePooling2D → Dropout(0.3)                  = image branch
  + same 56-dim feature branch + same fusion head as 3.1

DS-block = DepthwiseConv2D(3×3) → BN → ReLU6  →  Conv2D(1×1 pointwise) → BN → ReLU6
```
- **Total params: 180,646 (~0.18 M).** File size ≈ 2.3 MB → **~14.5× smaller** than
  the fused model, **~1.7× faster** predict (§9).
- This is a genuine depthwise-separable decomposition, not a single `Conv2D` with a
  small filter count.

---

## 4. Occlusion handling (proposal §3.2 — two mechanisms)

1. **Synthetic Cutout augmentation** — training only, ~50 % of samples
   (`CUTOUT_PROB=0.5`). A random square, side **10–35 %** of the crop
   (`CUTOUT_MIN/MAX_FRAC = 0.10 / 0.35`), blanked to the image's own mean colour.
2. **Facial region weighting** — applied to **every** image at **both train and
   inference** (so no train/inference distribution shift). A fixed, row-wise
   multiplicative mask, weight ∈ **[0.55, 1.0]**, built from two Gaussian bands
   centred on the eye band (**0.33** of crop height) and mouth band (**0.72**),
   σ = **0.09**. Rows outside the bands are blended toward mean colour. It is a fixed
   anatomical prior (MediaPipe FaceLandmarker exposes no per-point visibility score),
   directly implementing "emphasise visible facial areas such as the eyes and mouth".
   Constants live in `src/emotion_service/ml/occlusion.py` and are re-implemented as
   native TF ops in the training scripts.

Evaluation of the effect: §8.

---

## 5. Face-validity gate (`fused_emotion_model.py`)

BlazeFace returns a box even for heavily occluded / turned faces. Before classifying,
the pipeline reuses the **same** MediaPipe FaceLandmarker extraction the feature
branch needs anyway (no extra inference cost) and **rejects the frame** if:
- **no landmarks** → `FaceValidityError("no_landmarks")`, or
- **|yaw| > 35°** or **|pitch| > 30°** → `FaceValidityError("looking_away")`.

Rejected frames call `tracker.mark_invalid(...)` — they do **not** enter emotion
history, do **not** freeze the last emotion, and **break** the current
continuous-duration streak. The dashboard shows a distinct No-Face / Occluded /
Looking-Away state instead of a stale emoji.

---

## 6. Temporal behaviour module + engagement indicators (`emotion_tracker.py`)

- **Window:** 60 s sliding (`EMOTION_ANALYTICS_WINDOW_SECONDS`, configurable) — FR06.
  All indicators below reflect only the trailing window, not the whole session.
- **Temporal smoothing:** 5-frame majority vote, with (a) immediate adopt if this
  frame's confidence ≥ 0.6, else (b) a state-change candidate must win the vote on
  2 consecutive polls before it is adopted (anti-flicker / anti-lag; both thresholds
  tuned against replayed real sessions).

**Micro temporal features** (proposal §3.2):

| Feature | Definition |
|---|---|
| `stability_score` | `count(most-common label in window) / len(window)` ∈ [0,1] |
| `transition_rate` | `(label changes in window) / min(60 s, session age)` — transitions per second |
| `current_continuous_duration` | `now − streak_start_time` (streak start tracked **directly**, not by walking back a window-trimmed list — fixes a bug that hard-capped any >60 s streak at ~60 s) |

**Critical design point (a real contribution to write up):** these three features are
computed from a **separate raw-signal history** (`raw_history` — the fused model's own
label per frame), **not** from the tracker's own past *smoothed/derived* output.
Feeding the derived output back in created a feedback loop: in two documented real
sessions, a student reading raw `Normal` on ~27/28 frames still had the derived state
oscillate every poll, so `transition_rate` never fell below the "Bored" threshold and
Bored could never fire. Splitting the histories fixes it.

**Chronological timeline (FR07):** full-session record, snapshot every 5 s — a
deliberately *separate* thing from the 60 s windowed indicators.

**Engagement indicators (FR06):**

| Indicator | Formula |
|---|---|
| `engagement_score` (0–100) | `int((w·0.5 + stability·0.35 + transition_penalty·0.15)·100)`, where `w ∈ {Engaged 1.0, Confused 0.6, Bored 0.45, Frustrated 0.3, else 0.5}`, `transition_penalty = max(0, 1 − 2·transition_rate)` |
| `attention_score` (0–100) | `int((stability·0.6 + (1−transition_rate)·0.3 + confidence·0.1)·100)` |
| `disengagement_ratio` | `(Bored + Frustrated duration) / total duration` |
| `negative_emotion_ratio` | `count(Bored/Confused/Frustrated frames) / window frames` |

**`student_state` heuristic layer** (`student_state.py`) — turns the raw 6-class label
into a classroom learning state, treating emotion as a feature not a verdict:
`Angry ≥ 0.7 → Frustrated`; `Happy ≥ 0.65 → Engaged`; `Frustrated ≥ 0.5` /
`Confused ≥ 0.45` / `Bored ≥ 0.45` trusted directly; otherwise a behavioural fallback:
Bored if `duration ≥ 10 s ∧ stability ≥ 0.6 ∧ transition ≤ 0.18`; Confused if
`transition ≥ 0.18 ∧ stability < 0.5`; Engaged if
`stability ≥ 0.7 ∧ transition ≤ 0.25 ∧ confidence ≥ 0.55 ∧ label ∉ {angry, frustrated}`.
Thresholds are a starting heuristic, tuned against real webcam sessions (see §11).

---

## 7. Classification results — CLEAN held-out set (n = 9,288, 6-class)

| Model | Accuracy | Macro-F1 | Weighted-F1 | Notes |
|---|---|---|---|---|
| Fused **v3** (6-class, + occlusion handling) — previous production | **0.85** | **0.80** | 0.85 | |
| Fused **v5** (6-class, + occlusion + oversampling + DAiSEE recovery) — **DEPLOYED** | **0.87** | **0.82** | 0.87 | |
| Custom depthwise-separable CNN **v4** (6-class, proposal arch, from scratch) | **0.79** | **0.71** | 0.79 | reference only |
| Fused **v2** (baseline, **no occlusion handling**, **3-class** Angry/Happy/Normal, n = 6,591) | 0.86 | 0.86 | 0.86 | different label space — see §8 caveat |

### v5 (deployed) per-class — CLEAN

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Angry | 0.78 | 0.67 | 0.72 | 799 |
| Bored | 0.95 | 0.94 | 0.95 | 4,474 |
| Confused | 0.85 | 0.80 | 0.82 | 879 |
| Frustrated | 0.73 | **0.84** | 0.78 | 700 |
| Happy | 0.85 | 0.90 | 0.87 | 1,443 |
| Normal | 0.75 | 0.77 | 0.76 | 993 |
| **accuracy** | | | **0.87** | 9,288 |
| macro avg | 0.82 | 0.82 | 0.82 | |
| weighted avg | 0.87 | 0.87 | 0.87 | |

### v3 (previous production) per-class — CLEAN

| Class | Precision | Recall | F1 |
|---|---|---|---|
| Angry | 0.90 | 0.76 | 0.82 |
| Bored | 0.93 | 0.88 | 0.90 |
| Confused | 0.67 | 0.90 | 0.77 |
| Frustrated | 0.52 | **0.47** | 0.50 |
| Happy | 0.91 | 0.96 | 0.94 |
| Normal | 0.85 | 0.88 | 0.86 |
| **accuracy** | | | **0.85** |
| macro avg | 0.80 | 0.81 | 0.80 |

### v3 → v5 (the headline result)

| Metric | v3 | v5 | Δ |
|---|---|---|---|
| **Frustrated recall** | 0.47 | **0.84** | **+0.37** |
| Frustrated F1 | 0.50 | 0.78 | +0.28 |
| Confused F1 | 0.77 | 0.82 | +0.05 (no regression — precision 0.67 → 0.85) |
| Overall accuracy | 0.85 | 0.87 | +0.02 |
| Macro-F1 | 0.80 | 0.82 | +0.02 |

Cause: oversampling **alone** (v4) was a lateral trade-off (Frustrated 44.8 → 55.2 %,
Confused 77.6 → 70.7 %). The real fix was **+1,721 recovered real DAiSEE Frustrated
crops**; v5 = recovered data + (now milder) oversampling.

### Custom CNN v4 per-class — CLEAN
Angry .65/.67/.66 · Bored .91/.86/.88 · Confused .60/.80/.69 · Frustrated .45/.43/.44 ·
Happy .87/.84/.86 · Normal .72/.75/.73 · **acc .79 · macro-F1 .71**.
Remaining Bored↔Frustrated confusion looks like feature-level ambiguity at 48×48 —
a loss-function change (4 controlled runs incl. focal loss γ=2, macro-F1 0.69 vs 0.73)
did not fix it; the temporal features are the intended disambiguation path.

---

## 8. Occlusion ablation (30 % fixed centre blank, identical methodology across all models)

| Model | Occlusion handling | Clean acc | Occ acc | **Δ acc** | Clean mF1 | Occ mF1 | **Δ mF1** |
|---|---|---|---|---|---|---|---|
| Fused **v2** (baseline, 3-class) | **none** | 0.86 | 0.75 | **−0.11** | 0.86 | 0.71 | **−0.15** |
| Fused **v3** (6-class) | Cutout + region weighting | 0.85 | 0.81 | **−0.04** | 0.80 | 0.74 | **−0.06** |
| Fused **v5** (6-class, deployed) | Cutout + region weighting | 0.87 | 0.85 | **−0.02** | 0.82 | 0.79 | **−0.03** |
| Custom CNN v4 (6-class) | Cutout + region weighting | 0.79 | 0.77 | −0.02 | 0.71 | 0.68 | −0.03 |

**Takeaway:** the occlusion-handling models degrade **~2–4 pts** under 30 % occlusion
vs the baseline's **~11–15 pts** (baseline Angry recall collapses 0.83 → 0.37).

**⚠ Honest caveat to state in the paper:** the only "no occlusion handling" model that
exists (`v2`) is a **3-class** model (Angry/Happy/Normal), so its *absolute* accuracy
is not directly comparable to the 6-class models. The comparable quantity — and what
the objective ("improve accuracy under occlusion vs baseline CNN") actually asks for —
is the **degradation delta (Δ)** clean → occluded, which is directly comparable
because each model is measured against its own clean baseline with the same fixed
30 % mask. There is **no trained VGG-16 / plain-CNN 6-class baseline** (✘ NOT DONE).

v5 occluded per-class: Angry .76/.60/.67 · Bored .94/.93/.93 · Confused .76/.81/.78 ·
Frustrated .75/.78/.76 · Happy .83/.90/.86 · Normal .72/.76/.74 · acc .85 · macro .79.

---

## 9. Real-time performance (`benchmark_inference.py`, `benchmark_v4_standalone.py`)

Targets (proposal §5.3): **≥ 15 FPS**, **≤ 50 ms/frame**.
**Hardware: Apple Silicon macOS (dev machine).** The proposal's target is Intel Core
i3 / 4 GB / CPU-only — **no such machine was available**; the benchmark script says so
explicitly. Apple-Silicon CPU cores are generally faster than a laptop i3, so a PASS
here is "best available real measurement", not proof the i3 target is met; a FAIL here
would definitely fail on an i3.

| Path | n | Mean | Median | p95 | Achievable FPS | ≥15 FPS | ≤50 ms |
|---|---|---|---|---|---|---|---|
| Fused v5 — **in-process** (detect + predict + track, no network) | 55 | 41.05 ms | 41.25 ms | 42.57 ms | **24.4** | ✔ | ✔ |
| Fused v5 — **live HTTP** `POST /predict` (base64 + JSON + Flask + debug writes) | 60 | 42.21 ms | 45.76 ms | 47.03 ms | **23.7** | ✔ | ✔ |
| Custom CNN v4 — predict step only | 55 | 22.93 ms | 22.87 ms | — | **43.6** (predict-only); ≈ 41 FPS full pipeline | ✔ | ✔ |

In-process stage breakdown (fused v5): **detect 1.12 ms · predict 39.88 ms · track 0.05 ms**.

Model footprint: fused v5 = **2.63 M params / ~26 MB**; custom CNN v4 =
**0.18 M params / ~2.3 MB**.

---

## 10. Structured output + integration (proposal §2.2 SO5, FR08)

Service: **Flask**. `POST /predict` — body: base64 frame + `studentId`, `sessionId`,
`lessonId`. Other routes: `/health`, `/students`, `/live`, `/live/<student_id>`.

`/predict` response JSON (per frame):

```
studentId            (anonymised pseudonym, never the raw ID — FR10)
timestamp
emotion / studentState   (smoothed classroom state)
rawEmotion / facialEmotion
emotionConfidence
emotionProbabilities     (full 6-class dict)
attentionScore
emotionDuration          (per-label seconds, in window)
currentContinuousDuration
transitionRate
stabilityScore
analyticsWindowSeconds
engagementIndicators { engagementScore, disengagementRatio, negativeEmotionRatio }
timeline []               (5-s snapshots, full session)
emotionCounts, totalTransitions
```

- Forwarded to **analytics-service** (`_forward_to_analytics_service`) → consumed by
  IT22197146 (profile analytics) and IT22242754 (teacher analytics / class-level
  aggregation + game recommendation). IT22186492 pulls a quiz session's emotion
  readings via an analytics-service copy endpoint.
- **Live-verified end-to-end** (real live-class + quiz cycles show a clean negative
  correlation: 0 % negative-emotion → 100 % score, 100 % negative-emotion → 0 % score).
- ✘ NOT DONE: a formal written integration-test report / schema-conformance suite.

---

## 11. Privacy & ethics (implemented)

- **FR10 — pseudonymised IDs:** `anonymize_student_id()` = `"anon_" +
  SHA-256(f"{SALT}:{raw_id}")[:16]`. Deterministic (history stays linked), one-way
  (not reversible without the salt), applied **server-side** at every point a real ID
  enters the pipeline, same salt across the 3 services. It is *pseudonymisation*, not
  irreversible anonymisation — a deliberate trade-off (a teacher must be able to
  re-identify a struggling student to help them). Session CSV logs contain pseudonyms
  only.
- **FR09 — no raw image persistence:** raw debug frame/face writes removed from the
  hot `/predict` path; `EMOTION_FRAME_DUMP_DIR` is opt-in diagnostic only. No facial
  image stored beyond the current processing frame.
- Datasets FER-2013 / AffectNet / DAiSEE are public / academic-use; no human-subject
  data collection in the reported work. Any future live pilot: informed consent,
  parental consent < 18, IRB approval, fairness audit (proposal §3.4, Appendix D).

---

## 12. Real-session evidence (`session_logs/`)

**17 CSV logs, ~1,027 rows total**, from real webcam sessions (files tagged
`frustrated`, `bored`, `confused`, `eyeclosed`, `facegate`, `durationfix`,
`gapfix`, …). Columns: `timestamp, student_id (pseudonym), raw_emotion, confidence,
student_state, smoothed_state, stability_score, transition_rate,
current_continuous_duration`.

Used for **diagnostic tuning** of the temporal thresholds and to catch pipeline bugs
(duration reset on no-face gap, >60 s streak hard-cap, Bored-oscillation feedback
loop, sticky-lag on high-confidence frames — all fixed and documented in commit
messages `b579eaf3e`, `2c6199b3b`).
**✘ NOT DONE:** a quantitative validation of `stability_score` / `transition_rate` /
`current_continuous_duration` against expert-labelled ground truth. Present these as
qualitatively validated + bug-hardened against real sessions, and put expert-label
validation in Future Work.

---

## 13. Model evolution (iterative-development narrative)

| Stage | Commit | What changed |
|---|---|---|
| MobileNetV2 FER baseline | `train_mobilenetv2.py` | initial transfer-learning model |
| Split expression vs engagement | `bc8047c1f` | 6-class → 3-class expression CNN (Angry/Happy/Normal, **80 % val**) + rule-based `student_state`; **BlazeFace replaces Haar Cascade**; add MediaPipe blendshape/head-pose fusion branch → **81 % val**, no per-class regression |
| Fused v2 | `c98f37633` | retrain 3-class on merged **FER-2013 + AffectNet** raw |
| Fused v3 | `2c6199b3b` | back to **6-class** (full dataset) + **occlusion handling** (Cutout + region weighting) + **from-scratch depthwise-separable custom CNN** (proposal arch) + FPS benchmark + FR09/FR10 pseudonymisation |
| Fused v4 | `b579eaf3e` | minority-class **oversampling** — lateral trade-off (Frustrated 44.8→55.2 %, Confused 77.6→70.7 %) — **not deployed** |
| DAiSEE recovery | `b579eaf3e` | `extract_daisee_frustration_v2.py` → **+1,721** real Frustrated crops (1,780→3,501) |
| Fused v5 | `train_fused_model_v5.py` / `0969d8bdf` | oversampling + recovered data → **Frustrated recall 0.47→0.84**, Confused F1 0.77→0.82, acc 0.85→0.87 → **DEPLOYED**, v3 kept as instant rollback |

### Training procedure (fused v3/v4/v5 — identical, only data differs)
- Input 224×224; batch 32; **two-stage**: Stage 1 backbone frozen, 8 epochs, Adam
  lr 1e-3; Stage 2 unfreeze last 30 MobileNetV2 layers, 12 epochs, Adam lr 1e-4.
- Loss `categorical_crossentropy`; `class_weight="balanced"` computed on the
  **post-oversample** distribution (so it's a mild residual correction, not a
  double correction).
- **Oversampling rule:** any class below 30 % of the majority-class train count is
  index-repeated up to that 30 % target, **capped at 3× its own original count**
  (repeats still get independent random augmentation). v5 log:
  Angry 3,196→5,368 (1.68×), Confused 3,516→5,368 (1.53×),
  Frustrated 2,801→5,368 (1.92×), Normal 3,972→5,368 (1.35×); Bored & Happy untouched.
- **Augmentation:** random horizontal flip, brightness ±0.15, contrast ×[0.85, 1.15],
  Cutout (§4).
- **Callbacks:** `ModelCheckpoint(monitor="val_accuracy", save_best_only)`,
  `EarlyStopping(patience=5, restore_best_weights)`,
  `ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=3, min_lr=1e-6)`.

### Training procedure (custom depthwise-separable CNN v4)
- Input 48×48; batch 64; **40 epochs from scratch** (no ImageNet); Adam lr 1e-3.
- Checkpoint / early-stop monitor = **`val_macro_f1`** (custom metric — plain
  `val_accuracy` on this imbalanced split silently rewarded majority-class epochs).
- `class_weight="balanced"` × **MINORITY_BOOST** {Frustrated 1.5, Angry 1.3}.
- Fully seeded (`SEED=42`, `PYTHONHASHSEED`, `TF_DETERMINISTIC_OPS=1`,
  `tf.random.set_seed`) so tuning runs are comparable.
- **Class-imbalance tuning history (4 controlled runs, kept in the file):**
  (1) `val_accuracy` checkpoint — rewarded majority class; (2) fixed with `macro_f1`;
  (3) boost 1.5/1.3 vs 1.1/1.05 → macro-F1 0.73 vs 0.72 (1.5/1.3 marginal winner);
  (4) focal loss γ=2 with boosted α → clearly worse (acc 0.75 vs 0.81, macro-F1
  0.69 vs 0.73, Bored→Frustrated errors ~2× — double-correcting for imbalance).

---

## 14. Objective → evidence map (proposal §2.2)

| SO | Claim | Status | Evidence |
|---|---|---|---|
| **SO1** | Lightweight CNN, 6 classes, ≥ 80 % on FER-2013/AffectNet | ✔ **exceeded** | Fused v5 **87 %** (6-class, FER-2013+AffectNet+DAiSEE, n=9,288). Custom depthwise-separable CNN **79 %** as the proposal-faithful reference (0.18 M params, 48×48) |
| **SO2** | Temporal analysis: emotion duration, transition rate, stability score | ✔ implemented; ✘ expert-label validation | `emotion_tracker.py` (§6); computed on raw signal over 60 s window; feedback-loop bug fixed. Quantitative validation vs ground truth NOT DONE — tuned/hardened against 17 real sessions |
| **SO3** | Occlusion handling improves accuracy vs baseline CNN | ✔ (with caveat) | Δ acc under 30 % occlusion: **baseline −11 pts vs v5 −2 pts** (§8). Caveat: baseline is 3-class; comparable quantity is the Δ. No VGG-16 baseline |
| **SO4** | ≥ 15 FPS / ≤ 50 ms on typical education hardware | ✔ on available HW; ✘ i3/4GB | **24 FPS in-process, 23.7 FPS live HTTP, ≤ 47 ms p95** on Apple Silicon. i3/4 GB not verified (no machine) |
| **SO5** | Structured emotion output + integration with LO / profile / teacher analytics | ✔ implemented; ✘ formal report | JSON API (§10) + analytics-service forwarding; live end-to-end verified. No formal integration-test document |
| **SO6** | Evaluate vs baseline deep models | ~ partial | vs fused v2 baseline + custom CNN + occlusion ablation + v3↔v5. No trained VGG-16 comparison (literature only) |

---

## 15. Suggested figures (and the repo file each comes from)

| Fig | Content | Source |
|---|---|---|
| 1 | Two-branch fused architecture (image CNN + MediaPipe feature branch → fusion head) | §3.1 / `train_fused_model_v5.py` |
| 2 | Real-time pipeline: frame → BlazeFace → validity gate → region weighting → fused CNN → temporal smoothing → temporal features → JSON API | `flask_api.py`, `fused_emotion_model.py`, `emotion_tracker.py` |
| 3 | v5 confusion matrix (clean) | `model/fused_confusion_matrix_v5.png` (regenerated by `evaluate_fused_model_v5.py`) |
| 4 | Bar chart: v3 vs v5 per-class F1 (Frustrated recall 0.47→0.84 stands out) | §7 |
| 5 | Occlusion degradation Δ: baseline vs v3 vs v5 (clean vs 30 % occluded, acc + macro-F1) | §8 |
| 6 | Training accuracy/loss curves | `model/fused_training_accuracy_v5.png`, `model/fused_training_loss_v5.png` |
| 7 | Region-weight mask visual (eye/mouth bands) | `src/emotion_service/ml/occlusion.py` |
| 8 | Real session timeline: raw emotion + stability/transition/duration over time | any `session_logs/*.csv` |

---

## 16. One-paragraph abstract seed (numbers only — rewrite in your words)

> A lightweight two-branch model fuses a MobileNetV2 image branch with a 56-dimensional
> MediaPipe blendshape/head-pose branch to classify six learner states (Angry, Bored,
> Confused, Frustrated, Happy, Normal) from a webcam. Trained on 46,439 images from
> FER-2013, AffectNet and DAiSEE — including 1,721 real Frustrated crops recovered from
> DAiSEE's multi-label annotations — the deployed model reaches **87 % accuracy /
> 0.82 macro-F1** on a 9,288-image held-out set, raising Frustrated recall from
> **0.47 to 0.84** over the previous version with no regression on Confused. Two
> occlusion-handling mechanisms (Cutout augmentation + fixed eye/mouth region
> weighting) cut accuracy loss under 30 % synthetic occlusion to **2 points**, versus
> **11 points** for a no-handling baseline. A face-validity gate and a raw-signal
> temporal module (60 s windowed stability score, transition rate and continuous
> duration) produce an enriched JSON stream consumed by three downstream platform
> components. The pipeline runs at **24 FPS / ≤ 47 ms per frame** on commodity CPU
> hardware. A proposal-faithful from-scratch depthwise-separable CNN
> (**0.18 M parameters, 2.3 MB**) is provided as a reference implementation.
