import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { platformApi } from "@/lib/platformApi";

// The signed-in user's inbox (account service, core.notifications), shared
// by the header bell and the /notifications page. Polled every 30 s in the
// background; a notification that arrives while the app is open also
// shows as a toast.
const POLL_MS = 30000;
const NotificationsContext = createContext(null);

function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const knownIds = useRef(null);

  const refresh = useCallback(
    async ({ background = true } = {}) => {
      if (!user) return;
      try {
        const res = await platformApi.notifications(50, { background });
        const list = res.notifications || [];
        // Toast only for notifications that are new since the last poll
        // (not on the first load, which would replay the whole inbox).
        if (knownIds.current) {
          for (const n of list) {
            if (!n.read && !knownIds.current.has(n.id) && n.kind !== "badge") {
              toast.info(n.title, { description: n.body || undefined, id: `notification-${n.id}` });
            }
          }
        }
        knownIds.current = new Set(list.map((n) => n.id));
        setItems(list);
        setUnread(res.unread || 0);
      } catch {
        // quiet: the bell keeps its last known state
      } finally {
        setLoaded(true);
      }
    },
    [user]
  );

  useEffect(() => {
    knownIds.current = null;
    setItems([]);
    setUnread(0);
    setLoaded(false);
    if (!user) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id, refresh]);

  const markRead = useCallback(async (ids) => {
    // Optimistic: the badge count drops at once.
    setItems((list) => list.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    try {
      await platformApi.markRead(ids);
    } catch {
      refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    setItems((list) => list.filter((n) => n.id !== id));
    try {
      await platformApi.deleteNotification(id);
    } finally {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(() => ({ items, unread, loaded, refresh, markRead, remove }), [items, unread, loaded, refresh, markRead, remove]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

function useNotifications() {
  return useContext(NotificationsContext) || { items: [], unread: 0, loaded: true, refresh: () => {}, markRead: () => {}, remove: () => {} };
}

export { NotificationsProvider, useNotifications };
