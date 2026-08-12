import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  Sparkles,
  Zap,
} from "lucide-react";
import { analyticsApi } from "@/lib/api";
import SuggestionCard from "@/components/SuggestionCard";

// ── Stats card ────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconClass = "text-primary" }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-secondary/50">
        <Icon size={18} className={iconClass} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
function EmptyState({ filtered }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-emotion-happy/10 rounded-full mb-4">
        <CheckCircle2 size={28} className="text-emotion-happy" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {filtered ? "No suggestions match this filter" : "All caught up!"}
      </h3>
      <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
        {filtered
          ? "Try a different urgency filter to see more suggestions."
          : "No pending suggestions right now. Use the Generate panel to create suggestions for students who need attention."}
      </p>
    </div>
  );
}

/**
 * ERSEDashboard
 *
 * Teacher-facing dashboard for the Evidence-Reasoned Suggestion Engine.
 * Displays pending suggestions across all students with urgency filtering,
 * inline review actions, and on-demand suggestion generation.
 */
export default function ERSEDashboard() {
  const [suggestions, setSuggestions]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [generating, setGenerating]       = useState(false);
  const [generateId, setGenerateId]       = useState("");
  const [generateMsg, setGenerateMsg]     = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.getPendingSuggestions({ limit: 100 });
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err.message || "Failed to load suggestions. Is the analytics service running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const immediate = suggestions.filter(s => s.urgency === "Immediate").length;
  const monitor   = suggestions.filter(s => s.urgency === "Monitor").length;
  const routine   = suggestions.filter(s => s.urgency === "Routine").length;

  const filtered = urgencyFilter === "All"
    ? suggestions
    : suggestions.filter(s => s.urgency === urgencyFilter);

  function handleReviewed() {
    fetchPending();
  }

  async function handleGenerate() {
    const id = generateId.trim().toUpperCase();
    if (!id) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const data = await analyticsApi.generateSuggestion(id, true);
      setGenerateMsg({
        type: "success",
        text: `Generated for ${id}: ${data.pattern?.name || "pattern assigned"} · ${data.pattern?.urgency || ""}`,
      });
      setGenerateId("");
      fetchPending();
    } catch (err) {
      setGenerateMsg({
        type: "error",
        text: err.message || "Failed to generate suggestion.",
      });
    } finally {
      setGenerating(false);
    }
  }

  const tabs = [
    { label: "All",       count: suggestions.length, countClass: "bg-secondary text-muted-foreground" },
    { label: "Immediate", count: immediate,           countClass: "bg-destructive/10 text-destructive" },
    { label: "Monitor",   count: monitor,             countClass: "bg-amber/10 text-amber" },
    { label: "Routine",   count: routine,             countClass: "bg-emotion-happy/10 text-emotion-happy" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <Brain size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-display">
                ERSE — Suggestion Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Evidence-Reasoned Suggestion Engine · Pending teacher review
              </p>
            </div>
          </div>
          <button
            onClick={fetchPending}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Stats row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Sparkles}      label="Pending total" value={suggestions.length} iconClass="text-primary" />
          <StatCard icon={AlertTriangle} label="Immediate"     value={immediate}          iconClass="text-destructive" />
          <StatCard icon={Clock}         label="Monitor"       value={monitor}            iconClass="text-amber" />
          <StatCard icon={CheckCircle2}  label="Routine"       value={routine}            iconClass="text-emotion-happy" />
        </div>

        {/* ── Generate panel ────────────────────────────────────── */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Zap size={13} className="text-primary" />
            Generate Suggestion for a Student
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Student ID (e.g. STU_008)"
              value={generateId}
              onChange={e => setGenerateId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
              className="flex-1 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !generateId.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium border border-primary/20 transition-colors disabled:opacity-50"
            >
              {generating
                ? <RefreshCw size={13} className="animate-spin" />
                : <Sparkles size={13} />}
              Generate
            </button>
          </div>
          {generateMsg && (
            <p className={`text-xs rounded-xl px-3 py-2 border ${
              generateMsg.type === "success"
                ? "bg-emotion-happy/10 text-emotion-happy border-emotion-happy/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }`}>
              {generateMsg.text}
            </p>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div className="glass rounded-2xl px-4 py-3 text-xs text-destructive border border-destructive/20 flex items-center gap-2">
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        {/* ── Tabs + list ───────────────────────────────────────── */}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border/50 px-1">
              {tabs.map(tab => (
                <button
                  key={tab.label}
                  onClick={() => setUrgencyFilter(tab.label)}
                  className={`px-4 py-3 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    urgencyFilter === tab.label
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Filter size={10} />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab.countClass}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Suggestion cards */}
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState filtered={urgencyFilter !== "All"} />
              ) : (
                filtered.map(s => (
                  <SuggestionCard
                    key={s.suggestion_id}
                    suggestion={s}
                    studentId={s.student_id}
                    studentName={s.student_name}
                    onReviewed={handleReviewed}
                    showActions
                  />
                ))
              )}
            </div>
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            ERSE · R26-IT-097 · Statistical evidence attached to each suggestion
          </p>
        )}
      </div>
    </div>
  );
}
