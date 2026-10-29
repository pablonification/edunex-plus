// Small pieces Beranda's sections share: the course mark beside a row's facts, facts said in a
// status color, and a row's quick actions three ways (the visible ✓ and alarm, a swipe, a long
// press). The helpers marked "from src/app/screens/home.tsx" are the desktop's own, copied as
// they are because that file draws DOM.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useCourseColor } from "../../../../src/app/courses";
import { type Format, type Translate, useNow, useT } from "../../../../src/app/i18n";
import type { AttendanceState } from "../../../../src/core/attendance";
import { type DoneTerms, doneTerms } from "../../../../src/core/done";
import type { ClassFacts, NeedDraft } from "../../../../src/core/needs";
import type { Snoozable, SnoozeKey } from "../../../../src/core/snooze";
import { canSnooze, DoneButton, type RowDone, rowControls, SnoozeMenu, useMarkDone, useRowActions, useSnooze } from "../../parts/snooze";
import { CourseDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { ActionSheet } from "../../ui/sheet";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextSize, type TextTone, type TextWeight } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

export const MINUTE = 60_000;
export const DAY = 86_400_000;

/** Attendance state as a status color for text: quiet while an absence is still allowed. Never the course's color. From src/app/screens/home.tsx (STATE_TEXT). */
export const STATE_TEXT: Record<AttendanceState, TextTone> = {
  out: "danger",
  missed: "danger",
  none: "warning",
  risk: "muted",
  safe: "muted",
  met: "muted",
  unknown: "faint",
};

/** From src/app/screens/home.tsx. */
export const nameOf = (courses: readonly TermCourse[], code: string, fallback?: string) =>
  courses.find((course) => course.code === code)?.name ?? fallback ?? code;

/** A class's day and time, as the course page names the class a window is for: "Kam, 8 Okt, 08:00–10:00". From src/app/screens/home.tsx. */
export const classDayTime = (f: Format, start: number, end: number) => `${f.relativeDay(start)}, ${f.timeRange(start, end)}`;

/** From src/app/screens/home.tsx. */
export function movedLabel(t: Translate, f: Format, facts: ClassFacts): string {
  const moved = facts.moved!;
  if (moved.usualStart !== null && moved.usualEnd !== null) {
    const time = f.timeRange(moved.usualStart, moved.usualEnd);
    return t("home.today.changed", {
      usual: f.dayOffset(moved.usualStart) === f.dayOffset(facts.session.start) ? time : `${f.weekday(moved.usualStart)} ${time}`,
    });
  }
  return t("home.today.roomChanged", { room: moved.usualRoom ?? "" });
}

/**
 * Facts in one tone, for a Meta: text holding " · " becomes one Text per fact, so Meta draws the
 * dots between them and a status color ("Jam berubah · biasanya 08:00–09:30" in amber) carries
 * to each.
 */
export function toned(text: string, tone: TextTone, { size = "small", weight = "regular" }: { size?: TextSize; weight?: TextWeight } = {}): ReactNode[] {
  return text
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: the facts are positions in one sentence
      <Text key={i} size={size} weight={weight} tone={tone}>
        {part}
      </Text>
    ));
}

/** The course's dot and code among a row's facts. */
export function CourseMark({ code, past = false }: { code: string; past?: boolean }) {
  const color = useCourseColor()(code);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <CourseDot color={color} size={8} />
      <Text size="small" weight="medium" tabular tone={past ? "faint" : "fg"}>
        {code}
      </Text>
    </View>
  );
}

/** A quiet sentence where a list would be. */
export function Quiet({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: theme.color.sunken, paddingHorizontal: space[4], paddingVertical: space[3.5] }}>
      <Text tone="muted">{children}</Text>
    </View>
  );
}

export interface QuickDone {
  item: SnoozeKey;
  how: RowDone;
  /** The toast's words once it's put away. */
  said: string;
}

/** The ✓ for an item only the Student can know is dealt with, saying until what it's put away; none for the rest. From src/app/screens/home.tsx (doneButton). */
export function doneOf(t: Translate, need: NeedDraft): QuickDone | null {
  const terms = doneTerms(need);
  if (!terms?.how) return null;
  return { item: terms.key, how: terms.how as RowDone, said: doneSaid(t, need, terms) };
}

/** From src/app/screens/home.tsx. */
function doneSaid(t: Translate, need: NeedDraft, terms: DoneTerms): string {
  switch (terms.how) {
    case "gotIt":
      return need.kind === "attendance" && need.health.state === "out"
        ? t("done.toast.gotIt", { course: need.course ?? "" })
        : terms.key.id.includes(":class:")
          ? t("done.toast.gotItClass")
          : t("done.toast.gotItCount");
    case "checked":
    case "groupDone":
    case "paid":
      return t(`done.toast.${terms.how}`);
    default:
      return "";
  }
}

/**
 * A row's quick actions, "Sudah beres" (the ✓, only where only the Student can know) and "Ingatkan
 * nanti", three ways: as visible icons beside the row (`actions`, for Row's `actions`), as a swipe,
 * and in a sheet on a long press (`onLongPress`, for Row's), so nobody has to know the gesture.
 * Neither action: the row as it is.
 */
export function QuickRow({
  name,
  done,
  snooze,
  children,
}: {
  /** What the item is, whole ("Tugas 02 · II4091"): the controls' names and the sheet's title. */
  name: string;
  done: QuickDone | null;
  snooze: Snoozable | null;
  children: (quick: { actions: ReactNode; onLongPress: (() => void) | undefined }) => ReactNode;
}) {
  const t = useT();
  const theme = useTheme();
  const now = useNow();
  const later = snooze && canSnooze(snooze, now) ? snooze : null;
  const sheet = useSnooze(later);
  const put = useMarkDone(done?.item ?? null, done?.how ?? null, done?.said ?? "");
  const swipe = useRowActions({ done: done ? { how: done.how, put } : null, snooze: later ? sheet : null });
  const [menu, setMenu] = useState(false);
  const actions = rowControls(
    done ? <DoneButton item={done.item} how={done.how} name={name} said={done.said} /> : null,
    later ? <SnoozeMenu item={later} name={name} /> : null,
  );
  const choices = [
    ...(done
      ? [{ label: t(`done.${done.how}`), icon: <Icons.Check size={20} weight="bold" color={theme.color.muted} />, onPress: put, testID: "menu.done" }]
      : []),
    ...(later ? [{ label: t("snooze.action"), icon: <Icons.Snooze size={20} color={theme.color.muted} />, onPress: sheet.open, testID: "menu.snooze" }] : []),
  ];
  return (
    <>
      <SwipeRow actions={swipe}>{children({ actions, onLongPress: choices.length ? () => setMenu(true) : undefined })}</SwipeRow>
      {choices.length > 0 && <ActionSheet open={menu} onClose={() => setMenu(false)} title={name} choices={choices} testID="sheet.row" />}
      {sheet.sheet}
    </>
  );
}
