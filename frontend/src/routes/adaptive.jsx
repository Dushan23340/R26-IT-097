import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Brain,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  Map,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { adaptiveApiService } from "@/lib/adaptiveApi";
import { QuizResults } from "@/components/adaptive/QuizResults";
import { AdaptivePath } from "@/components/adaptive/AdaptivePath";
import { Recommendations } from "@/components/adaptive/Recommendations";
import { AdaptiveReport } from "@/components/adaptive/AdaptiveReport";

const Route = createFileRoute("/adaptive")({
  head: () => ({
    meta: [
      { title: "Adaptive Learning \u2014 AdaptiveMind" },
      { name: "description", content: "Personalized learning path, recommendations, and adaptive report based on Bloom's Taxonomy." },
    ],
  }),
  component: AdaptiveLearningPage,
});

function AdaptiveLearningPage() {
  const [activeTab, setActiveTab] = useState("results");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [quizData, setQuizData] = useState(null);
  const [pathData, setPathData] = useState(null);
  const [recData, setRecData] = useState(null);
  const [reportData, setReportData] = useState(null);

  const simulateQuiz = async () => {
    setLoading(true);
    setError("");
    try {
      const quizRes = await adaptiveApiService.simulateQuiz("student_web");
      const results = quizRes.data.results;

      const [pathRes, recRes, reportRes] = await Promise.all([
        adaptiveApiService.getAdaptivePath(results, "student_web"),
        adaptiveApiService.getRecommendations(results, "student_web"),
        adaptiveApiService.getFullReport(results, "student_web"),
      ]);

      setQuizData(quizRes.data);
      setPathData(pathRes.data);
      setRecData(recRes.data);
      setReportData(reportRes.data);
    } catch (err) {
      setError(err.message || "Failed to fetch adaptive data. Is the Python backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  };

  // Auto-simulate on first load
  useEffect(() => {
    simulateQuiz();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <Brain className="h-7 w-7 text-primary" />
            Adaptive Learning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalized outcomes, paths, and recommendations powered by Bloom's Taxonomy.
          </p>
        </div>
        <Button
          onClick={simulateQuiz}
          disabled={loading}
          className="gap-2"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? "Analyzing..." : "Simulate New Quiz"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !quizData && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-sm">Generating adaptive learning analysis...</p>
        </div>
      )}

      {/* Content Tabs */}
      {quizData && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="glass border-border/60 flex-wrap h-auto gap-1 p-1.5">
            <TabsTrigger value="results" className="text-xs gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Quiz Results
            </TabsTrigger>
            <TabsTrigger value="path" className="text-xs gap-1.5">
              <Map className="h-3.5 w-3.5" />
              Learning Path
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Full Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-4">
            <QuizResults data={quizData} />
          </TabsContent>

          <TabsContent value="path" className="mt-4">
            <AdaptivePath data={pathData} />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <Recommendations data={recData} />
          </TabsContent>

          <TabsContent value="report" className="mt-4">
            <AdaptiveReport data={reportData} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export { Route };
