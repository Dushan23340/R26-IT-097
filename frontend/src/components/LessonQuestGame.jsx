import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Heart, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { useGameSession } from "@/hooks/useGameSession";

// Shared shell for the lesson-aligned question games (Binary Code Breaker,
// Percent Market Dash, Set Sorter Station). Each game supplies a
// `generate()` that returns a fresh, independently randomized list of
// multiple-choice questions per play - {level, prompt, choices, answer,
// explain} - tagged with the Bloom level it exercises (remember /
// understand / apply), the same three levels the lesson's quiz uses.
// The shell handles lives, scoring, the per-question feedback and the
// win/loss report to the teacher's live panel (useGameSession).
const MAX_LIVES = 3;

const LEVEL_STYLE = {
  remember: "bg-sky-400/15 text-sky-200 border-sky-300/30",
  understand: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
  apply: "bg-amber-400/15 text-amber-200 border-amber-300/30",
};

function LessonQuestGame({ gameKey, badge, title, intro, startTitle, startText, winTitle, loseTitle, Icon, background, rules, generate }) {
  const { reportFinish } = useGameSession(gameKey);

  const [screen, setScreen] = useState("start"); // start | playing | won | lost
  const [questions, setQuestions] = useState(() => generate());
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // the choice clicked for the current question
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);

  const question = questions[index];
  const answered = picked !== null;
  const wasCorrect = answered && picked === question.answer;

  function startGame() {
    setQuestions(generate());
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setLives(MAX_LIVES);
    setScreen("playing");
  }

  function finish(outcome, finalCorrect) {
    setScreen(outcome === "win" ? "won" : "lost");
    reportFinish(outcome, Math.round((finalCorrect / questions.length) * 100), {
      correctCount: finalCorrect,
      totalCount: questions.length,
    });
  }

  function choose(choice) {
    if (answered) return;
    setPicked(choice);
    if (choice === question.answer) {
      setCorrectCount((c) => c + 1);
    } else {
      setLives((l) => l - 1);
    }
  }

  function next() {
    // correctCount / lives already include this question's result.
    if (lives <= 0) {
      finish("loss", correctCount);
    } else if (index + 1 >= questions.length) {
      finish("win", correctCount);
    } else {
      setIndex(index + 1);
      setPicked(null);
    }
  }

  const won = screen === "won";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent badge-primary">
            <Icon className="h-4 w-4" />
            {badge}
          </div>
          <h1 className="mt-4 text-display-md tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 max-w-2xl text-body-md text-text-secondary">{intro}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">QUESTION</div>
            <div className="mt-2 text-display-sm font-bold text-accent">{Math.min(index + 1, questions.length)}/{questions.length}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">CORRECT</div>
            <div className="mt-2 text-display-sm font-bold text-foreground">{correctCount}</div>
          </div>
          <div className="card rounded-2xl">
            <div className="text-label-md text-text-muted">LIVES</div>
            <div className="mt-2 flex items-center gap-1" aria-label={`${lives} lives left`}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <Heart key={i} className={`h-6 w-6 ${i < lives ? "text-error fill-current" : "text-text-muted"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="container-game rounded-3xl relative">
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 min-h-[480px]" style={{ background }}>
          {screen === "start" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 rounded-3xl">
              <div className="max-w-sm text-center px-6">
                <Icon className="mx-auto h-12 w-12 text-white" />
                <h2 className="mt-4 text-heading-lg text-white">{startTitle}</h2>
                <p className="mt-2 text-sm text-slate-100">{startText}</p>
                <button type="button" onClick={startGame} className="mt-6 btn btn-primary btn-lg">
                  <ArrowRight className="h-4 w-4" />
                  Start
                </button>
              </div>
            </div>
          )}

          {screen === "playing" && (
            <div className="relative z-10 mx-auto max-w-2xl space-y-6">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {questions.map((q, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-white" : i === index ? "bg-amber-300" : "bg-white/25"}`} />
                ))}
              </div>

              <div className="rounded-2xl bg-slate-950/55 p-6 backdrop-blur-sm border border-white/15">
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${LEVEL_STYLE[question.level]}`}>
                  {question.level}
                </span>
                <p className="mt-4 text-xl font-semibold leading-relaxed text-white">{question.prompt}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {question.choices.map((choice) => {
                  const isAnswer = choice === question.answer;
                  const isPicked = choice === picked;
                  let style = "bg-white/90 text-slate-900 hover:bg-white";
                  if (answered && isAnswer) style = "bg-emerald-500 text-white";
                  else if (answered && isPicked) style = "bg-rose-500 text-white";
                  else if (answered) style = "bg-white/40 text-slate-800";
                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={answered}
                      onClick={() => choose(choice)}
                      className={`rounded-xl px-4 py-4 text-lg font-bold shadow-lg transition-colors ${style}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className="rounded-2xl bg-slate-950/65 p-5 border border-white/15 backdrop-blur-sm" role="status">
                  <div className={`flex items-center gap-2 font-bold ${wasCorrect ? "text-emerald-300" : "text-rose-300"}`}>
                    {wasCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {wasCorrect ? "Correct" : `Not quite - the answer is ${question.answer}`}
                  </div>
                  <p className="mt-2 text-sm text-slate-100">{question.explain}</p>
                  <button type="button" onClick={next} className="mt-4 btn btn-primary">
                    {lives <= 0 || index + 1 >= questions.length ? "See result" : "Next question"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {(screen === "won" || screen === "lost") && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="max-w-sm text-center px-6 rounded-2xl bg-white/90 backdrop-blur-sm py-8">
                {won ? <Sparkles className="mx-auto h-14 w-14 text-emerald-500" /> : <XCircle className="mx-auto h-14 w-14 text-slate-400" />}
                <h2 className={`mt-4 text-heading-lg font-bold ${won ? "text-emerald-900" : "text-slate-700"}`}>{won ? winTitle : loseTitle}</h2>
                <p className="mt-2 text-slate-600">
                  {correctCount}/{questions.length} correct{won ? "." : " - review the lesson notes and try again."}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" onClick={startGame} className="btn btn-primary btn-lg">
                    <RotateCcw className="h-4 w-4" />
                    {won ? "Play Again" : "Try Again"}
                  </button>
                  <Link to="/" className="btn btn-secondary btn-lg">
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="card rounded-2xl">
        <p className="text-label-md text-text-muted">HOW TO WIN</p>
        <h2 className="mt-1 text-heading-lg text-foreground">Game Rules</h2>
        <ul className="mt-4 space-y-2 text-body-sm leading-6 text-text-secondary">
          {rules.map((rule, i) => (
            <li key={rule} className="flex gap-3">
              <span className="text-accent font-bold">{i + 1}.</span> {rule}
            </li>
          ))}
          <li className="flex gap-3">
            <span className="text-error font-bold">{rules.length + 1}.</span> {MAX_LIVES} wrong answers end the game
          </li>
        </ul>
      </div>
    </div>
  );
}

export { LessonQuestGame };
