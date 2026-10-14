import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { NotificationItem, useOpenNotification } from "@/components/NotificationBell";
import { SkeletonRows } from "@/components/LoadingSkeleton";
import { useNotifications } from "@/lib/notifications";
import { useT } from "@/lib/i18n";

const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — AdaptiveMind" }] }),
  component: NotificationsPage,
});

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["learning", "Learning"],
  ["account", "Account"],
];
const LEARNING = ["quiz_unlocked", "recommendation", "badge", "message"];

function NotificationsPage() {
  const t = useT();
  const { items, unread, loaded, markRead, remove } = useNotifications();
  const openNotification = useOpenNotification();
  const [filter, setFilter] = useState("all");
  const shown = items.filter((n) =>
    filter === "unread" ? !n.read : filter === "learning" ? LEARNING.includes(n.kind) : filter === "account" ? !LEARNING.includes(n.kind) : true
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass rounded-3xl p-6 sm:p-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" /> {t("Inbox")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{t("Notifications")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread ? t("{n} unread", { n: unread }) : t("You're all caught up.")}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markRead()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary/60 hover:bg-white/5"
          >
            <CheckCheck className="h-4 w-4" /> {t("Mark all as read")}
          </button>
        )}
      </div>

      <div role="tablist" aria-label={t("Filter")} className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === key ? "text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
            style={filter === key ? { background: "var(--gradient-primary)" } : undefined}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-2">
        {!loaded ? (
          <div className="p-3">
            <SkeletonRows rows={4} />
          </div>
        ) : shown.length === 0 ? (
          <div className="py-14 text-center">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="mt-3 text-sm text-muted-foreground">{t("Nothing here yet.")}</p>
          </div>
        ) : (
          <div className="cascade divide-y divide-border/40">
            {shown.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={(x) => openNotification(x)} onDelete={remove} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { Route };
