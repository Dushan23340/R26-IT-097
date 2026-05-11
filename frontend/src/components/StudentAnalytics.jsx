import { useState, useEffect } from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import {
  Loader2,
  ArrowLeft,
  BarChart3,
  Brain,
  Heart,
  Zap,
  TrendingUp,
} from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { TrendChart } from "@/components/TrendChart";
import { StabilityCard } from "@/components/StabilityCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function EmotionTable({ emotionsData }) {
  if (!emotionsData || !emotionsData.correlations) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        No emotion correlation data available.
      </div>
    );
  }

  const correlations = emotionsData.correlations;
  const emotions = Object.entries(correlations).sort((a, b) =>
    Math.abs(b[1].r || 0) > Math.abs(a[1].r || 0) ? 1 : -1
  );

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Emotion–LO Correlation</h3>
          <p className="text-xs text-muted-foreground">
            Pearson r across {emotionsData.num_sessions} sessions
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">
                Emotion
              </th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">
                r
              </th>
              <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">
                p-value
              </th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">
                Direction
              </th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">
                Strength
              </th>
            </tr>
          </thead>
          <tbody>
            {emotions.map(([emotion, data]) => {
              const isSignificant = data.significant === true;
              const directionColor =
                data.direction === "positive"
                  ? "#22c55e"
                  : data.direction === "negative"
                    ? "#ef4444"
                    : "#6b7280";
              return (
                <tr
                  key={emotion}
                  className={`border-b border-border/30 last:border-b-0 ${
                    isSignificant ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="py-2 px-2 capitalize font-medium flex items-center gap-2">
                    {isSignificant && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                    {emotion}
                  </td>
                  <td
                    className="py-2 px-2 text-right font-mono font-semibold"
                    style={{ color: directionColor }}
                  >
                    {data.r !== null ? data.r.toFixed(3) : "N/A"}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-xs">
                    {data.p_value !== null ? data.p_value.toFixed(4) : "N/A"}
                  </td>
                  <td
                    className="py-2 px-2 capitalize text-xs"
                    style={{ color: directionColor }}
                  >
                    {data.direction}
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground capitalize">
                    {data.strength}
                    {isSignificant && (
                      <span className="ml-1 text-primary font-semibold">*</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {emotionsData.significant_correlations &&
        Object.keys(emotionsData.significant_correlations).length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-primary mb-1">
              Significant correlations found:
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {emotionsData.summary?.split("\n")?.find((line) =>
                line.includes("Significant")
              ) || "See table above for details."}
            </p>
          </div>
        )}
    </div>
  );
}

function EngagementChart({ engagementData }) {
  if (!engagementData || !engagementData.descriptive_statistics) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        No engagement comparison data available.
      </div>
    );
  }

  const { descriptive_statistics, mann_whitney, effect_size, interpretation } =
    engagementData;
  const high = descriptive_statistics.high_engagement;
  const low = descriptive_statistics.low_engagement;

  const chartData = [
    { group: "High Engagement", mean: high?.mean ?? 0, color: "#22c55e" },
    { group: "Low Engagement", mean: low?.mean ?? 0, color: "#6b7280" },
  ];

  const isSignificant = mann_whitney && mann_whitney.p_value < 0.05;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Engagement vs Performance</h3>
          <p className="text-xs text-muted-foreground">
            Mann-Whitney U comparison
          </p>
        </div>
      </div>

      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="group" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="mean" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-secondary/50">
          <p className="text-xs text-muted-foreground mb-1">High Group (n={high?.count ?? 0})</p>
          <p className="text-lg font-bold font-mono">{high?.mean?.toFixed(1) ?? "N/A"}</p>
          <p className="text-xs text-muted-foreground">mean LO score</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50">
          <p className="text-xs text-muted-foreground mb-1">Low Group (n={low?.count ?? 0})</p>
          <p className="text-lg font-bold font-mono">{low?.mean?.toFixed(1) ?? "N/A"}</p>
          <p className="text-xs text-muted-foreground">mean LO score</p>
        </div>
      </div>

      {mann_whitney && (
        <div className="flex items-center gap-4 text-xs mb-3">
          <div>
            <span className="text-muted-foreground">U = </span>
            <span className="font-mono font-semibold">
              {mann_whitney.U_statistic?.toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">p = </span>
            <span
              className="font-mono font-semibold"
              style={{ color: isSignificant ? "#22c55e" : "#6b7280" }}
            >
              {mann_whitney.p_value?.toFixed(4)}
            </span>
          </div>
          {effect_size !== null && effect_size !== undefined && (
            <div>
              <span className="text-muted-foreground">r = </span>
              <span className="font-mono font-semibold">
                {effect_size > 0 ? "+" : ""}
                {effect_size.toFixed(3)}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        {interpretation}
      </p>
    </div>
  );
}

function StudentAnalytics() {
  const { studentId } = useParams({ strict: false });
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await analyticsApi.getStudentComplete(studentId);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load analytics data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading analytics for {studentId}...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <BarChart3 className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-center">Unable to Load Analytics</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {error}
        </p>
        <button
          onClick={() => router.history.back()}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            className="p-2 rounded-lg glass hover:scale-105 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold">
              Student Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {studentId} — Comprehensive learning analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-emotion-happy" />
          <span className="text-sm text-muted-foreground">
            {data?.emotions?.num_sessions ?? 0} sessions
          </span>
        </div>
      </div>

      {/* Trend + Stability row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart trendData={data?.trend} />
        <StabilityCard stabilityData={data?.stability} />
      </div>

      {/* Emotion Correlation */}
      <EmotionTable emotionsData={data?.emotions} />

      {/* Engagement Comparison */}
      <EngagementChart engagementData={data?.engagement} />

      {/* Summary Footer */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Analysis Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Trend</p>
            <p className="font-semibold capitalize">
              {data?.trend?.trend_classification ?? "N/A"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Stability</p>
            <p className="font-semibold">
              {data?.stability?.at_risk ? "At Risk" : "Stable"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Emotion Correlations</p>
            <p className="font-semibold">
              {data?.emotions?.significant_correlations
                ? Object.keys(data.emotions.significant_correlations).length
                : 0}{" "}
              significant
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Engagement Effect</p>
            <p className="font-semibold">
              {data?.engagement?.mann_whitney?.p_value < 0.05
                ? "Significant"
                : "Not significant"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { StudentAnalytics };
