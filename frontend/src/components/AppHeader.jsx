import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, Users, UserCircle, ShieldCheck, Sparkles, LogOut, LogIn, Brain, Puzzle } from "lucide-react";
import { useAuth } from "@/lib/auth";
const allTabs = [
  { to: "/", label: "Dashboard", icon: GraduationCap, roles: ["student"] },
  { to: "/fraction-room", label: "Fraction Room", icon: Puzzle, roles: ["student"] },
  { to: "/adaptive", label: "Adaptive Learning", icon: Brain, roles: ["student", "teacher"] },
  { to: "/teacher", label: "Teacher Console", icon: Users, roles: ["teacher"] },
  { to: "/profile", label: "Profile", icon: UserCircle, roles: ["student", "teacher"] },
  { to: "/admin", label: "Admin", icon: ShieldCheck, roles: ["admin"] }
];
function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const tabs = allTabs.filter((tab) => {
    if (!user) return false;
    return tab.roles.includes(user.role);
  });
  return <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
      <div className="grid-texture absolute inset-0 opacity-50 pointer-events-none" />
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div
    className="relative h-10 w-10 rounded-xl flex items-center justify-center"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
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
    return <Link
      key={t.to}
      to={t.to}
      className="relative px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors"
      style={{
        color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
        background: active ? "var(--gradient-primary)" : "transparent",
        boxShadow: active ? "var(--shadow-glow)" : "none"
      }}
    >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>;
  })}
        </nav>

        {user ? <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <UserCircle className="h-5 w-5 text-primary" />
              <div className="hidden md:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{user.role}</div>
              </div>
            </div>
            <button
    onClick={logout}
    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
  >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div> : <div className="flex items-center gap-2">
            <Link
    to="/login"
    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border hover:border-primary transition-colors"
  >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
            <Link
    to="/signup"
    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-primary-foreground"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
              <span className="hidden sm:inline">Sign Up</span>
              <span className="sm:hidden">Join</span>
            </Link>
          </div>}
      </div>
    </header>;
}
export {
  AppHeader
};
