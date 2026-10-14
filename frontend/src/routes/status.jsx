import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, Database, HeartPulse, RefreshCw, Server, XCircle } from "lucide-react";
import { platformApi } from "@/lib/platformApi";
import { useT } from "@/lib/i18n";

const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "System status — AdaptiveMind" }] }),
  component: StatusPage,
});

const REFRESH_MS = 15000;
const HISTORY = 20;
const TONE = { up: "var(--emotion-happy)", degraded: "var(--amber)", down: "var(--destructive)" };
const LABEL = { up: "Operational", degraded: "Degraded", down: "Down" };
const ICON = { up: CheckCircle2, degraded: CircleAlert, down: XCircle };

// Response times of the last checks, drawn as small bars.
function Sparkline({ points }) {
  const max = Math.max(50, ...points.map((p) => p.ms));
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
      {Array.from({ length: HISTORY }, (_, i) => {
        const p = points[points.length - HISTORY + i];
        return (
          <span
            key={i}
            className="w-1.5 rounded-sm transition-all duration-500"
            style={p ? { height: `${Math.max(12, (p.ms / max) * 100)}%`, background: TONE[p.status], opacity: 0.85 } : { height: "12%", background: "var(--secondary)" }}
          />
        );
      })}
    </div>
  );
}

function StatusPage() {
  const t = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const history = useRef({});
  const [, force] = useState(0);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await platformApi.systemStatus();
      for (const s of res.services) {
        history.current[s.key] = [...(history.current[s.key] || []), { ms: s.ms, status: s.status }].slice(-HISTORY);
      }
      setData(res);
      setError(null);
      force((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(() => document.visibilityState === "visible" && check(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [check]);

  const overall = data?.overall;
  const OverallIcon = overall ? ICON[overall] : HeartPulse;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="glass rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span
            className="h-16 w-16 rounded-2xl grid place-items-center"
            style={overall ? { background: `color-mix(in oklab, ${TONE[overall]} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${TONE[overall]} 45%, transparent)` } : undefined}
          >
            <OverallIcon className={`h-8 w-8 ${!overall ? "text-muted-foreground" : ""}`} style={overall ? { color: TONE[overall] } : undefined} />
          </span>
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> {t("System status")}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold">
              {!data ? t("Checking services...") : overall === "up" ? t("All systems operational") : overall === "degraded" ? t("Some services need attention") : t("Some services are down")}
            </h1>
            {data && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Last checked {time} · refreshes every 15 s", { time: new Date(data.checkedAt).toLocaleTimeString() })}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-primary/60 hover:bg-white/5 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> {t("Check now")}
        </button>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 text-sm text-destructive flex items-center gap-2" role="alert">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="cascade grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {!data
          ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-44 rounded-2xl" />)
          : data.services.map((s) => {
              const Icon = ICON[s.status];
              return (
                <article key={s.key} className="glass rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center bg-secondary/60 border border-border">
                        {s.key === "account" ? <Database className="h-5 w-5 text-primary" /> : <Server className="h-5 w-5 text-primary" />}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-sm truncate">{t(s.name)}</h2>
                        <p className="text-[11px] text-muted-foreground">{s.owner}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: TONE[s.status], background: `color-mix(in oklab, ${TONE[s.status]} 13%, transparent)` }}>
                      <Icon className="h-3.5 w-3.5" /> {t(LABEL[s.status])}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold tnum">{s.status === "down" ? "—" : `${s.ms} ms`}</div>
                      <div className="text-[11px] text-muted-foreground">{s.status === "down" ? t(s.error || "Not reachable") : t("Response time")}</div>
                    </div>
                    <Sparkline points={history.current[s.key] || []} />
                  </div>
                  {s.details?.length > 0 && (
                    <ul className="space-y-1 border-t border-border/50 pt-3">
                      {s.details.map((d) => (
                        <li key={d.label} className="flex items-center gap-2 text-xs">
                          {d.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emotion-happy" /> : <CircleAlert className="h-3.5 w-3.5 text-amber" />}
                          <span className="text-muted-foreground">{t(d.label)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("Each service is checked from the server, through its health endpoint. Response times are for that check, not for page loads.")}
      </p>
    </div>
  );
}

export { Route };
