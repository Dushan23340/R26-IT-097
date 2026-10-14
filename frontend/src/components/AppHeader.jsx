import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, Users, UserCircle, ShieldCheck, Sparkles, LogOut, LogIn, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";

const allTabs = [
  { to: "/", label: "Dashboard", short: "Home", icon: GraduationCap, roles: ["student"] },
  { to: "/lessons", label: "Adaptive Learning", short: "Learn", icon: BookOpen, roles: ["student"] },
  { to: "/teacher", label: "Teacher Console", short: "Console", icon: Users, roles: ["teacher"] },
  { to: "/profile", label: "Profile", short: "Profile", icon: UserCircle, roles: ["student", "teacher"] },
  { to: "/admin", label: "Admin", short: "Admin", icon: ShieldCheck, roles: ["admin"] },
];

// Pages that bring their own full-screen layout and brand panel.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 group shrink-0">
      <div
        className="relative h-10 w-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
        style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
      >
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <div className="font-display text-lg font-bold leading-tight">
          Adaptive<span className="text-gradient-primary">Mind</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Emotion-Aware Learning</div>
      </div>
    </Link>
  );
}

function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  if (AUTH_PATHS.includes(pathname)) return null;

  const tabs = user ? allTabs.filter((tab) => tab.roles.includes(user.role)) : [];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
        <div className="grid-texture absolute inset-0 opacity-50 pointer-events-none" />
        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          <Brand />

          {tabs.length > 0 && (
            <nav aria-label="Main" className="hidden md:flex glass rounded-full p-1 items-center gap-1">
              {tabs.map((t) => {
                const active = pathname === t.to;
                const Icon = t.icon;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    aria-current={active ? "page" : undefined}
                    className={`relative px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${
                      active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    style={active ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-full py-1 pl-1 pr-1 md:pr-4 border border-transparent hover:border-border hover:bg-white/5 transition-colors"
                title="Your profile"
              >
                {user.avatarDataUrl ? (
                  <img src={user.avatarDataUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40" />
                ) : (
                  <span
                    className="h-9 w-9 rounded-full grid place-items-center text-xs font-bold text-primary-foreground"
                    style={{ background: "var(--gradient-primary)" }}
                    aria-hidden="true"
                  >
                    {initialsOf(user.name)}
                  </span>
                )}
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-sm font-medium max-w-[160px] truncate">{user.name}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{user.role}</span>
                </span>
              </Link>
              <button
                onClick={logout}
                title="Log out"
                className="flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-muted-foreground border border-transparent hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border hover:border-primary transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
              <Link
                to="/signup"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Phone and small tablet: the same destinations as a bottom tab bar. */}
      {tabs.length > 0 && (
        <nav
          aria-label="Main"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((t) => {
              const active = pathname === t.to;
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  <span
                    className="h-8 w-14 rounded-full grid place-items-center transition-colors"
                    style={active ? { background: "color-mix(in oklab, var(--teal) 18%, transparent)" } : undefined}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {t.short}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

export { AppHeader, Brand, initialsOf };
