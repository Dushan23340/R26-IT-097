import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, Users, UserCircle, ShieldCheck, Sparkles } from "lucide-react";

const tabs = [
  { to: "/", label: "Student", icon: GraduationCap },
  { to: "/teacher", label: "Teacher", icon: Users },
  { to: "/profile", label: "Profile", icon: UserCircle },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
] as const;

export function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
      <div className="grid-texture absolute inset-0 opacity-50 pointer-events-none" />
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 rounded-xl flex items-center justify-center"
               style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight">Adaptive<span className="text-gradient-primary">Mind</span></div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Emotion-Aware Learning</div>
          </div>
        </Link>

        <nav className="glass rounded-full p-1 flex items-center gap-1">
          {tabs.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors"
                style={{
                  color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  background: active ? "var(--gradient-primary)" : "transparent",
                  boxShadow: active ? "var(--shadow-glow)" : "none",
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emotion-happy animate-pulse" style={{ background: "var(--emotion-happy)" }} />
          Live session · CS2040 — Algorithms
        </div>
      </div>
    </header>
  );
}
