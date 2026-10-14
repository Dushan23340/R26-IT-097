import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Award, Bell, BookOpenCheck, CheckCheck, ClipboardList, Inbox, Megaphone, PartyPopper, ShieldCheck, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/lib/notifications";
import { useT } from "@/lib/i18n";

const KIND_ICON = {
  welcome: PartyPopper,
  security: ShieldCheck,
  quiz_unlocked: BookOpenCheck,
  recommendation: Sparkles,
  badge: Award,
  message: Megaphone,
  survey: ClipboardList,
  system: Bell,
};
const KIND_TONE = {
  welcome: "var(--teal)",
  security: "var(--emotion-confused)",
  quiz_unlocked: "var(--emotion-happy)",
  recommendation: "var(--teal-glow)",
  badge: "var(--amber)",
  message: "var(--teal)",
  survey: "var(--chart-5)",
  system: "var(--muted-foreground)",
};

function when(iso) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function NotificationItem({ n, onOpen, compact = false, onDelete }) {
  const t = useT();
  const Icon = KIND_ICON[n.kind] || Bell;
  const tone = KIND_TONE[n.kind] || "var(--teal)";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(n)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(n)}
      className={`group relative flex gap-3 rounded-xl p-3 text-left transition-colors cursor-pointer hover:bg-white/5 ${n.read ? "" : "bg-primary/[0.06]"}`}
    >
      <span className="h-9 w-9 shrink-0 rounded-xl grid place-items-center" style={{ background: `color-mix(in oklab, ${tone} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${tone} 40%, transparent)` }}>
        <Icon className="h-4 w-4" style={{ color: tone }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${n.read ? "text-foreground/85" : "font-semibold"}`}>{n.title}</span>
        {n.body && <span className={`block mt-0.5 text-xs text-muted-foreground ${compact ? "line-clamp-2" : ""}`}>{n.body}</span>}
        <span className="block mt-1 text-[11px] text-muted-foreground/80">{when(n.createdAt)}</span>
      </span>
      {!n.read && <span className="absolute right-3 top-3.5 h-2 w-2 rounded-full bg-primary" aria-label={t("Unread")} />}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(n.id);
          }}
          className="self-center opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg transition-opacity"
        >
          {t("Remove")}
        </button>
      )}
    </div>
  );
}

function useOpenNotification() {
  const router = useRouter();
  const { markRead } = useNotifications();
  return (n, after) => {
    if (!n.read) markRead([n.id]);
    after?.();
    if (n.link) router.navigate({ href: n.link });
  };
}

function NotificationBell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { items, unread, loaded, markRead } = useNotifications();
  const openNotification = useOpenNotification();
  const latest = items.slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? t("Notifications ({n} unread)", { n: unread }) : t("Notifications")}
          title={t("Notifications")}
          className="relative h-10 w-10 grid place-items-center rounded-full text-muted-foreground border border-transparent hover:text-foreground hover:border-border hover:bg-white/5 transition-colors"
        >
          <Bell className={`h-[18px] w-[18px] ${unread ? "bell-ring" : ""}`} />
          {unread > 0 && (
            <span key={unread} className="animate-pop-in absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[10px] font-bold text-primary-foreground tnum" style={{ background: "var(--gradient-accent)" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="glass-strong w-[min(380px,calc(100vw-24px))] rounded-2xl p-0 overflow-hidden border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <p className="font-semibold text-sm">{t("Notifications")}</p>
          {unread > 0 && (
            <button type="button" onClick={() => markRead()} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> {t("Mark all as read")}
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {!loaded ? (
            <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)}</div>
          ) : latest.length === 0 ? (
            <div className="py-10 text-center">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">{t("You're all caught up.")}</p>
            </div>
          ) : (
            latest.map((n) => <NotificationItem key={n.id} n={n} compact onOpen={(x) => openNotification(x, () => setOpen(false))} />)
          )}
        </div>
        <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-border/60 px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-white/5">
          {t("See all notifications")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export { NotificationBell, NotificationItem, useOpenNotification };
