import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

const QUESTIONS = [
  {
    id: 1,
    title: "Lap 1 of 4",
    prompt: "A runner in Lane 2 is 1.22 m farther from the center than the inside line. What is the stagger distance for one full turn?",
    formula: "C = 2πr",
    answer: 7.66,
    tip: "Use r = 1.22 and round to 2 decimal places.",
  },
  {
    id: 2,
    title: "Lap 2 of 4",
    prompt: "The outer lane is measured with a diameter of 4.8 m. What is the circumference for that lane?",
    formula: "C = πd",
    answer: 15.08,
    tip: "Use d = 4.8 and round to 2 decimal places.",
  },
  {
    id: 3,
    title: "Lap 3 of 4",
    prompt: "A coach says the outer lane sits 3.66 m farther from the center than the inside lane. Find the stagger distance.",
    formula: "C = 2πr",
    answer: 22.99,
    tip: "Use r = 3.66 and round to 2 decimal places.",
  },
  {
    id: 4,
    title: "Lap 4 of 4",
    prompt: "The final outside lane has a diameter of 6.2 m. How far would a runner travel around that lane once?",
    formula: "C = πd",
    answer: 19.48,
    tip: "Use d = 6.2 and round to 2 decimal places.",
  },
];

function parseAnswer(value) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAnswerCorrect(input, expected) {
  const parsed = parseAnswer(input);
  if (parsed === null) return false;

  return Math.abs(parsed - expected) <= 0.05;
}

const Route = createFileRoute("/track-field-analytics")({
  head: () => ({
    meta: [
      { title: "Track & Field Analytics — AdaptiveMind" },
      {
        name: "description",
        content: "A grade 9 math game where students calculate track lane stagger distances with circumference formulas.",
      },
    ],
  }),
  component: TrackFieldAnalyticsPage,
});

function TrackFieldAnalyticsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("playing");
  const [feedback, setFeedback] = useState("Use the formula to calculate the lane stagger and keep the runner moving.");
  const [feedbackTone, setFeedbackTone] = useState("info");
  const [runnerPosition, setRunnerPosition] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentQuestion = QUESTIONS[currentIndex];
  const progressPercent = ((currentIndex + (status === "playing" ? 1 : 0)) / QUESTIONS.length) * 100;
  const lapLabel = status === "won" ? `Lap ${QUESTIONS.length} of ${QUESTIONS.length}` : `Lap ${currentIndex + 1} of ${QUESTIONS.length}`;

  const trackMarkers = useMemo(
    () => Array.from({ length: QUESTIONS.length }, (_, index) => ({ id: index, label: `L${index + 1}` })),
    []
  );

  const resetGame = () => {
    setCurrentIndex(0);
    setAnswer("");
    setStatus("playing");
    setFeedback("Use the formula to calculate the lane stagger and keep the runner moving.");
    setFeedbackTone("info");
    setRunnerPosition(0);
    setIsTransitioning(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (status !== "playing") return;

    const parsed = parseAnswer(answer);
    if (parsed === null) {
      setFeedback("Type a number first, then check your answer.");
      setFeedbackTone("warning");
      return;
    }

    if (isAnswerCorrect(answer, currentQuestion.answer)) {
      setFeedback(`Excellent work! ${currentQuestion.tip}`);
      setFeedbackTone("success");
      setRunnerPosition(currentIndex + 1);
      setIsTransitioning(true);

      window.setTimeout(() => {
        if (currentIndex === QUESTIONS.length - 1) {
          setStatus("won");
          setFeedback("You completed every lap. You’re ready to race into more circle problems!");
          setFeedbackTone("success");
          setIsTransitioning(false);
        } else {
          setCurrentIndex((value) => value + 1);
          setAnswer("");
          setFeedback("Nice sprint! Get ready for the next lane challenge.");
          setFeedbackTone("info");
          setIsTransitioning(false);
        }
      }, 1200);
    } else {
      setStatus("lost");
      setFeedback(`Game Over — Try again. Review the formula carefully: ${currentQuestion.formula}. If you used the wrong measurement, double-check whether you need radius or diameter.`);
      setFeedbackTone("error");
      setIsTransitioning(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="track-game-shell">
        <div className="track-card">
          <div className="hero-bar">
            <div>
              <p className="eyebrow">Olympic Math Challenge</p>
              <h1>Track &amp; Field Analytics</h1>
              <p className="hero-copy">
                Use the circumference formula to discover how much farther outer lanes must run.
              </p>
            </div>
            <Link to="/" className="back-link">
              ← Back to learning
            </Link>
          </div>

          <div className="progress-panel">
            <div className="progress-row">
              <span>{lapLabel}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="progress-track" aria-label="Game progress">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="marker-row">
              {trackMarkers.map((marker, index) => (
                <div key={marker.id} className={`marker ${index < currentIndex ? "complete" : ""}`}>
                  {marker.label}
                </div>
              ))}
            </div>
          </div>

          <div className="game-grid">
            <section className="question-panel">
              <div className="question-header">
                <span className="pill">Grade 9 • Circumference</span>
                <span className="pill accent">{currentQuestion.formula}</span>
              </div>
              <h2>{currentQuestion.prompt}</h2>
              <p className="helper-text">Round your answer to 2 decimal places.</p>

              <form onSubmit={handleSubmit} className="answer-form">
                <label htmlFor="track-answer" className="sr-only">
                  Your answer
                </label>
                <input
                  id="track-answer"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={status !== "playing" || isTransitioning}
                  placeholder="Enter your answer"
                />
                <button type="submit" disabled={status !== "playing" || isTransitioning}>
                  {status === "playing" ? "Check answer" : "Play again"}
                </button>
              </form>

              <div className={`feedback ${feedbackTone}`} role="status">
                {feedback}
              </div>

              {(status === "lost" || status === "won") && (
                <button type="button" className="restart-btn" onClick={resetGame}>
                  {status === "lost" ? "Restart game" : "Play again"}
                </button>
              )}
            </section>

            <aside className="stadium-panel">
              <div className="track">
                <div className="track-line" />
                <div className="infield" />
                <div className={`runner ${isTransitioning ? "runner-boost" : ""}`} style={{ left: `${12 + runnerPosition * 19}%` }}>
                  🏃
                </div>
              </div>
              <div className="stadium-caption">
                <h3>Coach’s tip</h3>
                <p>{currentQuestion.tip}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = `
  :root {
    color-scheme: dark;
  }

  * { box-sizing: border-box; }

  body { margin: 0; font-family: Inter, "Segoe UI", Roboto, sans-serif; }

  .track-game-shell {
    min-height: 100vh;
    padding: 24px;
    background:
      radial-gradient(circle at top, rgba(54, 154, 255, 0.28), transparent 35%),
      linear-gradient(135deg, #061526 0%, #0f3d6d 45%, #1bc6a1 100%);
    color: #f8fbff;
  }

  .track-card {
    max-width: 1180px;
    margin: 0 auto;
    border-radius: 28px;
    background: rgba(8, 23, 37, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 25px 60px rgba(6, 18, 31, 0.35);
    overflow: hidden;
  }

  .hero-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 28px 16px;
    background: linear-gradient(90deg, rgba(255, 97, 56, 0.94), rgba(255, 153, 51, 0.9));
  }

  .eyebrow {
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    font-size: 0.78rem;
    font-weight: 800;
    color: #fff4e8;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.6rem, 3vw, 2.3rem);
    font-weight: 800;
  }

  .hero-copy {
    margin: 8px 0 0;
    max-width: 620px;
    line-height: 1.5;
    color: #fff6e8;
  }

  .back-link {
    color: #061526;
    font-weight: 700;
    text-decoration: none;
    background: white;
    padding: 10px 14px;
    border-radius: 999px;
  }

  .progress-panel {
    padding: 20px 28px 6px;
  }

  .progress-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: #dceeff;
  }

  .progress-track {
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #28c8ff 0%, #ff6b3d 100%);
    transition: width 0.35s ease;
  }

  .marker-row {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    gap: 8px;
  }

  .marker {
    flex: 1;
    text-align: center;
    font-size: 0.8rem;
    padding: 7px 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #dceeff;
    font-weight: 700;
  }

  .marker.complete {
    background: linear-gradient(135deg, #1bc6a1, #0ea5e9);
    color: white;
  }

  .game-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 24px;
    padding: 20px 28px 28px;
  }

  .question-panel,
  .stadium-panel {
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 20px;
  }

  .question-header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 0.8rem;
    font-weight: 700;
    color: #e6f7ff;
  }

  .pill.accent {
    background: rgba(40, 200, 255, 0.18);
    color: #b9f4ff;
  }

  .question-panel h2 {
    font-size: 1.15rem;
    margin: 0 0 8px;
    line-height: 1.45;
    color: white;
  }

  .helper-text {
    margin: 0 0 16px;
    color: #bfe3ff;
  }

  .answer-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .answer-form input {
    flex: 1;
    min-width: 220px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.95);
    color: #07101a;
    font-size: 1rem;
  }

  .answer-form button,
  .restart-btn {
    border: none;
    border-radius: 999px;
    padding: 12px 16px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .answer-form button {
    background: linear-gradient(135deg, #ff6b3d, #ff953d);
    color: white;
    box-shadow: 0 10px 20px rgba(255, 107, 61, 0.25);
  }

  .answer-form button:hover,
  .restart-btn:hover {
    transform: translateY(-1px);
  }

  .answer-form button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .feedback {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 14px;
    line-height: 1.5;
    font-weight: 600;
  }

  .feedback.info {
    background: rgba(40, 200, 255, 0.16);
    color: #dff8ff;
  }

  .feedback.success {
    background: rgba(27, 198, 161, 0.18);
    color: #d9fff4;
  }

  .feedback.warning {
    background: rgba(255, 191, 62, 0.2);
    color: #fff2ca;
  }

  .feedback.error {
    background: rgba(255, 92, 92, 0.2);
    color: #ffdede;
  }

  .restart-btn {
    margin-top: 14px;
    background: white;
    color: #061526;
  }

  .stadium-panel {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
  }

  .track {
    position: relative;
    min-height: 280px;
    border-radius: 24px;
    background: linear-gradient(180deg, #2d4b32 0%, #4f7e41 100%);
    overflow: hidden;
    border: 6px solid #5b3a1d;
  }

  .track::before {
    content: "";
    position: absolute;
    inset: 20px;
    border-radius: 18px;
    border: 10px dashed #f5d73f;
  }

  .track-line {
    position: absolute;
    inset: 18px;
    border-radius: 18px;
    border: 6px solid #f4f7fa;
    opacity: 0.8;
  }

  .infield {
    position: absolute;
    inset: 40px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 70%);
  }

  .runner {
    position: absolute;
    bottom: 22px;
    font-size: 2.4rem;
    transform: translateX(0);
    transition: left 0.35s ease;
  }

  .runner.runner-boost {
    animation: sprint 0.8s ease-in-out;
  }

  .stadium-caption {
    padding: 12px 4px 0;
  }

  .stadium-caption h3 {
    margin: 0 0 6px;
    color: #fff6e8;
  }

  .stadium-caption p {
    margin: 0;
    color: #cde9ff;
    line-height: 1.5;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  @keyframes sprint {
    0% { transform: translateX(0) scale(1); }
    50% { transform: translateX(8px) scale(1.08); }
    100% { transform: translateX(0) scale(1); }
  }

  @media (max-width: 860px) {
    .game-grid {
      grid-template-columns: 1fr;
    }

    .hero-bar {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (max-width: 560px) {
    .track-game-shell {
      padding: 12px;
    }

    .progress-panel,
    .game-grid,
    .hero-bar {
      padding-left: 16px;
      padding-right: 16px;
    }

    .answer-form {
      flex-direction: column;
    }

    .answer-form input,
    .answer-form button,
    .restart-btn {
      width: 100%;
    }
  }
`;

export { Route };
