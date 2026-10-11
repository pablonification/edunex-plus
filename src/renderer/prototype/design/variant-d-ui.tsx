// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": shared building blocks.
// LMS-native mental model: semester → course → modules (EduNex) + meetings (SIX).
import { useSyncExternalStore, type JSX, type ReactNode } from "react";
import type { ClassSession, Course, CourseModule, DesignData, Material, PresenceWindow, Task, TaskStatus } from "./data";
import type { StringKey } from "./i18n";
import { Icons } from "./icons";
import type { Action, AttendanceHealth } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Calm neutral tokens (A's simplicity) with course colors as identity (C's touch). */
export const ui = {
  text: "text-[#1d1d1f] dark:text-[#ececef]",
  muted: "text-[#6e6e73] dark:text-[#a1a1a9]",
  faint: "text-[#9a9aa1] dark:text-[#76767e]",
  card: "rounded-xl border border-[#e9e9ec] bg-white dark:border-[#2a2a2f] dark:bg-[#1c1c1f]",
  line: "border-[#ececef] dark:border-[#26262b]",
  fill: "bg-[#f4f4f6] dark:bg-[#232327]",
  hover: "transition-colors duration-150 hover:bg-[#f3f3f5] dark:hover:bg-[#222226]",
  accentText: "text-[#2f6feb] dark:text-[#7aa2ff]",
  primary:
    "bg-[#2f6feb] text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(16,24,40,0.12)] transition hover:bg-[#2763d8] active:bg-[#2258c4] dark:bg-[#3a77f0] dark:hover:bg-[#4b84f5]",
  secondary:
    "border border-[#e2e2e6] bg-white text-[#1d1d1f] transition hover:bg-[#f6f6f8] dark:border-[#34343a] dark:bg-[#232327] dark:text-[#ececef] dark:hover:bg-[#2a2a2f]",
  focus:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6feb]/55 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#161618]",
};

/** Course color at a given alpha, for soft tints. */
export function tint(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------------------------------------------------------------- status

const STATUS_CHIP: Record<TaskStatus, string> = {
  not_started: "bg-[#f0f0f2] text-[#55555c] dark:bg-[#27272b] dark:text-[#b9b9c1]",
  draft: "bg-[#fdf2d6] text-[#875800] dark:bg-[#382d10] dark:text-[#f2c862]",
  submitted: "bg-[#dcf4e5] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]",
  overdue: "bg-[#fde4e2] text-[#b42318] dark:bg-[#3a1817] dark:text-[#ff9c94]",
  closed: "bg-[#e8e8eb] text-[#3f3f46] dark:bg-[#2a2a2f] dark:text-[#c6c6ce]",
  in_review: "bg-[#ebe7fd] text-[#5a33c8] dark:bg-[#272042] dark:text-[#c4b5ff]",
};

export function statusLabel(t: VariantProps["t"], status: TaskStatus): string {
  return t(`status_${status}` as StringKey);
}

export function StatusGlyph({ status, className = "size-3.5" }: { status: TaskStatus; className?: string }) {
  switch (status) {
    case "submitted":
      return <Icons.CheckCircle className={className} strokeWidth={2} />;
    case "overdue":
      return <Icons.AlertTriangle className={className} strokeWidth={2} />;
    case "closed":
      return <Icons.Lock className={className} strokeWidth={2} />;
    case "in_review":
      return <Icons.Clock className={className} strokeWidth={2} />;
    case "draft":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      );
    default:
      return <Icons.Circle className={className} strokeWidth={2} />;
  }
}

export function StatusChip({ status, t }: { status: TaskStatus; t: VariantProps["t"] }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap",
        STATUS_CHIP[status],
      )}
    >
      <StatusGlyph status={status} className="size-3" />
      {statusLabel(t, status)}
    </span>
  );
}

// ---------------------------------------------------------------- course marks

export function CourseDot({ color, className = "size-2.5" }: { color: string; className?: string }) {
  return <span className={cx("inline-block shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}

export function CourseCode({ course, className }: { course: Course | undefined; className?: string }) {
  if (!course) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-semibold tracking-[0.01em]", className)}>
      <CourseDot color={course.color} className="size-2" />
      {course.code}
    </span>
  );
}

// ---------------------------------------------------------------- layout bits

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
      {aside}
    </div>
  );
}

export function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className={cx("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center", ui.line, ui.faint)}>
      <span className="opacity-80">{icon}</span>
      <p className="text-[13px] font-medium">{title}</p>
    </div>
  );
}

export function Bar({ value, color, className }: { value: number; color: string; className?: string }) {
  return (
    <span className={cx("block h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]", className)}>
      <span
        className="block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </span>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex size-2", className)}>
      <span className="absolute inset-0 rounded-full bg-[#22a35a] opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-[#22a35a]" />
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-black/10 bg-white px-1 text-[10.5px] font-medium text-[#8b8b92] shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#26262a] dark:text-[#8f8f97]">
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------- materials

const PROVIDERS: Record<string, string> = {
  "ms-teams": "Microsoft Teams",
  zoom: "Zoom",
  "google-meet": "Google Meet",
  cloudx: "CloudX",
  webex: "Webex",
};

export function providerName(provider: string | null): string {
  return provider ? PROVIDERS[provider] ?? provider : "";
}

export function MaterialIcon({ kind }: { kind: Material["kind"] }) {
  const box = "grid size-8 shrink-0 place-items-center rounded-lg";
  if (kind === "pdf")
    return (
      <span className={cx(box, "bg-[#fde8e6] text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]")}>
        <Icons.FileText className="size-4" />
      </span>
    );
  if (kind === "meeting")
    return (
      <span className={cx(box, "bg-[#e6eefe] text-[#2f6feb] dark:bg-[#1b2742] dark:text-[#7aa2ff]")}>
        <Icons.Video className="size-4" />
      </span>
    );
  if (kind === "note")
    return (
      <span className={cx(box, "bg-[#fdf3dc] text-[#9a6700] dark:bg-[#352c14] dark:text-[#f2c862]")}>
        <Icons.StickyNote className="size-4" />
      </span>
    );
  return (
    <span className={cx(box, ui.fill, ui.muted)}>
      <Icons.Link className="size-4" />
    </span>
  );
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- derived data

/** SIX writes the term as "1-2026/2027". */
export function termText(tr: VariantProps["tr"], raw: string): string {
  const m = /^(\d)-(\d{4}\/\d{4})$/.exec(raw.trim());
  if (!m) return raw;
  return tr({ en: `Semester ${m[1]}, ${m[2]}`, id: `Semester ${m[1]} ${m[2]}` });
}

/** EduNex notifications that exist at "now", newest first, without the duplicates EduNex sends. */
export function visibleNotices(data: DesignData, now: Date) {
  const seen = new Set<string>();
  return [...data.notices]
    .filter((n) => new Date(n.date) <= now)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((n) => {
      const key = `${n.courseCode}|${n.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** "16 Sep" for one day, "16 – 22 Sep"-style when it spans days. */
export function dateRange(f: VariantProps["f"], start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end || f.dayKey(start) === f.dayKey(end)) return f.dayMonth(start);
  return `${f.dayMonth(start)} – ${f.dayMonth(end)}`;
}

export function courseOf(data: DesignData, code: string): Course | undefined {
  return data.courses.find((c) => c.code === code);
}

export function modulesOf(data: DesignData, code: string): CourseModule[] {
  return data.modules.filter((m) => m.courseCode === code).sort((a, b) => a.index - b.index);
}

export function moduleOf(data: DesignData, id: string | null): CourseModule | undefined {
  return id ? data.modules.find((m) => m.id === id) : undefined;
}

/** "Modul 3" — position within the course outline, 1-based. */
export function moduleNumber(data: DesignData, mod: CourseModule): number {
  return modulesOf(data, mod.courseCode).findIndex((m) => m.id === mod.id) + 1;
}

export function isOpenTask(task: Task): boolean {
  return task.status === "not_started" || task.status === "draft" || task.status === "overdue";
}

export function openTasks(data: DesignData, code?: string): Task[] {
  return data.tasks
    .filter((t) => isOpenTask(t) && (!code || t.courseCode === code))
    .sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
}

export function sessionsOn(data: DesignData, dayOffset: number, f: VariantProps["f"], code?: string): ClassSession[] {
  return data.sessions.filter((s) => f.dayOffset(s.start) === dayOffset && (!code || s.courseCode === code));
}

export function currentSession(data: DesignData, now: Date, code?: string): ClassSession | undefined {
  return data.sessions.find(
    (s) => (!code || s.courseCode === code) && new Date(s.start) <= now && now < new Date(s.end),
  );
}

export function nextSession(data: DesignData, now: Date, code?: string): ClassSession | undefined {
  return data.sessions
    .filter((s) => (!code || s.courseCode === code) && new Date(s.start) > now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function openPresence(data: DesignData, now: Date, code?: string): PresenceWindow | undefined {
  return data.presence.find(
    (p) => (!code || p.courseCode === code) && new Date(p.opensAt) <= now && now < new Date(p.closesAt),
  );
}

/** Fraction of a time window already elapsed. */
export function elapsed(startIso: string, endIso: string, now: Date): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return end > start ? (now.getTime() - start) / (end - start) : 0;
}

// ---------------------------------------------------------------- meetings (SIX + EduNex Presence)

export interface Meeting {
  key: string;
  start: string;
  end: string;
  room: string | null;
  activity: string | null;
  topic: string | null;
  /** "unmarked": the window closed with no EduNex record — many lecturers record attendance in SIX instead. */
  state: "attended" | "unmarked" | "open" | "upcoming" | "recorded_in_six";
  closesAt: string | null;
}

export function meetingsFor(data: DesignData, now: Date, f: VariantProps["f"], code: string): Meeting[] {
  const byDay = new Map<string, Meeting>();
  for (const p of data.presence.filter((x) => x.courseCode === code)) {
    const open = new Date(p.opensAt) <= now && now < new Date(p.closesAt);
    const past = new Date(p.closesAt) <= now;
    byDay.set(f.dayKey(p.classStart), {
      key: `p-${p.id}`,
      start: p.classStart,
      end: p.classEnd,
      room: null,
      activity: null,
      topic: p.topic || null,
      state: p.myStatus === "attended" ? "attended" : open ? "open" : past ? "unmarked" : "upcoming",
      closesAt: p.closesAt,
    });
  }
  for (const s of data.sessions.filter((x) => x.courseCode === code)) {
    const existing = byDay.get(f.dayKey(s.start));
    if (existing) {
      // SIX's timetable is the official time; EduNex keeps its own copy, which can lag.
      existing.start = s.start;
      existing.end = s.end;
      existing.room = s.room;
      existing.activity = s.activity;
    } else {
      byDay.set(f.dayKey(s.start), {
        key: `s-${s.id}`,
        start: s.start,
        end: s.end,
        room: s.room,
        activity: s.activity,
        topic: null,
        state: new Date(s.end) <= now ? "recorded_in_six" : "upcoming",
        closesAt: null,
      });
    }
  }
  return [...byDay.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** Where a course's attendance is taken: EduNex if it has Presence sessions, else SIX. */
export function attendanceSource(data: DesignData, code: string): "EduNex" | "SIX" {
  return data.presence.some((p) => p.courseCode === code) ? "EduNex" : "SIX";
}

// ---------------------------------------------------------------- grades & money

export const GRADE_POINTS: Record<string, number> = { A: 4, AB: 3.5, B: 3, BC: 2.5, C: 2, D: 1, E: 0 };
export const GRADES = ["A", "AB", "B", "BC", "C", "D", "E"] as const;

/** The lowest letter grade whose points reach `ip`, or null when even A is not enough. */
export function gradeForIp(ip: number): string | null {
  for (const g of [...GRADES].reverse()) if (GRADE_POINTS[g] >= ip - 1e-9) return g;
  return null;
}

export function rupiah(amount: number, lang: VariantProps["lang"]): string {
  return new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

// ---------------------------------------------------------------- prototype settings (local only)

export interface DSettings {
  attendanceTarget: number;
  notify: Record<
    "presence" | "attendanceRisk" | "changes" | "exams" | "newTask" | "newMaterial" | "deadline" | "grade" | "bill" | "krs",
    boolean
  >;
  offlineFiles: boolean;
  phoneCalendar: boolean;
  hidden: string[];
}

const SETTINGS_KEY = "edunex-plus-prototype-d-settings";
const DEFAULT_SETTINGS: DSettings = {
  attendanceTarget: 80,
  notify: {
    presence: true,
    attendanceRisk: true,
    changes: true,
    exams: true,
    newTask: true,
    newMaterial: true,
    deadline: true,
    grade: true,
    bill: true,
    krs: true,
  },
  offlineFiles: true,
  phoneCalendar: false,
  hidden: [],
};
let settingsSnapshot: DSettings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return { ...DEFAULT_SETTINGS, ...saved, notify: { ...DEFAULT_SETTINGS.notify, ...saved.notify } };
  } catch {
    return DEFAULT_SETTINGS;
  }
})();
const settingsListeners = new Set<() => void>();

export function useDSettings(): DSettings {
  return useSyncExternalStore(
    (listener) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    () => settingsSnapshot,
  );
}

/** Accepts a patch or an updater, so quick successive changes never overwrite each other. */
export function updateDSettings(patch: Partial<DSettings> | ((current: DSettings) => Partial<DSettings>)) {
  settingsSnapshot = { ...settingsSnapshot, ...(typeof patch === "function" ? patch(settingsSnapshot) : patch) };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsSnapshot));
  for (const listener of settingsListeners) listener();
}

// ---------------------------------------------------------------- sources & actions (the merge, made visible)

const SOURCE_TONE: Record<string, string> = {
  SIX: "bg-[#e3f4f1] text-[#0f766e] dark:bg-[#11302c] dark:text-[#6fd6c6]",
  EduNex: "bg-[#e6eefe] text-[#2f5fc4] dark:bg-[#1b2742] dark:text-[#9ab8ff]",
  ITB: "bg-[#f3ecfd] text-[#6b3fc4] dark:bg-[#271d3a] dark:text-[#c4b0f5]",
};

/** Which official system a fact comes from. Every merged screen shows it. */
export function SourceTag({ source, className }: { source: "SIX" | "EduNex" | "ITB"; className?: string }) {
  return (
    <span className={cx("inline-flex h-[18px] items-center rounded px-1.5 text-[10.5px] font-semibold tracking-[0.01em]", SOURCE_TONE[source], className)}>
      {source === "ITB" ? "Kalender ITB" : source}
    </span>
  );
}

const URGENCY_TILE: Record<Action["urgency"], string> = {
  now: "bg-[#fde7e4] text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]",
  soon: "bg-[#fdf2d6] text-[#8a5300] dark:bg-[#382d10] dark:text-[#f2c862]",
  later: "bg-[#f0f0f2] text-[#55555c] dark:bg-[#27272b] dark:text-[#b9b9c1]",
};

const ACTION_ICON: Record<Action["icon"], (props: { className?: string }) => JSX.Element> = {
  hand: Icons.Hand,
  alert: Icons.AlertTriangle,
  exam: Icons.GraduationCap,
  clash: Icons.Overlap,
  task: Icons.FileText,
  clock: Icons.Clock,
  change: Icons.CalendarClock,
};

export function ActionRow({ action, first, p }: { action: Action; first: boolean; p: VariantProps }) {
  const Icon = ACTION_ICON[action.icon];
  const course = action.courseCode ? courseOf(p.data, action.courseCode) : undefined;
  const run = (target: Action["primary"]) => {
    if (target?.go) p.go(target.go.screen, { task: target.go.task, course: target.go.course });
  };
  return (
    <li className={cx("flex items-start gap-3.5 px-4 py-3.5", !first && "border-t", ui.line)}>
      <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", URGENCY_TILE[action.urgency])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] leading-snug font-semibold">
          {action.urgency === "now" && action.icon === "hand" && <LiveDot />}
          <span className="min-w-0">{action.title}</span>
        </p>
        <p className={cx("mt-1 text-[13px] leading-[1.5]", ui.muted)}>{action.detail}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          {course && (
            <span className={cx("mr-1 inline-flex items-center gap-1.5 text-[11.5px] font-semibold", ui.muted)}>
              <CourseDot color={course.color} className="size-2" />
              {course.code}
            </span>
          )}
          {action.sources.map((s) => (
            <SourceTag key={s} source={s} />
          ))}
          {action.when && <span className={cx("ml-1 text-[11.5px] tabular-nums", ui.faint)}>{action.when}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {action.primary && (
          <button
            onClick={() => run(action.primary)}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold whitespace-nowrap",
              action.urgency === "now" ? ui.primary : ui.secondary,
              ui.focus,
            )}
          >
            {action.primary.label}
            {action.primary.external && <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />}
          </button>
        )}
        {action.secondary && (
          <button
            onClick={() => run(action.secondary)}
            className={cx("inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium whitespace-nowrap", ui.muted, ui.hover, ui.focus)}
          >
            {action.secondary.label}
            {action.secondary.external && <Icons.ArrowUpRight className="size-3" />}
          </button>
        )}
      </div>
    </li>
  );
}

/** "2 more absences allowed" / "No more absences" / "Out of reach", from SIX's exact count. */
export function budgetText(tr: VariantProps["tr"], h: AttendanceHealth, targetPct: number): { label: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (h.state === "unknown" || h.canMiss === null) return { label: tr({ en: "No count yet", id: "Belum ada data" }), tone: "none" };
  if (h.state === "out")
    return {
      label: tr({ en: `${targetPct}% out of reach · best ${Math.round((h.best ?? 0) * 100)}%`, id: `${targetPct}% tak tercapai · maks. ${Math.round((h.best ?? 0) * 100)}%` }),
      tone: "bad",
    };
  if (h.state === "last") return { label: tr({ en: "No more absences", id: "Tidak boleh absen lagi" }), tone: "warn" };
  return {
    label: tr({ en: `${h.canMiss} more absence${h.canMiss > 1 ? "s" : ""} allowed`, id: `Boleh absen ${h.canMiss}x lagi` }),
    tone: "ok",
  };
}

export const BUDGET_TONE = {
  ok: "text-[#178a4a] dark:text-[#6fdc9c]",
  warn: "text-[#9a5b00] dark:text-[#f5c46a]",
  bad: "text-[#c4321f] dark:text-[#ff9c8f]",
  none: "text-[#9a9aa1] dark:text-[#76767e]",
};
