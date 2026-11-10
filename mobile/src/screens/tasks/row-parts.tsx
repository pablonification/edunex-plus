// What the rows of Tugas & Ujian share (rows.tsx, exam-rows.tsx): what every row reads, read once
// per list (`TaskRowWorld`), the banner a list says its rows' problems in, and the small pieces a row
// is drawn from (the meta line, the date column, the quiet note, the exam's title).
//
// Every row reads the same few things (the clock, the courses, Presensi, what's marked done), so a
// list reads them once for all its rows: read per row, they cost Tugas 100–400 ms each time the
// minute or the data changed. A row on its own (a course's page) reads them itself.
import { type ComponentType, createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { View } from "react-native";
import { type TermCourse, useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone } from "../../../../src/app/snoozes";
import { useDataset } from "../../../../src/app/store";
import type { DatasetValue, DoneEntry, TaskModule } from "../../../../src/core/models";
import { moduleName } from "../../../../src/core/tasks";
import { toast } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { CourseDot, Tag } from "../../ui/display";
import { Icons, ServiceIcons } from "../../ui/icons";
import { factsLabel, Notice, TrailingInline } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text, type TextTone, useTextWidth } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";

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
  const value = useMemo<RowWorldValue>(() => ({ now, f, courses, colorOf, presence, handled, edits }), [now, f, courses, colorOf, presence, handled, edits]);
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
 * When, as a row's meta line says it, the way the whole app writes a date and time: "Kam, 15 Okt, 11:00", "Hari ini,
 * 23:59"; the day alone (`time` false) beside a wide status ("lewat 12 hari", "Waktu berubah").
 */
/**
 * Whether a row's day takes its time too: only within a week (round 3, fewer words on Tugas's first screen). What's
 * further off says its day alone ("Kam, 26 Nov"), its time on its page and in its spoken name.
 */
export const timeShown = (now: number, at: number): boolean => at - now < 7 * 24 * 60 * 60_000;

export function rowWhen(f: Format, at: number, time = true): string {
  return time ? f.dueLabel(at) : f.relativeDay(at);
}

/** A row's one status: a pill in its tone, with a sign when it's red (never the colour alone). */
export function StatusPill({ tone, text, icon }: { tone: PillTone; text: string; icon?: ReactNode }) {
  const v = useTheme().v4;
  const [bg, fg] = tone === "red" ? [v.redBg, v.redFg] : tone === "amber" ? [v.ambBg, v.ambFg] : tone === "ok" ? [v.okBg, v.okFg] : [v.chip, v.fg2];
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

/** What a row is: a Task to hand in, or an exam to sit. Each has its own glyph, in its course's colour. */
export type RowKind = "task" | "exam";

/** The glyph of a row's kind, bare, in the course's colour: the clipboard of Tugas, the paper and pen of Ujian. */
export function KindIcon({ kind, color, size = 16 }: { kind: RowKind; color: string; size?: number }) {
  const Glyph = kind === "exam" ? ServiceIcons.Exams : ServiceIcons.Tasks;
  return <Glyph size={size} color={color} />;
}

/** "15 Okt" (or "Oct 15") as the leaf's two lines. */
const leafOf = (date: string): [string, string] => [date.match(/\d+/)?.[0] ?? date, date.match(/\p{L}+/u)?.[0] ?? ""];

/**
 * The day a row is about, leading it as a calendar's leaf, and the only thing in that column: the weekday small over
 * "15" in the course's colour over "Okt". Tugas reads down this column as an agenda, which no other tab has. With no
 * day set the column is empty (the row says so in words) and the row sorts last. `big`: the lead card's.
 */
function DateLeaf({ date, weekday, ink, big = false }: { date: string | null; weekday?: string | null; ink: string; big?: boolean }) {
  const v = useTheme().v4;
  const width = useTextWidth(big ? 48 : 40);
  if (date === null) return <View style={{ width }} />;
  const [day, month] = leafOf(date);
  const small = { color: big ? v.fg2 : v.muted, fontSize: 12, lineHeight: 16, letterSpacing: 0 } as const;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, alignItems: "center" }}>
      {weekday ? (
        <Text size="labelMedium" weight="medium" numberOfLines={1} style={small}>
          {weekday}
        </Text>
      ) : null}
      <Text
        size="titleLarge"
        face="display"
        weight="extrabold"
        tabular
        numberOfLines={1}
        style={big ? { color: ink, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 } : { color: ink, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 }}
      >
        {day}
      </Text>
      {month ? (
        <Text size="labelMedium" weight="medium" numberOfLines={1} style={small}>
          {month}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A row of Tugas: flat on the page, the day leading it (`date`), a title, then one line with the kind's glyph in the
 * course's colour, the course's name and the time. At most one status at the end. The whole row is one target (the
 * press spring); its quick actions are a swipe, a long press and TalkBack's actions, never icons beside it (W11). Its
 * spoken name says every fact (`label`), the ones the row leaves to the Task's page too. Without `date` (a course's own
 * page, an exam period) it leads with the course's mark or `leading`, as before.
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
  date,
  weekday,
  kind,
  flat = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  quick?: Quick;
  /** The course: its colour for the day and the glyph; its mark leads the row when no day does. None on a course's own page. */
  code?: string | null;
  course?: string;
  /** In place of a course's mark (an exam period's calendar). */
  leading?: ReactNode;
  title: string;
  meta?: string | null;
  status?: ReactNode;
  /** A row that folds a list open (an exam period). */
  expanded?: boolean;
  /** Tugas's own shape: the day ("15 Okt") leading the row; null while no day is set. */
  date?: string | null;
  /** The day's weekday ("Jum"), with the date in its column: never after the course's name. */
  weekday?: string | null;
  /** A Task or an exam: its glyph before the meta line. */
  kind?: RowKind;
  /** Flat on Tugas's page without a day (an exam period): the page's own inset, as the rows with one. */
  flat?: boolean;
}) {
  const v = useTheme().v4;
  const { ink } = useCourseTile()(code);
  const leaf = date !== undefined;
  return (
    <PressScale
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      onLongPress={onLongPress}
      {...quickActions(quick)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingHorizontal: leaf || flat ? space[1] : 14,
        paddingVertical: space[3],
        minHeight: 68,
      }}
    >
      {leaf ? <DateLeaf date={date} weekday={weekday} ink={ink} /> : (leading ?? (code ? <CourseTile code={code} name={course} /> : null))}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
        {meta ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            {kind && code ? <KindIcon kind={kind} color={ink} /> : null}
            <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, flexShrink: 1 }}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>
      {status}
      {/* Every row that opens something ends in the same quiet chevron; one that folds a list has its own. */}
      {expanded === undefined && <Icons.ChevronRight size={16} color={v.muted} />}
    </PressScale>
  );
}

/** Where the hairline between two flat rows starts: past the day (4 + 40 + 12 dp). */
export const LEAF_INSET = 56;

/** A flat row's place on the page: nothing around it, a hairline over every row but its group's first, from the text on. */
export function FlatSlice({ first, children }: { first: boolean; children: ReactNode }) {
  const v = useTheme().v4;
  return (
    <View>
      {children}
      {!first && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: LEAF_INSET, right: 0, height: 1, backgroundColor: v.line }} />}
    </View>
  );
}

/** The place of a row's mark for what has no course (an exam period): the icon bare, nothing behind it. */
export function IconTile({ children }: { children: ReactNode }) {
  return <View style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

/**
 * The nearest deadline as Tugas's one big card (v4, Beranda's "Perlu kamu urus"): in the course's tint, the countdown
 * big at its start ("8 hari"; red and "lewat" once past), what it is beside it, and under that the course's glyph and
 * when, as a row says them. The screen's focal point at about half its old height (round 3: it took ~40% of the first
 * screen for one Task). The same item, target and spoken name as its row would have: it isn't listed again under it.
 */
export function HeroCard({
  testID,
  label,
  onPress,
  onLongPress,
  quick,
  code,
  at,
  date,
  weekday,
  title,
  meta,
  kind = "task",
}: {
  testID: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  quick?: Quick;
  /** The course: the card's tint and its ink. */
  code: string;
  course?: string;
  at: number;
  /** The day as the rows' column says it: "16 Okt" and "Jum". */
  date: string;
  weekday: string;
  title: string;
  /** "Proposal Tugas Akhir · 23:59": whose it is (or what kind) and the time. The day is the leaf's, once. */
  meta: string;
  kind?: RowKind;
}) {
  const t = useT();
  const { now } = useRowWorld();
  const v = useTheme().v4;
  const { ink, tint } = useCourseTile()(code);
  const away = countdown(t, now, at);
  const color = away.late ? v.redFg : ink;
  return (
    <PressScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      {...quickActions(quick)}
      style={{
        backgroundColor: tint,
        borderRadius: 20,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
      }}
    >
      {/* The same column as every row under it: the date, a size up. Never a bare number. */}
      <DateLeaf date={date} weekday={weekday} ink={ink} big />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="titleMedium" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg }}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[1] }}>
          <KindIcon kind={kind} color={ink} />
          <Text size="bodyMedium" tabular numberOfLines={1} style={{ flexShrink: 1, color: v.fg2 }}>
            {meta}
          </Text>
        </View>
      </View>
      {/* How long is left, quiet at the card's end: the one row that says it while it's still calm. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {away.late && <Icons.AlertTriangle size={14} weight="bold" color={color} />}
        <Text size="bodyMedium" weight="semibold" tabular style={{ color: away.late ? color : v.fg2 }}>
          {away.text}
        </Text>
      </View>
    </PressScale>
  );
}
