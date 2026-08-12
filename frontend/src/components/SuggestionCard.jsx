import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  BarChart2,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  X,
} from "lucide-react";
import { analyticsApi } from "@/lib/api";

const URGENCY_CONFIG = {
  Immediate: {
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive border border-destructive/20",
  },
  Monitor: {
    icon: Clock,
    className: "bg-amber/10 text-amber border border-amber/20",
  },
  Routine: {
    icon: CheckCircle2,
    className: "bg-emotion-happy/10 text-emotion-happy border border-emotion-happy/20",
  },
};

const CONFIDENCE_CONFIG = {
  High:   "bg-primary/10 text-primary border border-primary/20",
  Medium: "bg-accent/10 text-accent-foreground border border-accent/20",
  Low:    "bg-muted text-muted-foreground border border-border",
};

const STATUS_CONFIG = {
  pending:   "bg-amber/10 text-amber border border-amber/20",
  approved:  "bg-emotion-happy/10 text-emotion-happy border border-emotion-happy/20",
  modified:  "bg-primary/10 text-primary border border-primary/20",
  dismissed: "bg-muted text-muted-foreground border border-border",
};

function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function SuggestionCard({
  suggestion,
  studentId,
  studentName,
  onReviewed,
  showActions = true,
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [modifyMode, setModifyMode]     = useState(false);
  const [modifiedText, setModifiedText] = useState("");
  const [dismissNotes, setDismissNotes] = useState("");
  const [dismissMode, setDismissMode]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [localStatus, setLocalStatus]   = useState(suggestion?.status || "pending");

  // Guard: if suggestion is malformed, render nothing
  if (!suggestion || !suggestion.suggestion_id) return null;

  const urgency     = URGENCY_CONFIG[suggestion.urgency] || URGENCY_CONFIG.Routine;
  const UrgencyIcon = urgency.icon;
  const isPending   = localStatus === "pending";

  async function handleReview(action) {
    setLoading(true);
    setError(null);
    try {
      await analyticsApi.reviewSuggestion(studentId, suggestion.suggestion_id, {
        action,
        teacherNotes:       dismissMode ? dismissNotes : undefined,
        modifiedSuggestion: modifyMode  ? modifiedText : undefined,
        reviewedBy: "teacher",
      });
      setLocalStatus(
        action === "approve" ? "approved" :
        action === "modify"  ? "modified" : "dismissed"
      );
      setModifyMode(false);
      setDismissMode(false);
      if (onReviewed) onReviewed(action, suggestion.suggestion_id);
    } catch (err) {
      setError(err.message || "Review failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/50">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-border/50 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground text-sm flex-1 min-w-0">
            {suggestion.pattern_name}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${urgency.className}`}>
            <UrgencyIcon size={11} />
            {suggestion.urgency}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_CONFIG[suggestion.confidence] || CONFIDENCE_CONFIG.Low}`}>
            {suggestion.confidence} confidence
          </span>
          {!isPending && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[localStatus] || STATUS_CONFIG.pending}`}>
              {capitalize(localStatus)}
            </span>
          )}
        </div>
        {studentName && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User size={11} />
            {studentName}
            <span className="text-border mx-0.5">·</span>
            <span className="font-mono">{studentId}</span>
          </p>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* Teacher suggestion */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <GraduationCap size={12} /> For the Teacher
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {suggestion.teacher_suggestion}
          </p>
        </div>

        {/* Student suggestion */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <User size={12} /> For the Student
          </p>
          <p className="text-sm text-foreground leading-relaxed bg-primary/5 rounded-xl px-3 py-2.5 border border-primary/10">
            {suggestion.student_suggestion}
          </p>
        </div>

        {/* Expected outcome */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <BarChart2 size={12} /> Expected Outcome
          </p>
          <p className="text-sm text-muted-foreground italic">
            {suggestion.expected_outcome}
          </p>
        </div>

        {/* Evidence — collapsible */}
        {suggestion.evidence && suggestion.evidence.length > 0 && (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setEvidenceOpen(v => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-muted-foreground bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <BarChart2 size={12} />
                Statistical Evidence ({suggestion.evidence.length} signals)
              </span>
              {evidenceOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {evidenceOpen && (
              <div className="divide-y divide-border/40">
                {suggestion.evidence.map((item, i) => (
                  <div key={i} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {item.value !== null && item.value !== undefined
                          ? `${item.value} ${item.unit}`
                          : item.unit}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex-1 bg-secondary rounded-full h-1">
                        <div
                          className="bg-primary h-1 rounded-full"
                          style={{ width: `${Math.round(item.weight * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{Math.round(item.weight * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2 border border-destructive/20">
            {error}
          </p>
        )}

        {/* Modify textarea */}
        {modifyMode && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Edit Suggestion
            </label>
            <textarea
              className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              rows={4}
              value={modifiedText}
              onChange={e => setModifiedText(e.target.value)}
              placeholder="Enter your modified suggestion..."
            />
          </div>
        )}

        {/* Dismiss textarea */}
        {dismissMode && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Dismissal Reason (required)
            </label>
            <textarea
              className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-destructive/50 placeholder:text-muted-foreground"
              rows={3}
              value={dismissNotes}
              onChange={e => setDismissNotes(e.target.value)}
              placeholder="Reason for dismissing this suggestion..."
            />
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────── */}
      {showActions && isPending && (
        <div className="px-5 py-3 bg-secondary/20 border-t border-border/50 flex flex-wrap gap-2">

          {!modifyMode && !dismissMode && (
            <button
              onClick={() => handleReview("approve")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emotion-happy/10 hover:bg-emotion-happy/20 text-emotion-happy text-xs font-medium border border-emotion-happy/20 transition-colors disabled:opacity-50"
            >
              <ThumbsUp size={12} /> Approve
            </button>
          )}

          {!dismissMode && (
            modifyMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview("modify")}
                  disabled={loading || !modifiedText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium border border-primary/20 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={12} /> Submit Edit
                </button>
                <button
                  onClick={() => { setModifyMode(false); setModifiedText(""); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary/50 transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setModifyMode(true); setModifiedText(suggestion.teacher_suggestion); }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <Pencil size={12} /> Modify
              </button>
            )
          )}

          {!modifyMode && (
            dismissMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview("dismiss")}
                  disabled={loading || !dismissNotes.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium border border-destructive/20 transition-colors disabled:opacity-50"
                >
                  <ThumbsDown size={12} /> Confirm Dismiss
                </button>
                <button
                  onClick={() => { setDismissMode(false); setDismissNotes(""); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary/50 transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDismissMode(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <ThumbsDown size={12} /> Dismiss
              </button>
            )
          )}

          {loading && (
            <span className="text-xs text-muted-foreground self-center ml-1">Saving...</span>
          )}
        </div>
      )}

      {/* Reviewed footer */}
      {!isPending && suggestion.reviewed_at && (
        <div className="px-5 py-2.5 bg-secondary/20 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {capitalize(localStatus)} on{" "}
            {new Date(suggestion.reviewed_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
            {suggestion.reviewed_by && ` by ${suggestion.reviewed_by}`}
          </p>
        </div>
      )}
    </div>
  );
}
