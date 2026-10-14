import { useEffect } from "react";
import { Outlet, Link, createRootRoute, useLocation, useRouter } from "@tanstack/react-router";
import { Compass, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ActiveGameBanner } from "@/components/ActiveGameBanner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { homeFor } from "@/lib/roles";

// Pages anyone may open. Everything else needs a signed-in user.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];
// Pages that belong to one role. A user of the other role is sent to their
// own home instead of seeing a page built for someone else.
const STUDENT_ONLY = ["/", "/lessons"];
const TEACHER_ONLY = ["/teacher"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass rounded-3xl max-w-md w-full text-center p-10">
        <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center bg-primary/10 border border-primary/30">
          <Compass className="h-7 w-7 text-primary" />
        </div>
        <p className="eyebrow mt-6">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function FullScreenLoader() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// One place that decides who may see which page, instead of each route
// repeating its own check (and some routes having none).
function Guard({ children }) {
  const { user, isLoading } = useAuth();
  const { pathname } = useLocation();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  let redirectTo = null;
  if (!isLoading) {
    if (!user && !isPublic) redirectTo = "/login";
    else if (user && isPublic) redirectTo = homeFor(user.role);
    else if (user?.role === "teacher" && STUDENT_ONLY.includes(pathname)) redirectTo = "/teacher";
    else if (user?.role === "student" && TEACHER_ONLY.includes(pathname)) redirectTo = "/";
  }

  useEffect(() => {
    if (redirectTo) router.navigate({ to: redirectTo, replace: true });
  }, [redirectTo, router]);

  if (isLoading || redirectTo) return <FullScreenLoader />;
  return children;
}

function Shell() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthPage = PUBLIC_PATHS.includes(pathname);

  if (isAuthPage) {
    return (
      <Guard>
        <Outlet />
      </Guard>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className={`flex-1 w-full mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 animate-fade-in ${user ? "pb-28 md:pb-10" : ""}`}>
        <Guard>
          <Outlet />
        </Guard>
      </main>
      <footer className="hidden md:block border-t border-border/50">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Adaptive<span className="text-gradient-primary font-semibold">Mind</span> · Emotion-aware adaptive learning
          </span>
          <span>R26-IT-097 · SLIIT Faculty of Computing</span>
        </div>
      </footer>
      <ActiveGameBanner />
    </div>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Shell />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

export { Route };
