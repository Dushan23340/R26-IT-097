import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { subscribeInFlight } from "@/lib/network";

// Thin teal bar across the top of the window while a page is changing or a
// request the user started is still running. It waits 250 ms before
// appearing, so fast local requests never make it flicker.
function TopProgress() {
  const [requests, setRequests] = useState(0);
  const routing = useRouterState({ select: (s) => s.status === "pending" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navBlip, setNavBlip] = useState(false);
  const firstPath = useRef(pathname);

  useEffect(() => subscribeInFlight(setRequests), []);

  // A short sweep on every page change, so moving between pages feels
  // acknowledged even when the new page has nothing to wait for.
  useEffect(() => {
    if (pathname === firstPath.current) return;
    firstPath.current = pathname;
    setNavBlip(true);
    const t = setTimeout(() => setNavBlip(false), 420);
    return () => clearTimeout(t);
  }, [pathname]);

  const busy = routing || requests > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (busy) {
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisible(false), 200);
    return () => clearTimeout(t);
  }, [busy]);

  const state = visible ? "loading" : navBlip ? "blip" : "idle";
  return <div className="top-progress" data-state={state} role="progressbar" aria-hidden={state === "idle"} aria-label="Loading" />;
}

export { TopProgress };
