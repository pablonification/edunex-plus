// The bell in the top bar and the alert history under it: every alert the
// engine raised, newest first by day, each opening its screen. Opening the
// history marks it read in the app only; nothing is marked in EduNex.
import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import type { AlertKind } from "../../core/models";
import { useFormat, useT } from "../i18n";
import { useNav } from "../nav";
import { useBridge, useDataset } from "../store";
import { IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { SourceTag } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";

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

export function AlertsBell() {
  const t = useT();
  const bridge = useBridge();
  const history = useDataset("app.alerts");
  const [open, setOpen] = useState(false);
  /** What counted as read when the panel opened, so new items stay marked while it's open. */
  const [readAt, setReadAt] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const items = history?.items ?? [];
  const unread = items.filter((item) => item.at > (history?.readAt ?? 0)).length;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) bell.current?.focus();
  }, []);
  const toggle = () => {
    if (open) return close(false);
    setReadAt(history?.readAt ?? 0);
    setOpen(true);
    if (unread > 0) void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, close]);

  const label = unread > 0 ? t("alerts.open", { count: unread }) : t("alerts.title");
  return (
    <div ref={wrapper} className="relative">
      <IconButton ref={bell} label={label} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle} className="relative">
        <Icons.Bell className="size-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-on-accent tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </IconButton>
      {open && <AlertsPanel id={panelId} readAt={readAt} onClose={close} />}
    </div>
  );
}

function AlertsPanel({ id, readAt, onClose }: { id: string; readAt: number; onClose: (refocus: boolean) => void }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const items = useDataset("app.alerts")?.items ?? [];
  const list = useRef<HTMLDivElement>(null);
  const days = [...new Set(items.map((item) => f.relativeDay(item.at)))];

  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return onClose(true);
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      id={id}
      role="region"
      aria-label={t("alerts.title")}
      onKeyDown={onKeyDown}
      className="absolute top-full right-0 z-50 mt-2 w-[400px] overflow-hidden rounded-2xl bg-raised text-fg shadow-pop ring-1 ring-black/10 motion-safe:animate-pop-in dark:ring-white/10"
    >
      <p className="border-b border-line px-4 py-3 text-body font-semibold">{t("alerts.title")}</p>
      <div ref={list} className="max-h-[480px] overflow-y-auto py-1.5">
        {items.length === 0 && <p className="px-4 py-8 text-center text-small text-muted">{t("alerts.empty")}</p>}
        {days.map((day) => (
          <section key={day} aria-label={day}>
            <p className="px-4 pt-3 pb-1 text-caption font-semibold text-faint">{day}</p>
            {items
              .filter((item) => f.relativeDay(item.at) === day)
              .map((item) => {
                const Icon = KIND_ICON[item.kind];
                const unread = item.at > readAt;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      go(item.target);
                      onClose(false);
                    }}
                    className="focus-ring flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
                  >
                    <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", PRESSING.has(item.kind) ? "bg-warning-bg text-warning-fg" : "bg-fill text-muted")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-small", unread ? "font-semibold" : "font-medium")}>{t(item.title.key, item.title.vars)}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
                        <SourceTag source={item.source} />
                        <span className="truncate">{item.body ? t(item.body.key, item.body.vars) : null}</span>
                        <span className="ml-auto shrink-0 tabular-nums">{f.time(item.at)}</span>
                      </span>
                    </span>
                    {unread && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                );
              })}
          </section>
        ))}
      </div>
    </div>
  );
}
