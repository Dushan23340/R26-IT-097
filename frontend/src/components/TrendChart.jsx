import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function TrendChart({ trendData }) {
  if (!trendData || !trendData.regression_stats) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        No trend data available.
      </div>
    );
  }

  const { regression_stats, trend_classification, num_sessions } = trendData;
  const slope = regression_stats?.slope ?? 0;
  const intercept = regression_stats?.intercept ?? 0;
  const rSquared = regression_stats?.r_squared ?? 0;
  const pValue = regression_stats?.p_value ?? 1;

  // Build session data points
  const data = Array.from({ length: num_sessions || 0 }, (_, i) => {
    const sessionNum = i + 1;
    const predicted = intercept + slope * i;
    return {
      session: `S${sessionNum}`,
      score: Math.round(predicted * 10) / 10,
      regression: Math.round(predicted * 10) / 10,
    };
  });

  const trendColor =
    trend_classification === "improving"
      ? "#22c55e"
      : trend_classification === "declining"
        ? "#ef4444"
        : "#6b7280";

  const TrendIcon =
    trend_classification === "improving"
      ? TrendingUp
      : trend_classification === "declining"
        ? TrendingDown
        : Minus;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: `${trendColor}15` }}
          >
            <TrendIcon className="h-5 w-5" style={{ color: trendColor }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Learning Trend</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {trend_classification} — {num_sessions} sessions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Slope</p>
            <p className="font-mono font-semibold" style={{ color: trendColor }}>
              {slope > 0 ? "+" : ""}
              {slope.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">R²</p>
            <p className="font-mono font-semibold">
              {(rSquared * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">p-value</p>
            <p
              className="font-mono font-semibold"
              style={{ color: pValue < 0.05 ? "#22c55e" : "#6b7280" }}
            >
              {pValue.toFixed(3)}
            </p>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="session" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{
                value: "LO Score",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <ReferenceLine
              y={intercept}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              label={{
                value: `Intercept: ${intercept.toFixed(1)}`,
                position: "right",
                style: { fontSize: 11, fill: "#6b7280" },
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={trendColor}
              strokeWidth={3}
              dot={{ r: 4, fill: trendColor, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
        {trendData.interpretation}
      </p>
    </div>
  );
}

export { TrendChart };
