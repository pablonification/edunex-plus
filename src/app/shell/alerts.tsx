// The bell in the top bar: the single history of everything the app noticed.
// Every alert the engine raised (reminders too) joined with the changes it
// can see in the data itself (src/core/needs.ts alertFeed), so Beranda's
// "Yang berubah" is always a preview of this list. Grouped Hari ini /
// Kemarin / Minggu ini / Sebelumnya; each row opens its screen. Opening it
// clears the badge; the dots stay until "Tandai semua dibaca". Nothing is
// ever marked in Edunex.
import { type ComponentType, useMemo, useState, useSyncExternalStore } from "react";
import type { Alert, AlertKind } from "../../core/models";
import { alertFeed } from "../../core/needs";
import { useTermCourses } from "../courses";
import { useHomeWorld } from "../home-world";
import { type Format, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useBridge, useDataset, useStatus, useStore } from "../store";
import { IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseDot } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { Meta } from "../ui/layout";
import { Popover } from "../ui/overlays";

const KIND_ICON: Record<AlertKind, ComponentType<IconProps>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  deadline: Icons.Clock,
  presenceOpen: Icons.Hand,
  taskEdited: Icons.PenLine,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.Megaphone,
  attendanceRisk: Icons.AlertTriangle,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
  bill: Icons.Wallet,
  academic: Icons.CalendarClock,
};

/** Kinds that are about time running out. */
const PRESSING = new Set<AlertKind>(["deadline", "presenceOpen", "attendanceRisk"]);

// The bell opens from elsewhere too (Beranda's "Lihat semua").
let wantOpen = 0;
const openListeners = new Set<() => void>();
/** Opens the bell's history, as if the bell was clicked. */
export function openAlerts(): void {
  wantOpen++;
  for (const listener of openListeners) listener();
}
const useOpenRequests = () =>
  useSyncExternalStore(
    (listener) => {
      openListeners.add(listener);
      return () => openListeners.delete(listener);
    },
    () => wantOpen,
  );

export function AlertsBell() {
  const t = useT();
  const bridge = useBridge();
  const history = useDataset("app.alerts");
  const [open, setOpen] = useState(false);
  /** What counted as read when the panel opened, so new items stay marked while it's open. */
  const [readAt, setReadAt] = useState(0);
  const items = history?.items ?? [];
  const unread = items.filter((item) => item.at > (history?.readAt ?? 0)).length;

  const change = (next: boolean) => {
    if (next && !open) {
      setReadAt(history?.readAt ?? 0);
      if (unread > 0) void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
    }
    setOpen(next);
  };

  // "Lihat semua" on Beranda.
  const requests = useOpenRequests();
  const [seen, setSeen] = useState(requests);
  if (requests !== seen) {
    setSeen(requests);
    if (!open) change(true);
  }

  const label = unread > 0 ? t("alerts.open", { count: unread }) : t("alerts.title");
  return (
    <Popover
      open={open}
      onOpenChange={change}
      label={t("alerts.title")}
      className="flex max-h-[min(560px,70vh)] w-[400px] flex-col overflow-hidden"
      trigger={
        <IconButton label={label} className="relative">
          <Icons.Bell className="size-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-micro leading-none font-semibold text-on-accent tabular-nums"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </IconButton>
      }
    >
      {open && <AlertsPanel readAt={readAt} onRead={setReadAt} onClose={() => setOpen(false)} />}
    </Popover>
  );
}

type Period = "today" | "yesterday" | "week" | "earlier";
const PERIODS: Period[] = ["today", "yesterday", "week", "earlier"];
const periodOf = (f: Format, at: number): Period => {
  const ago = -f.dayOffset(at);
  return ago <= 0 ? "today" : ago === 1 ? "yesterday" : ago < 7 ? "week" : "earlier";
};

function AlertsPanel({ readAt, onRead, onClose }: { readAt: number; onRead: (at: number) => void; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const store = useStore();
  const bridge = useBridge();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  // Signed out of SIX, nothing here came from SIX: the footnote doesn't say it did.
  const sixOut = useStatus("six").state === "signed-out";
  const world = useHomeWorld();
  const courses = useTermCourses();
  const colors = useMemo(() => new Map((courses ?? []).map((course) => [course.code, course.color])), [courses]);
  const items = useMemo(() => (world ? alertFeed(world, history?.items ?? []) : (history?.items ?? [])), [world, history]);
  /** Raised while the Student wasn't looking. What the data shows by itself was there before: never "new". */
  const raised = useMemo(() => new Set((history?.items ?? []).map((item) => item.id)), [history]);
  const isUnread = (item: Alert) => raised.has(item.id) && item.at > readAt;
  const anyUnread = items.some(isUnread);
  const groups = PERIODS.map((period) => ({ period, items: items.filter((item) => periodOf(f, item.at) === period) })).filter((group) => group.items.length);

  const settings = () => {
    onClose();
    // The same way the menu's Settings… opens it.
    store.apply({ type: "command", command: "settings" });
  };

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="text-body font-semibold">{t("alerts.title")}</p>
        {anyUnread && (
          <button
            type="button"
            onClick={() => {
              onRead(now);
              void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
            }}
            className="focus-ring rounded px-1 text-small font-medium text-accent-fg hover:underline"
          >
            {t("alerts.markAllRead")}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {items.length === 0 && (
          <div className="px-6 py-9 text-center">
            <span className="mx-auto grid size-9 place-items-center rounded-full bg-fill text-muted">
              <Icons.Bell className="size-4" />
            </span>
            <p className="mt-3 text-body font-semibold">{t("alerts.empty")}</p>
            <p className="mx-auto mt-1 max-w-[36ch] text-small text-muted">{t(sixOut ? "alerts.emptyHintEdunex" : "alerts.emptyHint")}</p>
          </div>
        )}
        {groups.map(({ period, items: group }) => (
          <section key={period} aria-label={t(`alerts.period.${period}`)}>
            <p className="px-4 pt-3 pb-1 text-caption font-semibold text-faint">{t(`alerts.period.${period}`)}</p>
            <ul>
              {group.map((item) => {
                const Icon = KIND_ICON[item.kind];
                const unread = isUnread(item);
                const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
                const color = code ? colors.get(code) : undefined;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        go(item.target);
                      }}
                      className="focus-ring flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
                    >
                      <span className={cx("relative mt-0.5 shrink-0", PRESSING.has(item.kind) ? "text-warning-fg" : "text-faint")}>
                        <Icon className="size-4" />
                        {color && <CourseDot color={color} className="absolute -right-1 -bottom-1 size-2 ring-2 ring-raised" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Meta className={cx("text-small", unread ? "font-semibold" : "font-medium")}>{t(item.title.key, item.title.vars)}</Meta>
                        {item.body && <Meta className="mt-0.5 text-caption text-muted">{t(item.body.key, item.body.vars)}</Meta>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="text-caption text-faint tabular-nums">
                          {period === "today" || period === "yesterday" ? f.time(item.at) : `${f.weekdayShort(item.at)} ${f.dayMonth(item.at)}`}
                        </span>
                        <span aria-hidden className={cx("size-2 rounded-full", unread ? "bg-accent" : "bg-transparent")} />
                        {unread && <span className="sr-only">{t("alerts.unread")}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-caption text-muted">
        <Meta>{t(sixOut ? "alerts.footnoteEdunex" : "alerts.footnote")}</Meta>
        <button type="button" onClick={settings} className="focus-ring inline-flex items-center gap-1 rounded font-medium text-accent-fg hover:underline">
          <Icons.Settings className="size-3.5" />
          {t("alerts.settings")}
        </button>
      </div>
    </>
  );
}
