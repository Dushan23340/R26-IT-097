import { ShieldAlert, ShieldCheck, Activity } from "lucide-react";

function StabilityCard({ stabilityData }) {
  if (!stabilityData || !stabilityData.sd) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Insufficient data for stability analysis.</p>
      </div>
    );
  }

  const {
    variance,
    sd,
    cv,
    at_risk,
    interpretation,
    num_sessions,
    rolling_variance,
  } = stabilityData;

  const isAtRisk = at_risk === true;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: isAtRisk ? "#ef444415" : "#22c55e15" }}
          >
            {isAtRisk ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emotion-happy" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Stability Analysis</h3>
            <p className="text-xs text-muted-foreground">
              {num_sessions} sessions analyzed
            </p>
          </div>
        </div>
        {isAtRisk && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            At Risk
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Variance</p>
          <p className="text-lg font-bold font-mono">{variance?.toFixed(1) ?? "N/A"}</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Std Dev</p>
          <p className="text-lg font-bold font-mono">{sd?.toFixed(1) ?? "N/A"}</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">CV</p>
          <p className="text-lg font-bold font-mono">{cv?.toFixed(1) ?? "N/A"}%</p>
        </div>
      </div>

      {rolling_variance && rolling_variance.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Rolling Variance (3-session window)</p>
          <div className="flex items-end gap-1 h-16">
            {rolling_variance.map(([idx, rv]) => {
              const maxRv = Math.max(...rolling_variance.map(([, v]) => v), 1);
              const heightPct = Math.min((rv / maxRv) * 100, 100);
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    background:
                      rv > maxRv * 0.7
                        ? "#ef4444"
                        : rv > maxRv * 0.4
                          ? "#f59e0b"
                          : "#22c55e",
                    opacity: 0.8,
                  }}
                  title={`Window ${idx + 1}: ${rv.toFixed(1)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Start</span>
            <span>End</span>
          </div>
        </div>
      )}

      <div
        className={`p-3 rounded-xl text-sm ${
          isAtRisk
            ? "bg-destructive/5 text-destructive border border-destructive/10"
            : "bg-emotion-happy/5 text-emotion-happy border border-emotion-happy/10"
        }`}
      >
        <p className="font-medium mb-1">
          {isAtRisk ? "Attention Required" : "Performance Stable"}
        </p>
        <p className="text-xs leading-relaxed opacity-90">{interpretation}</p>
      </div>
    </div>
  );
}

export { StabilityCard };
