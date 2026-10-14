import { Link } from "@tanstack/react-router";
import { Check, GraduationCap, Sparkles, Users } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { LanguageToggle, useT } from "@/lib/i18n";

const ROLE_ICON = { student: GraduationCap, teacher: Users };

function Logo({ size = "md" }) {
  const t = useT();
  const box = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <Link to="/login" className="inline-flex items-center gap-3">
      <span className={`${box} rounded-xl grid place-items-center`} style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </span>
      <span>
        <span className="block font-display text-xl font-bold leading-tight">
          Adaptive<span className="text-gradient-primary">Mind</span>
        </span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("Emotion-Aware Learning")}</span>
      </span>
    </Link>
  );
}

// A small, clearly illustrative preview of what each role sees after signing in.
function RolePreview({ role }) {
  const t = useT();
  if (role === "teacher") {
    const rows = [["Bored", 34, true], ["Normal", 25], ["Happy", 21], ["Confused", 12], ["Frustrated", 8]];
    return (
      <div className="glass-strong rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{t("Class emotion · live")}</p>
          <span className="rounded-full border border-amber/40 bg-amber/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber">{t("Bored")} 34%</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {rows.map(([label, pct, hot]) => (
            <div key={label} className="grid grid-cols-[84px_1fr_36px] items-center gap-3 text-xs">
              <span>{t(label)}</span>
              <span className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: hot ? "var(--gradient-accent)" : "var(--gradient-primary)" }} />
              </span>
              <span className="text-right text-muted-foreground tnum">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const tiers = [["5/5", "Good", "Remember", "text-emotion-happy"], ["3/5", "Average", "Understand", "text-amber"], ["1/2", "Average", "Apply", "text-amber"]];
  return (
    <div className="glass-strong rounded-2xl p-5 border border-border">
      <p className="eyebrow">{t("Your mastery · last quiz")}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {tiers.map(([score, tier, level, colour]) => (
          <div key={level} className="rounded-xl border border-border bg-background/40 p-3 text-center">
            <div className="text-xl font-bold tnum">{score}</div>
            <div className={`text-[11px] font-semibold ${colour}`}>{tier}</div>
            <div className="text-[10px] text-muted-foreground">{level}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthLayout({ role, children }) {
  const t = useT();
  const info = ROLES[role] || ROLES.student;
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border/60 p-12 xl:p-16">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 10%, color-mix(in oklab, var(--teal) 22%, transparent), transparent 70%), radial-gradient(50% 45% at 90% 95%, color-mix(in oklab, var(--amber) 12%, transparent), transparent 70%)",
          }}
        />
        <div className="grid-texture absolute inset-0 -z-10 opacity-70" />
        <Logo size="lg" />

        <div key={role} className="max-w-lg animate-fade-in">
          <p className="eyebrow">{t(`For ${info.label.toLowerCase()}s`)}</p>
          <h1 className="mt-3 text-4xl xl:text-5xl font-bold leading-[1.08] tracking-tight">
            {t(info.headline[0])} <span className="text-gradient-warm">{t(info.headline[1])}</span>
          </h1>
          <ul className="mt-8 space-y-5">
            {info.points.map(([title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full grid place-items-center bg-primary/15 border border-primary/40">
                  <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                </span>
                <span>
                  <span className="block font-semibold">{t(title)}</span>
                  <span className="block text-sm text-muted-foreground">{t(text)}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <RolePreview role={role} />
            <p className="mt-2 text-[11px] text-muted-foreground">{t("Illustrative preview with sample values.")}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">R26-IT-097 · {t("SLIIT Faculty of Computing · Research prototype")}</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <LanguageToggle className="absolute right-5 top-5" />
        <div className="lg:hidden mb-8">
          <Logo />
        </div>
        <div className="w-full max-w-md animate-slide-up">{children}</div>
      </main>
    </div>
  );
}

// Two large cards (sign-up) or a compact segmented control (sign-in).
function RolePicker({ value, onChange, compact = false }) {
  const t = useT();
  if (compact) {
    return (
      <div role="radiogroup" aria-label="I am a" className="grid grid-cols-2 gap-1 rounded-full border border-border bg-background/40 p-1">
        {Object.values(ROLES).map((r) => {
          const Icon = ROLE_ICON[r.key];
          const active = value === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(r.key)}
              className={`flex items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors ${active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={active ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : undefined}
            >
              <Icon className="h-4 w-4" />
              {t(r.label)}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="I am a" className="grid grid-cols-2 gap-3">
      {Object.values(ROLES).map((r) => {
        const Icon = ROLE_ICON[r.key];
        const active = value === r.key;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.key)}
            className={`relative text-left rounded-2xl border p-4 transition-all ${
              active ? "border-primary bg-primary/10 shadow-[0_0_0_3px_color-mix(in_oklab,var(--teal)_18%,transparent)]" : "border-border bg-background/30 hover:border-primary/50"
            }`}
          >
            <span className={`h-10 w-10 rounded-xl grid place-items-center ${active ? "text-primary-foreground" : "text-primary bg-primary/10"}`} style={active ? { background: "var(--gradient-primary)" } : undefined}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="mt-3 block font-semibold">{t(r.label)}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">{t(r.tagline)}</span>
            {active && (
              <span className="absolute right-3 top-3 h-5 w-5 rounded-full grid place-items-center bg-primary">
                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { AuthLayout, RolePicker };
