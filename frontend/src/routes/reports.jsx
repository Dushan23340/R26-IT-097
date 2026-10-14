import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, FileSpreadsheet, Printer, User, Users } from "lucide-react";
import { toast } from "sonner";
import { studentProfileApi } from "@/lib/studentProfileApi";
import { downloadFromAccount, platformApi, saveBlob, toCsv } from "@/lib/platformApi";
import { sessionsFromHistory } from "@/lib/badges";
import { SkeletonRows } from "@/components/LoadingSkeleton";
import { useT } from "@/lib/i18n";

const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — AdaptiveMind" }] }),
  validateSearch: (search) => ({ tab: ["class", "student", "usability"].includes(search.tab) ? search.tab : undefined, student: typeof search.student === "string" ? search.student : undefined }),
  component: ReportsPage,
});

const LO_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const today = () => new Date().toISOString().slice(0, 10);
const pct = (v) => (v == null || Number.isNaN(Number(v)) ? "–" : `${Math.round(Number(v))}%`);
const titleCase = (s) => (s ? String(s).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "–");

function printReport(t) {
  toast.info(t("Choose \"Save as PDF\" in the print window"), { duration: 3500 });
  setTimeout(() => window.print(), 150);
}

function Toolbar({ onCsv, disabled }) {
  const t = useT();
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button type="button" onClick={onCsv} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-primary/60 hover:bg-white/5 disabled:opacity-50">
        <FileSpreadsheet className="h-4 w-4" /> {t("Download CSV")}
      </button>
      <button
        type="button"
        onClick={() => printReport(t)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
      >
        <Printer className="h-4 w-4" /> {t("Print / Save as PDF")}
      </button>
    </div>
  );
}

function ReportHeader({ title, subtitle }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4">
      <div>
        <p className="eyebrow">AdaptiveMind · R26-IT-097</p>
        <h2 className="mt-1 text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <p className="text-xs text-muted-foreground">{t("Generated {date}", { date: new Date().toLocaleString() })}</p>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-xl font-bold tnum" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- class
function ClassReport() {
  const t = useT();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("name");

  useEffect(() => {
    studentProfileApi.getClassOverview().then(setOverview).catch((e) => setError(e.message));
  }, []);

  const students = useMemo(() => {
    const list = [...(overview?.students || [])];
    const by = {
      name: (a, b) => (a.full_name || a.student_id).localeCompare(b.full_name || b.student_id),
      score: (a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1),
      risk: (a, b) => Number(b.at_risk) - Number(a.at_risk) || (a.avg_score ?? 0) - (b.avg_score ?? 0),
    };
    return list.sort(by[sort]);
  }, [overview, sort]);

  const csv = () => {
    const text = toCsv(
      [
        { label: "Student", value: (s) => s.full_name || "" },
        { label: "Student ID", value: "student_id" },
        { label: "Average LO score (%)", value: (s) => (s.avg_score == null ? "" : Math.round(s.avg_score)) },
        { label: "Risk", value: "risk" },
        { label: "At risk", value: (s) => (s.at_risk ? "yes" : "no") },
        { label: "Trend", value: (s) => titleCase(s.trend) },
        { label: "Dominant emotion", value: (s) => s.dominant_emotion || "" },
      ],
      students
    );
    saveBlob(text, `adaptivemind-class-report-${today()}.csv`, "text/csv;charset=utf-8");
    toast.success(t("Class report downloaded"));
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          {t("Sort by")}
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-border px-3 text-sm">
            <option value="name">{t("Name")}</option>
            <option value="score">{t("Average score")}</option>
            <option value="risk">{t("Risk first")}</option>
          </select>
        </label>
        <Toolbar onCsv={csv} disabled={!overview} />
      </div>
      <section className="print-area glass rounded-2xl p-6 space-y-5">
        <ReportHeader title={t("Class progress report")} subtitle={t("All students with quiz results in the analytics service")} />
        {!overview ? (
          <SkeletonRows rows={5} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("Students")} value={overview.total_students} />
              <Stat label={t("Average LO score")} value={pct(overview.avg_lo_score)} tone="var(--teal)" />
              <Stat label={t("At-risk students")} value={overview.at_risk_count} tone={overview.at_risk_count ? "var(--emotion-frustrated)" : undefined} />
              <Stat label={t("Fairness check")} value={overview.fairness?.available ? (overview.fairness.fair ? t("Fair") : t("Flagged")) : t("Not enough data")} />
            </div>
            {overview.struggling_areas?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("Average by learning-outcome level")}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[...overview.struggling_areas].sort((a, b) => LO_ORDER.indexOf(a.lo_level) - LO_ORDER.indexOf(b.lo_level)).map((a) => (
                    <div key={a.lo_level} className="rounded-lg border border-border/60 p-2.5">
                      <div className="text-xs text-muted-foreground">{t(titleCase(a.lo_level))}</div>
                      <div className="font-bold tnum">{pct(a.avg_score)}</div>
                      <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(a.avg_score)}%`, background: "var(--gradient-primary)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="py-2 pr-3 font-medium">{t("Student")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Average")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Risk")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Trend")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Dominant emotion")}</th>
                    <th className="py-2 font-medium no-print" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.student_id} className="border-b border-border/30">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{s.full_name || s.student_id}</div>
                        <div className="text-[11px] text-muted-foreground">{s.student_id}</div>
                      </td>
                      <td className="py-2 pr-3 tnum">{pct(s.avg_score)}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs font-semibold ${s.at_risk ? "text-destructive" : "text-muted-foreground"}`}>{t(titleCase(s.risk))}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs">{t(titleCase(s.trend))}</td>
                      <td className="py-2 pr-3 text-xs">{s.dominant_emotion ? t(titleCase(s.dominant_emotion)) : "–"}</td>
                      <td className="py-2 no-print text-right">
                        <a href={`/reports?tab=student&student=${encodeURIComponent(s.student_id)}`} className="text-xs font-medium text-primary hover:underline">
                          {t("Report")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------- student
function StudentReport({ initialStudent }) {
  const t = useT();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(initialStudent || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    studentProfileApi
      .getClassOverview()
      .then((o) => {
        const list = (o.students || []).sort((a, b) => (a.full_name || a.student_id).localeCompare(b.full_name || b.student_id));
        setStudents(list);
        if (!initialStudent && list[0]) setSelected(list[0].student_id);
      })
      .catch((e) => toast.error(e.message));
  }, [initialStudent]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      studentProfileApi.getStudentHistory(selected),
      studentProfileApi.getStudentTrend(selected).catch(() => null),
      studentProfileApi.getStudentStability(selected).catch(() => null),
      studentProfileApi.getStudentLessonIntelligence(selected).catch(() => null),
      studentProfileApi.getApprovedRecommendations(selected).catch(() => null),
    ])
      .then(([history, trend, stability, intel, recs]) => !cancelled && setData({ history, trend, stability, intel, recs }))
      .catch((e) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const student = students.find((s) => s.student_id === selected);
  const sessions = useMemo(() => sessionsFromHistory(data?.history), [data]);
  const loLevels = useMemo(() => {
    const by = {};
    for (const r of data?.history?.lo_history || []) (by[r.lo_level] ||= []).push(Number(r.score));
    return LO_ORDER.filter((l) => by[l]).map((l) => ({ level: l, avg: by[l].reduce((a, b) => a + b, 0) / by[l].length, n: by[l].length }));
  }, [data]);
  const emotions = useMemo(() => {
    const counts = {};
    for (const e of data?.history?.emotional_states || []) counts[e.emotion_label] = (counts[e.emotion_label] || 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, n]) => ({ label, n, share: total ? n / total : 0 }));
  }, [data]);
  const lessons = data?.intel?.lessons || [];
  const recs = data?.recs?.recommendations || [];
  const avg = sessions.length ? sessions.reduce((a, s) => a + s.score, 0) / sessions.length : null;

  const csv = () => {
    const text = toCsv(
      [
        { label: "Date", value: (s) => new Date(s.start_time).toISOString().slice(0, 10) },
        { label: "Lesson", value: "lesson_id" },
        { label: "Session", value: "session_id" },
        { label: "Average LO score (%)", value: (s) => Math.round(s.score) },
      ],
      sessions
    );
    saveBlob(text, `adaptivemind-student-${selected}-${today()}.csv`, "text/csv;charset=utf-8");
    toast.success(t("Student report downloaded"));
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <User className="h-4 w-4" /> {t("Student")}
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="h-9 max-w-[260px] rounded-lg border border-border px-3 text-sm">
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.full_name || s.student_id}
              </option>
            ))}
          </select>
        </label>
        <Toolbar onCsv={csv} disabled={!data || loading} />
      </div>
      <section className="print-area glass rounded-2xl p-6 space-y-6">
        <ReportHeader title={student?.full_name || selected || t("Student report")} subtitle={selected ? `${t("Student progress report")} · ${selected}` : null} />
        {loading || !data ? (
          <SkeletonRows rows={5} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("Quizzes taken")} value={sessions.length} />
              <Stat label={t("Average score")} value={pct(avg)} tone="var(--teal)" />
              <Stat label={t("Trend")} value={data.trend?.available ? t(titleCase(data.trend.trend || data.trend.direction)) : t("Not enough data")} />
              <Stat label={t("Risk")} value={t(titleCase(student?.risk))} tone={student?.at_risk ? "var(--emotion-frustrated)" : undefined} />
            </div>

            {loLevels.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("Learning-outcome levels")}</h3>
                <div className="space-y-2">
                  {loLevels.map((l) => (
                    <div key={l.level} className="flex items-center gap-3 text-sm">
                      <span className="w-28 text-muted-foreground">{t(titleCase(l.level))}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(l.avg)}%`, background: "var(--gradient-primary)" }} />
                      </div>
                      <span className="w-12 text-right tnum font-medium">{pct(l.avg)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lessons.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-sm font-semibold mb-2">{t("Lessons")}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                      <th className="py-2 pr-3 font-medium">{t("Lesson")}</th>
                      <th className="py-2 pr-3 font-medium">{t("Latest")}</th>
                      <th className="py-2 pr-3 font-medium">{t("Average")}</th>
                      <th className="py-2 pr-3 font-medium">{t("Attempts")}</th>
                      <th className="py-2 font-medium">{t("Verdict")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((l) => (
                      <tr key={l.lesson_id} className="border-b border-border/30">
                        <td className="py-2 pr-3">{titleCase(l.lesson_id)}</td>
                        <td className="py-2 pr-3 tnum">{pct(l.current_score)}</td>
                        <td className="py-2 pr-3 tnum">{pct(l.historical_average)}</td>
                        <td className="py-2 pr-3 tnum">{l.session_count}</td>
                        <td className="py-2 text-xs">{t(titleCase(l.verdict))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {emotions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("Emotions seen during learning")}</h3>
                <div className="flex flex-wrap gap-2">
                  {emotions.map((e) => (
                    <span key={e.label} className="rounded-full border border-border/60 px-3 py-1 text-xs">
                      {t(titleCase(e.label))} · <span className="tnum font-semibold">{Math.round(e.share * 100)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("Approved recommendations")}</h3>
                <ul className="space-y-2">
                  {recs.slice(0, 6).map((r) => (
                    <li key={r.id} className="rounded-lg border border-border/50 p-3 text-sm">
                      {r.modified_text || r.recommendation_text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">{t("This student has no quiz results yet.")}</p>}
          </>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------ usability
const SUS_ITEMS = [
  "Would like to use it frequently",
  "Unnecessarily complex",
  "Easy to use",
  "Would need technical support",
  "Functions well integrated",
  "Too much inconsistency",
  "Most people would learn it quickly",
  "Very awkward to use",
  "Felt very confident",
  "Needed to learn a lot first",
];

function UsabilityReport() {
  const t = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    platformApi.surveySummary().then(setData).catch((e) => setError(e.message));
  }, []);

  const csv = async () => {
    try {
      await downloadFromAccount("/feedback/sus/export.csv", "adaptivemind-sus-results.csv");
      toast.success(t("Survey results downloaded"), { description: t("Participants are numbered, never named.") });
    } catch (e) {
      toast.error(t("Download failed"), { description: e.message });
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  const o = data?.overall;
  const maxBucket = Math.max(1, ...(data?.buckets || []).map((b) => b.count));
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("System Usability Scale (SUS), 0-100. Each person's latest answers count once.")}</p>
        <Toolbar onCsv={csv} disabled={!data || !o?.n} />
      </div>
      <section className="print-area glass rounded-2xl p-6 space-y-6">
        <ReportHeader title={t("Usability survey results")} subtitle={t("System Usability Scale (Brooke, 1996); adjectives from Bangor et al. (2009)")} />
        {!data ? (
          <SkeletonRows rows={4} />
        ) : !o?.n ? (
          <p className="text-sm text-muted-foreground">{t("No answers yet. Ask students and teachers to open the survey from their dashboard (or /feedback).")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label={t("Mean SUS score")} value={o.mean} tone={o.mean >= 68 ? "var(--emotion-happy)" : "var(--amber)"} />
              <Stat label={t("Rating")} value={`${t(o.adjective)} · ${t(o.acceptability)}`} />
              <Stat label={t("Participants")} value={o.n} />
              <Stat label={t("95% confidence interval")} value={o.ci95 ? `${o.ci95[0]} – ${o.ci95[1]}` : "–"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("SD {sd}, median {median}, range {min}-{max}. The usual benchmark is 68: above it is better than average.", { sd: o.sd, median: o.median, min: o.min, max: o.max })}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">{t("By role")}</h3>
                <div className="space-y-2">
                  {Object.entries(data.byRole).map(([role, s]) => (
                    <div key={role} className="flex items-center gap-3 text-sm">
                      <span className="w-20 text-muted-foreground">{t(titleCase(role))}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden relative">
                        <div className="h-full rounded-full" style={{ width: `${s.mean ?? 0}%`, background: "var(--gradient-primary)" }} />
                        <span className="absolute top-[-3px] h-[14px] w-px bg-amber" style={{ left: "68%" }} title="68" />
                      </div>
                      <span className="w-24 text-right tnum text-xs">{s.n ? `${s.mean} (n=${s.n})` : "–"}</span>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-semibold mt-6 mb-3">{t("Score distribution")}</h3>
                <div className="flex items-end gap-2 h-28">
                  {data.buckets.map((b) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[11px] tnum text-muted-foreground">{b.count}</span>
                      <div className="w-full rounded-t-md" style={{ height: `${(b.count / maxBucket) * 80 + 4}px`, background: "var(--gradient-primary)", opacity: b.count ? 1 : 0.25 }} />
                      <span className="text-[10px] text-muted-foreground">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3">{t("Average per statement (1-5)")}</h3>
                <ul className="space-y-1.5">
                  {data.itemMeans.map((m, i) => {
                    const positive = i % 2 === 0;
                    const good = m == null ? null : positive ? m >= 4 : m <= 2;
                    return (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-6 tnum text-muted-foreground">Q{i + 1}</span>
                        <span className="flex-1 truncate">{t(SUS_ITEMS[i])}</span>
                        <span className={`tnum font-semibold ${good ? "text-emotion-happy" : good === false ? "text-amber" : ""}`}>{m ?? "–"}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">{t("Odd statements are positive (higher is better); even statements are negative (lower is better).")}</p>
              </div>
            </div>

            {data.comments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("Comments")}</h3>
                <ul className="space-y-2">
                  {data.comments.map((c, i) => (
                    <li key={i} className="rounded-lg border border-border/50 p-3 text-sm">
                      “{c.comment}” <span className="text-xs text-muted-foreground">— {t(titleCase(c.role))}, SUS {c.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const TABS = [
  ["class", "Class report", Users],
  ["student", "Student report", User],
  ["usability", "Usability survey", ClipboardList],
];

function ReportsPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab || "class";
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="no-print glass rounded-3xl p-6 sm:p-8">
        <p className="eyebrow flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" /> {t("Reports")}
        </p>
        <h1 className="mt-2 text-3xl font-bold">{t("Reports & exports")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Download progress reports as CSV for spreadsheets, or print them / save them as PDF to share with students and parents.")}</p>
        <div role="tablist" className="mt-5 flex flex-wrap gap-2">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => navigate({ search: { tab: key } })}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === key ? "text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
              style={tab === key ? { background: "var(--gradient-primary)" } : undefined}
            >
              <Icon className="h-4 w-4" /> {t(label)}
            </button>
          ))}
        </div>
      </div>
      <div key={tab} className="page-enter">
        {tab === "class" ? <ClassReport /> : tab === "student" ? <StudentReport initialStudent={search.student} /> : <UsabilityReport />}
      </div>
    </div>
  );
}

export { Route };
