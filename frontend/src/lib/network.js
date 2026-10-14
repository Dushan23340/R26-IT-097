import { toast } from "sonner";

// Shared fetch for the four API helpers (account, adaptive learning,
// emotion, analytics). It adds two things every page gets for free:
//  - a count of requests in flight, which drives the thin loading bar at the
//    top of the screen (components/TopProgress.jsx), and
//  - one clear toast when a service cannot be reached at all, instead of each
//    card on the page failing silently.
// Response handling stays in each helper; this only wraps fetch().

let inFlight = 0;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(inFlight);
}

export function subscribeInFlight(fn) {
  listeners.add(fn);
  fn(inFlight);
  return () => listeners.delete(fn);
}

// Pages that poll in the background (live class status, emotion feed) pass
// { background: true } so the loading bar only reflects what the user did.
export async function trackedFetch(service, url, config = {}, { background = false } = {}) {
  if (!background) {
    inFlight += 1;
    emit();
  }
  try {
    return await fetch(url, config);
  } catch (err) {
    // fetch() only rejects when no response arrived: the service is down,
    // the URL is wrong, or the device is offline. HTTP errors resolve.
    if (err?.name !== "AbortError") reportUnreachable(service);
    const friendly = new Error(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "You are offline. Check your internet connection and try again."
        : `Can't reach the ${service}. Please try again in a moment.`
    );
    friendly.cause = err;
    friendly.unreachable = true;
    throw friendly;
  } finally {
    if (!background) {
      inFlight -= 1;
      emit();
    }
  }
}

// One toast per service, refreshed rather than stacked when several cards on
// the same page fail together.
const lastReported = new Map();
function reportUnreachable(service) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return; // the offline toast covers it
  const now = Date.now();
  if (now - (lastReported.get(service) || 0) < 15000) return;
  lastReported.set(service, now);
  toast.error(`Can't reach the ${service}`, {
    id: `unreachable-${service}`,
    description: "Some parts of this page may be empty. Check that the service is running, then refresh.",
  });
}
