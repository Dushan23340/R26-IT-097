import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2 } from "lucide-react";
import { adaptiveApiService } from "@/lib/adaptiveApi";

const bloomColors = {
  Remembering:   { text: "text-chart-1",          bg: "bg-chart-1/15",          border: "border-chart-1/30"           },
  Understanding: { text: "text-chart-2",          bg: "bg-chart-2/15",          border: "border-chart-2/30"           },
  Applying:      { text: "text-chart-3",          bg: "bg-chart-3/15",          border: "border-chart-3/30"           },
  Analyzing:     { text: "text-emotion-confused", bg: "bg-emotion-confused/15", border: "border-emotion-confused/30"  },
  Evaluating:    { text: "text-accent",           bg: "bg-accent/15",           border: "border-accent/30"            },
  Creating:      { text: "text-emotion-angry",    bg: "bg-emotion-angry/15",    border: "border-emotion-angry/30"     },
};

export default function QuizPhase({ quiz, unit, quizSet, emotion, studentId, onComplete }) {
  const questions = quiz?.questions || [];

  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [selectedIndex,   setSelectedIndex]   = useState(null);
  const [isSubmitting,    setIsSubmitting]     = useState(false);

  const currentQuestion = questions[currentIndex];
  const isAnswered      = currentIndex in selectedAnswers;
  const progress        = ((currentIndex + 1) / questions.length) * 100;

  const handleSelectAnswer = (idx) => {
    setSelectedIndex(idx);
    // Functional updater avoids stale-closure issues when clicking quickly
    setSelectedAnswers(prev => ({ ...prev, [currentIndex]: idx }));
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedIndex(null);
    } else {
      await submitQuiz();
    }
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    try {
      const answers = questions.map((q, idx) => ({
        questionId:    q._id,
        selectedIndex: selectedAnswers[idx] ?? -1,
      }));

      // Primary — Flask backend scores the quiz
      const result = await adaptiveApiService.submitQuizAnswers({
        unit, quizSet, emotion, studentId, answers,
      });

      // Secondary backup — Node.js backend save.
      // Fire-and-forget: do NOT await, do NOT block the quiz flow.
      // The quiz results are already saved by Flask above.
      if (studentId !== "anonymous") {
        adaptiveApiService.saveAttempt({
          attemptId:       result.data.attemptId,
          unit,
          quizSet,
          emotion,
          bloomResults:    result.data.bloomResults,
          totalCorrect:    result.data.totalCorrect,
          totalQuestions:  result.data.totalQuestions,
          percentageScore: result.data.percentageScore,
        }).catch(() => {
          // 401 / network errors silently ignored here.
          // They appear in the browser console but do NOT affect the quiz.
        });
      }

      // Immediately proceed with results
      onComplete(
        result.data.bloomResults,
        result.data.totalCorrect,
        result.data.totalQuestions,
      );
    } catch (error) {
      alert("Error submitting quiz: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No questions available.
      </div>
    );
  }

  const colors = bloomColors[currentQuestion.bloomLevel] || bloomColors.Remembering;

  return (
    <div className="space-y-6">

      {/* ── Progress ──────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Q{currentQuestion.questionNumber} of {questions.length}
          </span>
          <Badge
            variant="outline"
            className={`${colors.text} ${colors.bg} border-2 ${colors.border}`}
          >
            {currentQuestion.bloomLevel}
          </Badge>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* ── Question card ─────────────────────────────────── */}
      <div className="glass border-border/60 rounded-2xl p-6 space-y-6">
        <p className="font-display text-lg font-bold">{currentQuestion.text}</p>

        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const letter     = String.fromCharCode(65 + idx); // A B C D
            const isSelected = selectedIndex === idx;

            return (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(idx)}
                className={`w-full glass border-2 rounded-xl p-4 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-[0_0_0_10px_rgba(56,189,248,0.12)]"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-bold text-muted-foreground min-w-6">
                    {letter}.
                  </span>
                  <span className="flex-1">{option}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Next / Submit button ───────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={!isAnswered || isSubmitting}
          size="lg"
          className="gap-2"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {currentIndex === questions.length - 1 ? "Submit" : "Next"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );
}