// Small pieces Beranda's sections share: a row's quick actions three ways (the visible ✓ and alarm, a swipe, a long
// press). The helpers marked "from src/app/screens/home.tsx" are the desktop's own, copied as
// they are because that file draws DOM.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { type Format, type Translate, useNow, useT } from "../../../../src/app/i18n";
import type { AttendanceState } from "../../../../src/core/attendance";
import { type DoneTerms, doneTerms } from "../../../../src/core/done";
import type { ClassFacts, NeedDraft, NowCard } from "../../../../src/core/needs";
import type { Snoozable, SnoozeKey } from "../../../../src/core/snooze";
import { canSnooze, type RowDone, useMarkDone, useRowActions, useSnooze } from "../../parts/snooze";
import { Icons } from "../../ui/icons";
import { ActionSheet } from "../../ui/sheet";
import { SwipeRow } from "../../ui/swipe";
import { Text, type TextTone } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { RealClock } from "./held";

/** The row key (Hari ini's, Nanti hari ini's) of what the now card shows. From src/app/screens/home.tsx. */
export const cardKey = (card: NowCard | null) =>
  card?.class ? `class:${card.class.session.id}` : card?.meeting ? `meeting:${card.meeting.code}:${card.meeting.meeting.start}` : null;

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

/** "Jam berubah. Biasanya 08:00–10:00.": the desktop's status and its tooltip (src/app/screens/home.tsx), in one line. */
export function movedLabel(t: Translate, f: Format, facts: ClassFacts): string {
  const moved = facts.moved!;
  if (moved.usualStart !== null && moved.usualEnd !== null) {
    const time = f.timeRange(moved.usualStart, moved.usualEnd);
    const usual = f.dayOffset(moved.usualStart) === f.dayOffset(facts.session.start) ? time : `${f.weekday(moved.usualStart)} ${time}`;
    return `${t("home.today.changed")}. ${t("home.today.usual", { usual })}`;
  }
  return `${t("home.today.roomChanged")}. ${t("home.today.usual", { usual: moved.usualRoom ?? "" })}`;
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

function LaterSheet({ item, open, setOpen }: { item: Snoozable; open: boolean; setOpen(open: boolean): void }) {
  return useSnooze(item, { open, setOpen }).sheet;
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
 * A row's quick actions, "Sudah beres" (only where only the Student can know) and "Ingatkan nanti", three ways: a
 * swipe (ui/swipe.tsx: done toward the end, later toward the start), a sheet on a long press (`onLongPress`, for
 * Row's), and TalkBack's actions (`quick`, for Row's), so nobody has to know the gesture. Neither action: the row as
 * it is. No icons beside the row: they crowded every line (W11), and the swipe and the press are Android's own ways.
 */
export function QuickRow({
  name,
  done,
  snooze,
  surface,
  children,
}: {
  /** What the item is, whole ("Tugas 02 · II4091"): the sheet's title. */
  name: string;
  done: QuickDone | null;
  snooze: Snoozable | null;
  /** The row's own colour, under it as it slides (a v4 card's white). */
  surface?: string;
  children: (quick: { quick: readonly { label: string; onPress(): void }[] | undefined; onLongPress: (() => void) | undefined }) => ReactNode;
}) {
  const t = useT();
  const theme = useTheme();
  const now = useNow();
  const later = snooze && canSnooze(snooze, now) ? snooze : null;
  const [laterOpen, setLaterOpen] = useState(false);
  const sheet = { available: later !== null, open: () => setLaterOpen(true) };
  const put = useMarkDone(done?.item ?? null, done?.how ?? null, done?.said ?? "");
  const swipe = useRowActions({ done: done ? { how: done.how, put } : null, snooze: later ? sheet : null });
  const [menu, setMenu] = useState(false);
  const choices = [
    ...(done
      ? [{ label: t(`done.${done.how}`), icon: <Icons.Check size={20} weight="bold" color={theme.color.muted} />, onPress: put, testID: "menu.done" }]
      : []),
    ...(later ? [{ label: t("snooze.action"), icon: <Icons.Snooze size={20} color={theme.color.muted} />, onPress: sheet.open, testID: "menu.snooze" }] : []),
  ];
  // Only "Ingatkan nanti": straight to its times, as on Tugas (a menu of one would be a sheet too many).
  const onLongPress = !choices.length ? undefined : !done && later ? sheet.open : () => setMenu(true);
  const quick = choices.length ? choices.map((choice) => ({ label: choice.label, onPress: choice.onPress })) : undefined;
  return (
    <>
      <SwipeRow actions={swipe} surface={surface}>
        {children({ quick, onLongPress })}
      </SwipeRow>
      {choices.length > 0 && <ActionSheet open={menu} onClose={() => setMenu(false)} title={name} choices={choices} testID="sheet.row" />}
      {/* The times it offers count from now itself, even where the row's clock is held (./held.tsx). */}
      {later && (
        <RealClock>
          <LaterSheet item={later} open={laterOpen} setOpen={setLaterOpen} />
        </RealClock>
      )}
    </>
  );
}

/** Small words left out of a short name. */
const SMALL = /^(dan|dalam|di|ke|untuk|pada|dengan|of|and|the|in|for|to|&)$/i;

/**
 * A course's name where a glance is enough (Jadwal's blocks, Beranda's cards and rows), short as the mockup's ("Ekonomi dan Inovasi" for "Ekonomi dan Inovasi dalam Perencanaan"): a name
 * up to 22 letters stays whole, a longer one keeps its words up to the second that says something. The whole name is
 * on the sheet and in what TalkBack reads.
 */
export function shortName(name: string): string {
  if (name.length <= 22) return name;
  const words = name.split(/\s+/);
  const kept: string[] = [];
  let said = 0;
  for (const word of words) {
    if (!SMALL.test(word)) {
      if (said === 2) break;
      said++;
    }
    kept.push(word);
  }
  while (kept.length > 1 && SMALL.test(kept[kept.length - 1]!)) kept.pop();
  return kept.join(" ");
}
