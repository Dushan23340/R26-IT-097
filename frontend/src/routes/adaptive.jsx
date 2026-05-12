import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Brain,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Divide, Percent } from "lucide-react";
import Setup from "@/components/adaptive/phases/Setup";
import QuizPhase from "@/components/adaptive/phases/QuizPhase";
import Results from "@/components/adaptive/phases/Results";
import Recommendations from "@/components/adaptive/phases/Recommendations";
import FinalReport from "@/components/adaptive/phases/FinalReport";

const Route = createFileRoute("/adaptive")({
  head: () => ({
    meta: [
      { title: "Adaptive Learning — AdaptiveMind" },
      { name: "description", content: "Multi-phase adaptive learning with emotion-aware personalization" },
    ],
  }),
  component: AdaptiveLearningPage,
});

function StepIndicator({ currentPhase }) {
  const steps = [
    { phase: "setup", label: "Setup", number: 1 },
    { phase: "quiz1", label: "Assessment", number: 2 },
    { phase: "results1", label: "Results", number: 3 },
    { phase: "recommendations", label: "Path", number: 4 },
    { phase: "quiz2", label: "Evaluation", number: 5 },
    { phase: "final", label: "Report", number: 6 },
  ];

  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {steps.map((step, idx) => (
        <div key={step.phase} className="flex items-center flex-1">
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                steps.findIndex(s => s.phase === currentPhase) > idx
                  ? "bg-primary border-primary text-background"
                  : step.phase === currentPhase
                  ? "bg-background border-primary text-primary ring-2 ring-primary/30"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {step.number}
            </div>
            <span className="text-xs mt-1 font-medium text-center w-14">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-all ${
                steps.findIndex(s => s.phase === currentPhase) > idx
                  ? "bg-primary"
                  : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function AdaptiveLearningPage() {
  // Phase management
  const [phase, setPhase] = useState("setup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Setup state
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState(null);

  // Quiz state
  const [quiz1Data, setQuiz1Data] = useState(null);
  const [quiz2Data, setQuiz2Data] = useState(null);
  const [currentQuizSet, setCurrentQuizSet] = useState("Q1");

  // Results state
  const [q1Results, setQ1Results] = useState(null);
  const [q2Results, setQ2Results] = useState(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState(null);
  const [attempts, setAttempts] = useState([]);

  // User context
  const { user } = useAuth();
  const studentId = user?.id || "anonymous";

  // Auto-detect emotion on mount
  useEffect(() => {
    const detectEmotion = async () => {
      try {
        const result = await adaptiveApiService.getCurrentEmotion();
        if (result.emotion) {
          const emotionMap = {
            happy: "Happy",
            neutral: "Normal",
            confused: "Confused",
            bored: "Bored",
            frustrated: "Frustrated",
            angry: "Angry",
          };
          const mapped = emotionMap[result.emotion.toLowerCase()] || "Normal";
          setSelectedEmotion(mapped);
        }
      } catch (e) {
        // Silently fall back to Normal if emotion detection fails
        setSelectedEmotion("Normal");
      }
    };
    detectEmotion();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAttempts([]);
      return;
    }

    const fetchAttempts = async () => {
      try {
        const data = await adaptiveApiService.getAttempts();
        setAttempts(data.data || []);
      } catch (err) {
        console.warn("Failed to fetch attempt history:", err);
      }
    };

    fetchAttempts();
  }, [user]);

  // Phase transitions
  const handleStartQuiz1 = async () => {
    if (!selectedUnit || !selectedEmotion) return;

    setLoading(true);
    setError("");
    try {
      const data = await adaptiveApiService.getQuizQuestions(selectedUnit, "Q1");
      setQuiz1Data(data.data);
      setCurrentQuizSet("Q1");
      setPhase("quiz1");
    } catch (err) {
      setError(err.message || "Failed to fetch quiz. Is the Python backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleQuiz1Complete = async (bloomResults, totalCorrect, totalQuestions) => {
    const percentageScore = (totalCorrect / totalQuestions) * 100;
    const failedLevels = Object.entries(bloomResults)
      .filter(([_, result]) => result.total > 0 && !result.passed)
      .map(([level, _]) => level);
    const passedLevels = Object.entries(bloomResults)
      .filter(([_, result]) => result.total > 0 && result.passed)
      .map(([level, _]) => level);

    setQ1Results({
      bloomResults,
      totalCorrect,
      totalQuestions,
      percentageScore,
      failedLevels,
      passedLevels,
    });

    // Fetch recommendations if there are failed levels
    if (failedLevels.length > 0) {
      setLoading(true);
      try {
        const recData = await adaptiveApiService.getRecommendationResources({
          unit: selectedUnit,
          failedLevels,
          emotion: selectedEmotion,
        });
        setRecommendations(recData.data);
      } catch (err) {
        console.warn("Failed to fetch recommendations:", err);
      } finally {
        setLoading(false);
      }
    }

    setPhase("results1");
  };

  const handleProceedToQuiz2 = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adaptiveApiService.getQuizQuestions(selectedUnit, "Q2");
      setQuiz2Data(data.data);
      setCurrentQuizSet("Q2");
      setPhase("quiz2");
    } catch (err) {
      setError(err.message || "Failed to fetch Q2 quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleViewRecommendations = () => {
    setPhase("recommendations");
  };

  const handleContinuePath = async () => {
    if (recommendations) {
      setPhase("recommendations");
      return;
    }

    if (q1Results?.failedLevels?.length > 0) {
      setLoading(true);
      try {
        const recData = await adaptiveApiService.getRecommendationResources({
          unit: selectedUnit,
          failedLevels: q1Results.failedLevels,
          emotion: selectedEmotion,
        });
        setRecommendations(recData.data);
        setPhase("recommendations");
      } catch (err) {
        console.warn("Failed to fetch recommendations:", err);
        setPhase("recommendations");
      } finally {
        setLoading(false);
      }
      return;
    }

    setPhase("recommendations");
  };

  const handleQuiz2Complete = async (bloomResults, totalCorrect, totalQuestions) => {
    const percentageScore = (totalCorrect / totalQuestions) * 100;
    const failedLevels = Object.entries(bloomResults)
      .filter(([_, result]) => result.total > 0 && !result.passed)
      .map(([level, _]) => level);
    const passedLevels = Object.entries(bloomResults)
      .filter(([_, result]) => result.total > 0 && result.passed)
      .map(([level, _]) => level);

    setQ2Results({
      bloomResults,
      totalCorrect,
      totalQuestions,
      percentageScore,
      failedLevels,
      passedLevels,
    });

    setPhase("final");
  };

  const handleReset = () => {
    setPhase("setup");
    setSelectedUnit(null);
    setSelectedEmotion("Normal");
    setQuiz1Data(null);
    setQuiz2Data(null);
    setQ1Results(null);
    setQ2Results(null);
    setRecommendations(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold">Adaptive Learning</h1>
          </div>
          {phase !== "setup" && (
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>

        {/* Step Indicator */}
        <StepIndicator currentPhase={phase} />

        {/* Error Banner */}
        {error && (
          <div className="rounded-xl p-4 border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* Phases */}
        {!loading && (
          <div className="space-y-6">
            {phase === "setup" && (
              <Setup
                selectedUnit={selectedUnit}
                setSelectedUnit={setSelectedUnit}
                selectedEmotion={selectedEmotion}
                setSelectedEmotion={setSelectedEmotion}
                onStart={handleStartQuiz1}
                attempts={attempts}
              />
            )}

            {phase === "quiz1" && quiz1Data && (
              <QuizPhase
                quiz={quiz1Data}
                unit={selectedUnit}
                quizSet="Q1"
                emotion={selectedEmotion}
                studentId={studentId}
                onComplete={handleQuiz1Complete}
              />
            )}

            {phase === "results1" && q1Results && (
              <Results
                results={q1Results}
                unit={selectedUnit}
                emotion={selectedEmotion}
                failedLevels={q1Results.failedLevels}
                onProceed={handleProceedToQuiz2}
                onViewRecommendations={handleViewRecommendations}
                loading={loading}
              />
            )}

            {phase === "recommendations" && recommendations && (
              <Recommendations
                recommendations={recommendations}
                unit={selectedUnit}
                emotion={selectedEmotion}
                onProceed={handleProceedToQuiz2}
              />
            )}

            {phase === "quiz2" && quiz2Data && (
              <QuizPhase
                quiz={quiz2Data}
                unit={selectedUnit}
                quizSet="Q2"
                emotion={selectedEmotion}
                studentId={studentId}
                onComplete={handleQuiz2Complete}
              />
            )}

            {phase === "final" && q1Results && q2Results && (
              <FinalReport
                q1Results={q1Results}
                q2Results={q2Results}
                unit={selectedUnit}
                onContinuePath={handleContinuePath}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { Route };
