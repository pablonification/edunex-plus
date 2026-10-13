// Quick search (⌘K, Ctrl+K elsewhere): a palette over everything the app has
// saved, so it works offline. Results come grouped by kind (what's pressing
// first), each with its course's color and a type word; the places carry
// their ⌘1–⌘6. With nothing typed: what was opened lately, the next Tasks,
// the courses, the places and the verbs (refresh, theme). Arrows move, Enter
// opens (everything opens inside the app), Escape closes. The index
// (src/core/search.ts) is built when the palette opens.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ComponentType, type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { materialKind } from "../../core/course-materials";
import { takeHomeOnly } from "../../core/exam-sources";
import type { Exam } from "../../core/exams";
import type { DatasetName } from "../../core/models";
import { SCREENS, type ScreenId, type SearchItem, search, searchIndex, suggestions } from "../../core/search";
import { isOpenStatus, taskStatus } from "../../core/tasks";
import { useTermCourses } from "../courses";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useSaved } from "../saved";
import { useBridge, useSettings, useStore } from "../store";
import { cx } from "../ui/cx";
import { Kbd } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { useReturnFocus } from "../ui/overlays";
import { isBuilt } from "./built";
import { refreshNow } from "./source-status";

/** The screens and tabs that are built, in the sidebar's order. */
const BUILT = (Object.keys(SCREENS) as ScreenId[]).filter((screen) => {
  const target = SCREENS[screen].target;
  return target === "settings" || isBuilt(target);
});

/** What the index reads. */
const SEARCHED: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  "six.schedule",
  "edunex.courses",
  "edunex.tasks",
  "edunex.exams",
  "edunex.outline",
  "edunex.materials",
  "edunex.announcements",
  "itb.catalog",
  "itb.calendar",
];

const SCREEN_ICON: Record<ScreenId, ComponentType<IconProps>> = {
  home: Icons.Home,
  tasks: Icons.ListChecks,
  schedule: Icons.Calendar,
  presence: Icons.Hand,
  grades: Icons.GraduationCap,
  plan: Icons.BookOpen,
  "plan.planner": Icons.Route,
  "plan.curriculum": Icons.Layers,
  "plan.krs": Icons.ClipboardCheck,
  "plan.bills": Icons.Wallet,
  "plan.deadlines": Icons.CalendarClock,
  settings: Icons.Settings,
};

const MATERIAL_ICON: Partial<Record<ReturnType<typeof materialKind>, ComponentType<IconProps>>> = {
  vicon: Icons.Video,
  video: Icons.Video,
  note: Icons.StickyNote,
  link: Icons.Link,
};

/** The places of the sidebar, as ⌘1–⌘6 open them. */
const SHORTCUT: Partial<Record<ScreenId, string>> = { home: "1", tasks: "2", schedule: "3", presence: "4", grades: "5", plan: "6" };

/** What the Student opened from the palette lately, newest first (kept on this computer only). */
const RECENT_KEY = "edunex-plus.search.recent";
function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}
function remember(key: string): void {
  if (key.startsWith("action:")) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 8)));
  } catch {
    // Not kept: the palette still works.
  }
}

/** ⌘K on macOS, Ctrl+K elsewhere, from anywhere in the window. */
export function useSearchShortcut(toggle: () => void): void {
  const store = useStore();
  useEffect(() => {
    const mac = store.platform === "darwin";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || event.shiftKey || !(mac ? event.metaKey : event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k" && event.code !== "KeyK") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, toggle]);
}

/** The top bar's way in, with the shortcut on it. */
export function SearchButton({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const mac = useStore().platform === "darwin";
  return (
    <button
      type="button"
      aria-label={t("search.open")}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      onClick={onOpen}
      className="focus-ring flex h-8 w-[208px] items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 text-small text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
    >
      <Icons.Search className="size-3.5" />
      <span className="flex-1 text-left">{t("search.open")}</span>
      <span aria-hidden className="flex gap-0.5">
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

export function SearchPalette({ open, onOpenChange, onSettings }: { open: boolean; onOpenChange: (open: boolean) => void; onSettings: () => void }) {
  const t = useT();
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cx(
            "fixed top-[12vh] left-1/2 z-50 flex w-[min(620px,calc(100vw-48px))] -translate-x-1/2 flex-col overflow-hidden",
            "rounded-2xl bg-raised text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none motion-safe:animate-pop-in dark:ring-white/10",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("search.open")}</DialogPrimitive.Title>
          {open && <Palette onClose={() => onOpenChange(false)} onSettings={onSettings} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Palette({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const { go } = useNav();
  const saved = useSaved(SEARCHED);
  const courses = useTermCourses();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const mac = store.platform === "darwin";
  const [recent] = useState(readRecent);
  const index = useMemo(() => searchIndex(saved, { lang, screens: BUILT, now }), [saved, lang, now]);
  const groups = useMemo(() => (query.trim() ? search(index, query) : suggestions(index, now, recent)), [index, query, now, recent]);
  const items = groups.flatMap((group) => group.items);
  const colors = useMemo(() => new Map((courses ?? []).map((course) => [course.code, course.color])), [courses]);
  const optionId = (at: number) => `${id}-option-${at}`;
  const current = Math.min(active, items.length - 1);
  const dark =
    settings.theme === "dark" || (settings.theme === "system" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
  const nextTheme = dark ? "light" : "dark";

  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: "nearest" });
  });

  const open = (item: SearchItem) => {
    onClose();
    remember(item.key);
    const target = item.target;
    if (target === "settings") onSettings();
    else if ("action" in target) {
      if (target.action === "refresh") void refreshNow(bridge);
      else void bridge.invoke("settings.update", { theme: nextTheme }).catch(() => undefined);
    } else go(target);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!items.length || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(items[current]);
    }
  };

  let at = 0;
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
        <Icons.Search className="size-4 text-muted" />
        {/* No autoFocus: the dialog puts focus here itself, after noting what to return it to. */}
        <input
          value={query}
          role="combobox"
          aria-label={t("search.open")}
          aria-expanded={items.length > 0}
          aria-controls={`${id}-results`}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? optionId(current) : undefined}
          placeholder={t("search.placeholder")}
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
        />
        <Kbd>esc</Kbd>
      </div>
      <div id={`${id}-results`} role="listbox" aria-label={t("search.results")} className="max-h-[min(420px,64vh)] overflow-y-auto p-2">
        {groups.map((group) => (
          // biome-ignore lint/a11y/useSemanticElements: a group of options inside the listbox (the ARIA listbox pattern); a fieldset can't go there
          <div key={group.kind} role="group" aria-labelledby={`${id}-${group.kind}`}>
            <p id={`${id}-${group.kind}`} role="presentation" className="px-3 pt-2.5 pb-1 text-caption font-semibold text-faint">
              {t(`search.group.${group.kind}`)}
            </p>
            {group.items.map((item) => {
              const mine = at++;
              const selected = mine === current;
              const detail =
                item.kind === "action" && item.action === "theme"
                  ? t("search.action.themeTo", { theme: t(`settings.theme.${nextTheme}`) })
                  : detailOf(item, t, f, now);
              const key = item.kind === "screen" ? SHORTCUT[item.screen] : undefined;
              return (
                // biome-ignore lint/a11y/useFocusableInteractive lint/a11y/useKeyWithClickEvents: focus stays in the search field, which moves through the options (aria-activedescendant) and opens one on Enter
                <div
                  key={item.key}
                  id={optionId(mine)}
                  role="option"
                  aria-selected={selected}
                  aria-labelledby={`${optionId(mine)}-title`}
                  aria-describedby={detail ? `${optionId(mine)}-detail` : undefined}
                  onMouseMove={() => mine !== current && setActive(mine)}
                  onClick={() => open(item)}
                  className={cx("flex cursor-default items-center gap-3 rounded-lg px-3 py-2", selected && "bg-selected")}
                >
                  <ItemMark item={item} color={item.code ? colors.get(item.code) : undefined} />
                  <span className="min-w-0 flex-1">
                    <span id={`${optionId(mine)}-title`} className="line-clamp-2 text-body font-medium">
                      {item.title}
                    </span>
                    {detail && (
                      <span id={`${optionId(mine)}-detail`} className="block truncate text-small text-muted">
                        {detail}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {key ? (
                      <span aria-hidden className="flex gap-0.5">
                        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
                        <Kbd>{key}</Kbd>
                      </span>
                    ) : (
                      <span className="text-caption text-faint">{t(`search.type.${item.kind}`)}</span>
                    )}
                    <span aria-hidden className={cx("w-3.5 text-center text-small text-faint", !selected && "invisible")}>
                      ↵
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {query.trim() && !items.length && (
          <div className="px-3 py-8 text-center">
            <p className="text-body font-medium">{t("search.noResults", { query: query.trim() })}</p>
            <p className="mt-1 text-small text-muted">{t("search.noResultsHint", { code: courses?.[0]?.code ?? "PL3002" })}</p>
          </div>
        )}
      </div>
      <div aria-hidden className="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2 text-caption text-faint">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> {t("search.footer.move")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd> {t("search.footer.open")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>esc</Kbd> {t("search.footer.close")}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {query.trim() ? t("search.count", { count: items.length }) : ""}
      </p>
    </>
  );
}

/** The kind's icon, with the course's color in its corner. Color marks the course only; the code says it too. */
function ItemMark({ item, color }: { item: SearchItem; color: string | undefined }) {
  const Icon =
    item.kind === "screen"
      ? SCREEN_ICON[item.screen]
      : item.kind === "material"
        ? (MATERIAL_ICON[materialKind(item.material.type)] ?? Icons.FileText)
        : item.kind === "action"
          ? item.action === "refresh"
            ? Icons.RefreshCw
            : Icons.Moon
          : { course: Icons.BookOpen, task: Icons.ListChecks, exam: Icons.GraduationCap, module: Icons.LayoutGrid, announcement: Icons.Megaphone }[item.kind];
  return (
    <span className="relative grid size-7 shrink-0 place-items-center rounded-md bg-fill">
      <Icon className="size-3.5 text-muted" />
      {color && <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2 rounded-[3px] ring-2 ring-raised" style={{ background: color }} />}
    </span>
  );
}

/** "12–16 Okt" from ITB's first and last day ("2026-10-12"), whatever the computer's time zone. */
/** When an exam is, as its row says it. */
function examWhen(exam: Exam, t: Translate, f: Format): string {
  const session = exam.six[0];
  if (session) return `${f.relativeDay(session.start)}, ${f.timeRange(session.start, session.end)}${session.room ? ` · ${session.room}` : ""}`;
  if (exam.at !== null) return f.dueLabel(exam.at);
  if (exam.week) return t("search.examWeek", { kind: t(`exam.kind.${exam.kind}`), range: f.dayRange(exam.week.firstDay, exam.week.lastDay) });
  return t("search.noDate");
}

/** The row's second line: the course's code, then what this result is and when. */
function detailOf(item: SearchItem, t: Translate, f: Format, now: number): string {
  const parts: (string | null)[] = [item.code];
  switch (item.kind) {
    case "course":
      parts.push(item.classNo && t("search.class", { classNo: item.classNo }), item.sks !== null ? t("search.sks", { sks: item.sks }) : null);
      break;
    case "task": {
      const status = taskStatus(item.task, now);
      // A status only where it says something: not "not started" on every Task to do.
      parts.push(
        status === "not_started" ? null : t(`taskStatus.${status}`),
        isOpenStatus(status) && item.task.dueAt !== null ? t("search.due", { when: f.dueLabel(item.task.dueAt) }) : null,
      );
      break;
    }
    case "exam":
      parts.push(takeHomeOnly(item.exam) ? t("task.uts") : null, examWhen(item.exam, t, f));
      break;
    // The joint class's copy of a module says so, or the two rows read the same.
    case "material":
      if (item.module) parts.push(item.module.parent ? t("course.jointClass") : null, t("course.module", { no: item.module.number }), item.module.title);
      break;
    case "module":
      parts.push(item.module.parent ? t("course.jointClass") : null, t("course.module", { no: item.module.number }));
      break;
    case "announcement":
      parts.push(item.announcement.postedAt !== null ? f.relativeDay(item.announcement.postedAt) : null);
      break;
    case "screen":
      parts.push(item.within);
      break;
  }
  return parts.filter(Boolean).join(" · ");
}
