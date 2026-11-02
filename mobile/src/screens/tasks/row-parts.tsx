// What the rows of Tugas & Ujian share (rows.tsx, exam-rows.tsx): what every row reads, read once
// per list (`TaskRowWorld`), the banner a list says its rows' problems in, and the small pieces a row
// is drawn from (the meta line, the date column, the quiet note, the exam's title).
//
// Every row reads the same few things (the clock, the courses, Presensi, what's marked done), so a
// list reads them once for all its rows: read per row, they cost Tugas 100–400 ms each time the
// minute or the data changed. A row on its own (a course's page) reads them itself.
import { type ComponentType, createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { type TermCourse, useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import type { CountedIn } from "../../../../src/core/attendance";
import type { DatasetValue, DoneEntry, TaskModule } from "../../../../src/core/models";
import { moduleName } from "../../../../src/core/tasks";
import { toast } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { CourseDot, Tag } from "../../ui/display";
import { CountUp, WavyProgress } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel, Notice, TrailingInline } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text, type TextTone, useTextWidth } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph, CourseTile, useCourseTile } from "../../ui/tile";

const DAY = 86_400_000;

// ------------------------------------------------------------ what every row reads, once per list

type Presence = DatasetValue<"edunex.presence"> | undefined;
type Edits = DatasetValue<"edunex.taskEdits"> | undefined;

export interface RowWorldValue {
  now: number;
  f: Format;
  courses: readonly TermCourse[] | undefined;
  colorOf: (code: string | null | undefined) => string | undefined;
  presence: Presence;
  handled: readonly DoneEntry[];
  edits: Edits;
  countedIn: (code: string) => CountedIn | undefined;
}

const RowWorld = createContext<RowWorldValue | null>(null);

/** Reads what the rows under it share, once. Tugas wraps its list in it; a row outside one reads its own. */
export function TaskRowWorld({ children }: { children: ReactNode }) {
  const now = useNow();
  const f = useFormat();
  const courses = useTermCourses();
  const colorOf = useCourseColor();
  const presence = useDataset("edunex.presence");
  const { entries: handled } = useDone();
  const edits = useDataset("edunex.taskEdits");
  const attendance = useAttendance();
  const value = useMemo<RowWorldValue>(() => {
    const counted = new Map((attendance?.courses ?? []).map((entry) => [entry.course.code, entry.health.countedIn] as const));
    return { now, f, courses, colorOf, presence, handled, edits, countedIn: (code) => counted.get(code) };
  }, [now, f, courses, colorOf, presence, handled, edits, attendance]);
  return <RowWorld.Provider value={value}>{children}</RowWorld.Provider>;
}

export function useRowWorld(): RowWorldValue {
  const world = useContext(RowWorld);
  if (!world) throw new Error("A Task row outside TaskRowWorld");
  return world;
}

/** A row that works on its own too: inside a list's world it uses it, else it brings its own. */
export function inWorld<P extends object>(View: ComponentType<P>): ComponentType<P> {
  function Own(props: P) {
    const world = useContext(RowWorld);
    return world ? <View {...props} /> : <TaskRowWorld>{<View {...props} />}</TaskRowWorld>;
  }
  Own.displayName = `inWorld(${View.displayName ?? View.name})`;
  return Own;
}

// ------------------------------------------------------------ a problem said where the list is

// What went wrong with a row's action (Tandai selesai, Ingatkan sekarang): said in a banner over the list it happened in,
// never in a snackbar that's gone before it's read. A row whose list shows no banner (a course's page) falls back to the
// snackbar.
let problem: string | null = null;
let banners = 0;
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};

export function reportRowProblem(text: string): void {
  if (banners === 0) {
    toast(text, "danger");
    return;
  }
  problem = text;
  tell();
}

/** The banner a list shows its rows' problems in, with the way to put it away. */
export function RowProblemBanner() {
  const t = useT();
  const text = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      banners += 1;
      return () => {
        listeners.delete(listener);
        banners -= 1;
      };
    },
    () => problem,
  );
  if (!text) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ marginBottom: space[4] }}>
      <Notice
        tone="danger"
        title={text}
        testID="banner.rowProblem"
        action={
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              problem = null;
              tell();
            }}
            testID="action.dismissProblem"
          >
            {t("action.close")}
          </Button>
        }
      />
    </View>
  );
}

// ------------------------------------------------------------ pieces

export function moduleLabel(t: Translate, module: TaskModule | null): string | null {
  if (!module) return null;
  return factsLabel(t("task.module", { n: module.index }), moduleName(module));
}

export function formatScore(score: number, f: Format): string {
  return Number.isInteger(score) ? String(score) : f.number(score, 2).replace(/[.,]?0+$/, "");
}

/** "● DK4073": a course's code with its dot. */
export function CourseCodeMark({ code }: { code: string }) {
  const color = useCourseColor()(code);
  return <CodeMark code={code} color={color} />;
}

function CodeMark({ code, color }: { code: string; color: string | undefined }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <CourseDot color={color} size={8} />
      <Text size="bodyMedium" weight="medium" tone="fg" tabular>
        {code}
      </Text>
    </View>
  );
}

/**
 * A row's one meta line: the course's dot and code, then what else matters (the module, where an exam is), cut to
 * one line. On a course's page the code goes without saying.
 */
export function RowMeta({ code, color, rest }: { code?: string | null; color?: string; rest: readonly (string | null | undefined | false)[] }) {
  const text = rest.filter((part): part is string => !!part && part.trim() !== "").join("  ·  ");
  if (!code && !text) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minWidth: 0 }}>
      {code ? <CodeMark code={code} color={color} /> : null}
      {text ? (
        <Text size="bodyMedium" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
          {code ? `  ·  ${text}` : text}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The right-hand column: the day over the time ("Jum, 16 Okt" / "23:59"), in the row's tone. Late is the error colour
 * and a warning sign, never the colour alone.
 */
export function DateColumn({ main, sub, tone, late = false }: { main: string; sub?: string | null; tone?: TextTone; late?: boolean }) {
  const theme = useTheme();
  const width = useTextWidth(96);
  // Under the row's text (a narrow screen): the day and the time on one line, wrapping if they must.
  const inline = useContext(TrailingInline);
  const sign = late && <Icons.AlertTriangle size={14} color={theme.color.error} weight="bold" />;
  if (inline)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
        {sign}
        <Text size="bodyMedium" weight="medium" tone={tone ?? "fg"} tabular style={{ flexShrink: 1 }}>
          {sub ? `${main} · ${sub}` : main}
        </Text>
      </View>
    );
  return (
    <View style={{ alignItems: "flex-end", minWidth: Math.min(width, 120) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {sign}
        <Text size="bodyMedium" weight="medium" tone={tone ?? "fg"} tabular numberOfLines={1}>
          {main}
        </Text>
      </View>
      {sub ? (
        <Text size="bodyMedium" tone={tone ?? "muted"} tabular numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export interface DueWhen {
  main: string;
  sub: string | null;
  tone?: TextTone;
  late: boolean;
  /** How long until it ("dalam 8 hari"): in the row's name, on the Task's page. */
  rel: string | null;
}

/** A deadline as a row says it: its day ("Hari ini", "Jum, 16 Okt") over its time; amber within a day, the error colour once late. */
export function dueWhen(f: Format, now: number, at: number, late: boolean, under?: string): DueWhen {
  const soon = !late && at > now && at - now < DAY;
  if (under !== undefined) return { main: f.dueLabel(at), sub: under, tone: late ? "danger" : undefined, late, rel: null };
  return { main: f.relativeDay(at), sub: f.time(at), tone: late ? "danger" : soon ? "warning" : undefined, late, rel: f.fromNow(at) };
}

/** The same, from the clock and format of the screen (a row outside a list's world). */
export function useDueWhen(): (at: number, late: boolean, under?: string) => DueWhen {
  const f = useFormat();
  const now = useNow();
  return (at, late, under) => dueWhen(f, now, at, late, under);
}

export type SignalIcon = "check" | "pen" | "hand" | "zap" | "alert" | null;

/** A quiet line under a row's meta: an icon and a few words (the signal, "masih diterima", a problem). */
export function RowNote({ icon, tone = "muted", children }: { icon?: SignalIcon | ReactNode; tone?: TextTone; children: string }) {
  const theme = useTheme();
  const c = theme.color;
  const color = tone === "warning" ? c.warningFg : tone === "danger" ? c.error : c.onSurfaceVariant;
  const glyph =
    icon === "check" ? (
      <Icons.Check size={14} weight="bold" color={color} />
    ) : icon === "pen" ? (
      <Icons.PenLine size={14} color={color} />
    ) : icon === "hand" ? (
      <Icons.Hand size={14} color={color} />
    ) : icon === "zap" ? (
      <Icons.Zap size={14} color={color} />
    ) : icon === "alert" ? (
      <Icons.AlertTriangle size={14} weight="bold" color={color} />
    ) : (
      (icon ?? null)
    );
  return (
    // The icon level with the first line (20 high) when the line wraps.
    <View style={{ marginTop: space[1], flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
      {glyph && <View style={{ paddingTop: 3 }}>{glyph}</View>}
      <Text size="bodyMedium" tone={tone} weight={tone === "warning" || tone === "danger" ? "medium" : "regular"} numberOfLines={2} style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** "UTS Komunikasi Pemasaran": the kind's tag, then the course. */
export function ExamTitle({ kind, name }: { kind: string; name: string }) {
  return (
    // The tag level with the name's first line (24 high).
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ marginTop: 3 }}>
        <Tag tone="info">{kind}</Tag>
      </View>
      <Text size="bodyLarge" numberOfLines={2} style={{ flexShrink: 1 }}>
        {name}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------ v4 (round 2's look): a row, its one status, the big card

const HOUR = 3_600_000;
const MINUTE = 60_000;

export type PillTone = "neutral" | "amber" | "red" | "ok";

/** How far off `at` is, as the one status a row shows: "8 hari", "5 jam", "40 mnt"; "lewat 2 hari" once past (red). */
export function countdown(t: Translate, now: number, at: number): { value: number; unit: string; late: boolean; tone: PillTone; text: string } {
  const gap = Math.abs(at - now);
  const late = at < now;
  const [value, key] =
    gap < HOUR
      ? [Math.max(1, Math.floor(gap / MINUTE)), "mobile.home.unit.minute" as const]
      : gap < DAY
        ? [Math.floor(gap / HOUR), "mobile.home.unit.hour" as const]
        : [Math.floor(gap / DAY), "mobile.home.unit.day" as const];
  const unit = t(key, { count: value });
  const tone: PillTone = late ? "red" : gap < DAY ? "amber" : "neutral";
  return { value, unit, late, tone, text: late ? `${t("mobile.home.late")} ${value} ${unit}` : `${value} ${unit}` };
}

/**
 * When, as a row's meta line says it: "Kam 15 Okt, 11:00", "Hari ini, 23:59"; "Kam 15 Okt" alone (`time` false) beside
 * a wide status ("lewat 12 hari", "Waktu berubah"). Short enough that the kind or code and this fit one line on a
 * 412 dp phone; the row's spoken name and its page keep the desktop's full date and range.
 */
export function rowWhen(f: Format, at: number, time = true): string {
  const day = Math.abs(f.dayOffset(at)) <= 1 ? f.relativeDay(at) : `${f.weekdayShort(at)} ${f.dayMonth(at)}`;
  return time ? `${day}, ${f.time(at)}` : day;
}

/** A row's one status: a pill in its tone, with a sign when it's red (never the colour alone). */
export function StatusPill({ tone, text, icon }: { tone: PillTone; text: string; icon?: ReactNode }) {
  const v = useTheme().v4;
  const [bg, fg] = tone === "red" ? [v.redBg, v.redFg] : tone === "amber" ? [v.ambBg, v.ambFg] : tone === "ok" ? [v.okBg, v.okFg] : [v.page, v.fg2];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: bg }}>
      {icon ?? (tone === "red" ? <Icons.AlertTriangle size={13} weight="bold" color={fg} /> : null)}
      <Text size="labelMedium" weight="semibold" tabular style={{ color: fg }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** A row's quick actions (its swipe's and long press's), named for TalkBack's actions menu. */
export type Quick = readonly { label: string; onPress(): void }[];

export const quickActions = (quick: Quick | undefined) =>
  quick?.length
    ? {
        accessibilityActions: quick.map((action, i) => ({ name: `quick${i}`, label: action.label })),
        onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => quick[Number(event.nativeEvent.actionName.slice(5))]?.onPress(),
      }
    : {};

/**
 * A row of Tugas in v4: the course's tile, a title, one short meta line, and at most one status at the end. The whole
 * row is one target (the press spring); its quick actions are a swipe, a long press and TalkBack's actions, never icons
 * beside it (W11). Its spoken name says every fact (`label`), the ones the row leaves to the Task's page too.
 */
export function TaskLine({
  testID,
  label,
  onPress,
  onLongPress,
  quick,
  code,
  course,
  leading,
  title,
  meta,
  status,
  expanded,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  quick?: Quick;
  /** The course whose tile leads the row; none on a course's own page. */
  code?: string | null;
  course?: string;
  /** In place of a course's tile (an exam period's calendar). */
  leading?: ReactNode;
  title: string;
  meta?: string | null;
  status?: ReactNode;
  /** A row that folds a list open (an exam period). */
  expanded?: boolean;
}) {
  const v = useTheme().v4;
  return (
    <PressScale
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      onLongPress={onLongPress}
      {...quickActions(quick)}
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}
    >
      {leading ?? (code ? <CourseTile code={code} name={course} /> : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
        {meta ? (
          <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, marginTop: 2 }}>
            {meta}
          </Text>
        ) : null}
      </View>
      {status}
    </PressScale>
  );
}

/** A tile in the course tile's shape for what has no course (an exam period): an icon in the brand's ink on its tint. */
export function IconTile({ children }: { children: ReactNode }) {
  const v = useTheme().v4;
  return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}>{children}</View>
  );
}

/**
 * The nearest deadline as Tugas's one big card (v4, Beranda's "Perlu kamu urus"): the course's tint, its glyph and a
 * pill (the course's code, or an exam's kind), the countdown big ("8 hari"; red and "lewat" once past), how much of its
 * time has gone as M3's wave (from when it opened), then what it is and when. The screen's focal point, so it's
 * tall: the rows under it start lower, and Tugas's first screen holds fewer words. The same item, target and spoken
 * name as its row would have: it isn't listed again under it.
 */
export function HeroCard({
  testID,
  label,
  onPress,
  onLongPress,
  quick,
  code,
  course,
  kind,
  from,
  at,
  title,
  meta,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  quick?: Quick;
  code: string;
  course?: string;
  /** The pill: the course's code for a Task, the exam's kind for a take-home. */
  kind: string;
  /** When it opened (Edunex's "Mulai bisa dijawab"), for the wave; none, no wave. */
  from: number | null;
  at: number;
  title: string;
  meta: string;
}) {
  const t = useT();
  const { now } = useRowWorld();
  const v = useTheme().v4;
  const { ink, tint } = useCourseTile()(code);
  const away = countdown(t, now, at);
  const color = away.late ? v.redFg : ink;
  const gone = from !== null && from < now && from < at && !away.late ? (now - from) / (at - from) : null;
  return (
    <PressScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      {...quickActions(quick)}
      style={{ backgroundColor: tint, borderRadius: 28, padding: space[5], minHeight: 240 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CourseGlyph code={code} name={course} />
        <View style={{ backgroundColor: v.card, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text size="labelMedium" weight="semibold" style={{ color: ink }}>
            {kind}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: space[3] }}>
        {away.late && (
          <Text size="bodyLarge" face="display" weight="semibold" style={{ color, fontSize: 18, marginRight: 6 }}>
            {t("mobile.home.late")}
          </Text>
        )}
        <CountUp
          id={`tasks:${testID}`}
          value={away.value}
          style={{ color, fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 56, lineHeight: 64, letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}
        />
        <Text size="bodyLarge" face="display" weight="semibold" style={{ color, fontSize: 18, marginLeft: 6 }}>
          {away.unit}
        </Text>
      </View>
      {gone !== null && (
        <View style={{ flexDirection: "row", marginTop: space[2], marginBottom: space[1] }}>
          <WavyProgress progress={gone} ink={ink} track={`${ink}4d`} label={t("mobile.tasks.timeGone", { percent: Math.round(gone * 100) })} />
        </View>
      )}
      <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg, marginTop: space[3] }}>
        {title}
      </Text>
      <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.fg2, marginTop: 2 }}>
        {meta}
      </Text>
    </PressScale>
  );
}
