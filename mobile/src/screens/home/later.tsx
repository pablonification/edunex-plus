// "Nanti hari ini": the classes and meetings still to come today, past the one on the block, as a timeline on the page.
// A row each: its time, a dot in the course's colour on the line down the day, the course's whole name (it wraps, never
// cut to a name it isn't), its room, and at most one chip for what's new about today's class (a new time or room; Hanya
// di Edunex for a meeting). A class that shares its time with another says so with one icon and the word "Bentrok". A
// course's absences are the strip's, said once there. A row opens the class's sheet. A class on SIX's timetable today
// that the app couldn't read comes first, as the desktop's Hari ini puts it (it has no time to place it at), as SIX
// writes it; it opens Jadwal's sheet for it, with SIX's timetable.
//
// Round 2: a clash is said once for the pair, on its first row, with the time the other starts ("Bentrok 16:00", the
// kit's ClashMark); the row opens the class's sheet, which says which of the two to go to. Every row ends in the same
// quiet chevron: it opens something. And a short day isn't followed by a blank page: when two classes or fewer are
// left today, the next class day's follow under its own day ("Besok"), the same rows.
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import type { UnreadSession } from "../../../../src/core/models";
import { type ClassFacts, classFacts, type HomeContext, type NowCard, type TodayPlan } from "../../../../src/core/needs";
import { Rise } from "../../ui/expressive";
import { IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { ClashMark, SectionHeading } from "../../ui/kit";
import { PressScale } from "../../ui/press";
import { Text, useTextWidth } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { DetailSheet } from "../schedule/details";
import { blockClassKey, useBlockMovedOnTo } from "./banner";
import { ClassSheet, classCard } from "./class-sheet";
import { nameOf, shortName } from "./parts";

type Item =
  | { kind: "class"; key: string; start: number; end: number; code: string; facts: ClassFacts }
  | { kind: "meeting"; key: string; start: number; end: number; code: string; meeting: TodayPlan["announced"][number] };

/** Today's list is short at this many rows or fewer: the next class day follows it. */
const SHORT_DAY = 2;
/** Rows under the fold's first screen, today's and the next day's together. */
const ROWS_AHEAD = 4;

/** A clash's pair, the same whichever class comes first. */
const pairOf = (a: string, b: string) => [a, b].sort().join("|");

/** Which rows say the clash: the first of each pair in the list, the others leave it to that one. */
function clashRows(items: readonly Item[]): Set<string> {
  const pairs = new Set<string>();
  const rows = new Set<string>();
  for (const item of items) {
    const overlap = item.kind === "class" ? item.facts.overlap : null;
    if (!overlap) continue;
    const pair = `${wibDay(item.start)}:${pairOf(item.code, overlap.code)}`;
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    rows.add(item.key);
  }
  return rows;
}

export function Later({ context, plan, courses, onCard }: { context: HomeContext; plan: TodayPlan; courses: readonly TermCourse[]; onCard: string | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  // The class the block has moved on to is the block's: said once, there.
  const onBlock = useBlockMovedOnTo();
  const [picked, setPicked] = useState<NowCard | null>(null);
  const [unreadOpen, setUnreadOpen] = useState(false);
  // The sheets are drawn once one is asked for: not with the timeline.
  const sheets = useRef(false);
  if (picked !== null || unreadOpen) sheets.current = true;
  const day = wibDay(context.now);
  const unread = plan.unread.filter((one) => one.day === day);
  const items: Item[] = [
    ...plan.classes.map(
      (facts): Item => ({
        kind: "class",
        key: `class:${facts.session.id}`,
        start: facts.session.start,
        end: facts.session.end,
        code: facts.session.courseCode,
        facts,
      }),
    ),
    ...plan.announced.map(
      (announced): Item => ({
        kind: "meeting",
        key: `meeting:${announced.code}:${announced.meeting.start}`,
        start: announced.meeting.start,
        end: announced.meeting.end,
        code: announced.code,
        meeting: announced,
      }),
    ),
  ]
    .filter((item) => wibDay(item.start) === day && item.end > now && item.key !== onCard && blockClassKey(item.code, item.start) !== onBlock)
    .sort((a, b) => a.start - b.start);
  // A short day: the next day with a class follows it, so the page never ends in a blank third.
  const ahead = useMemo((): Item[] => {
    if (items.length + unread.length > SHORT_DAY) return [];
    const later = (context.schedule ?? []).filter((session) => wibDay(session.start) > day).sort((a, b) => a.start - b.start);
    const nextDay = later[0] ? wibDay(later[0].start) : null;
    return later
      .filter(
        (session) => wibDay(session.start) === nextDay && `class:${session.id}` !== onCard && blockClassKey(session.courseCode, session.start) !== onBlock,
      )
      .slice(0, ROWS_AHEAD - items.length)
      .map((session) => ({
        kind: "class",
        key: `class:${session.id}`,
        start: session.start,
        end: session.end,
        code: session.courseCode,
        facts: classFacts(context, session),
      }));
  }, [context, day, items.length, unread.length, onCard, onBlock]);
  if (!items.length && !unread.length && !ahead.length) return null;
  const clashes = clashRows(items);
  const open = (item: Item) =>
    setPicked(
      item.kind === "class"
        ? classCard(item.facts, now)
        : {
            state: "next",
            class: null,
            meeting: { code: item.code, meeting: item.meeting.meeting, maybeInSix: item.meeting.maybeInSix },
            presence: null,
            after: null,
            unreadDay: null,
          },
    );
  // Tight over the timeline: the heading and the day's next two classes belong on Beranda's first screen.
  const heading = { marginTop: space[3], marginBottom: space[1], marginLeft: space[1] };
  return (
    <View testID="section.today">
      {(items.length > 0 || unread.length > 0) && (
        <>
          <Rise screen="home" index={5}>
            <SectionHeading style={heading}>{t("mobile.home.laterToday")}</SectionHeading>
          </Rise>
          <Rise screen="home" index={6}>
            {/* Direction B: a timeline on the page itself (the official app's "Timeline Activity"), not a card of rows. */}
            <View>
              {unread.map((one, i) => (
                <UnreadRow key={`unread:${one.row}`} one={one} first={i === 0} onOpen={() => setUnreadOpen(true)} />
              ))}
              {items.map((item, i) => (
                <Row
                  key={item.key}
                  item={item}
                  first={i === 0 && !unread.length}
                  last={i === items.length - 1}
                  clash={clashes.has(item.key)}
                  courses={courses}
                  onOpen={() => open(item)}
                />
              ))}
            </View>
          </Rise>
        </>
      )}
      {ahead.length > 0 && (
        <View testID="section.ahead">
          <SectionHeading style={heading}>{f.relativeDay(ahead[0]?.start ?? now)}</SectionHeading>
          {ahead.map((item, i) => (
            <Row
              key={item.key}
              item={item}
              first={i === 0}
              last={i === ahead.length - 1}
              // A clash on a day ahead is said once, in Perlu kamu urus.
              clash={false}
              courses={courses}
              onOpen={() => open(item)}
            />
          ))}
        </View>
      )}
      {sheets.current && (
        <>
          <ClassSheet card={picked} courses={courses} open={picked !== null} onClose={() => setPicked(null)} />
          <DetailSheet picked={unreadOpen && unread.length ? { kind: "unread", day, unread } : null} onClose={() => setUnreadOpen(false)} />
        </>
      )}
    </View>
  );
}

/** One class on the day's timeline: its time, a dot in the course's colour on the line down the day, its name and room. */
function Row({
  item,
  first,
  last,
  clash: saysClash,
  courses,
  onOpen,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  /** This row says its pair's clash (the pair's other row leaves it to this one). */
  clash: boolean;
  courses: readonly TermCourse[];
  onOpen(): void;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const tile = useCourseTile();
  const timeColumn = useTextWidth(44);
  const name = item.kind === "class" ? nameOf(courses, item.code, item.facts.session.courseName) : nameOf(courses, item.code);
  const place = item.kind === "class" ? item.facts.session.room : item.meeting.meeting.online ? t("mobile.home.online") : null;
  const chip = chipOf(t, item);
  const meta = [f.time(item.start), place].filter(Boolean).join(" · ");
  const overlap = item.kind === "class" ? item.facts.overlap : null;
  const clash = overlap ? t("mobile.course.ex.clash", { course: shortName(nameOf(courses, overlap.code)) }) : null;
  return (
    <PressScale
      onPress={onOpen}
      accessibilityLabel={[name, meta, clash, chip].filter(Boolean).join(", ")}
      testID={`row.today.${item.key}`}
      style={{ flexDirection: "row", alignItems: "stretch", gap: space[3], paddingHorizontal: space[1], minHeight: 56 }}
    >
      <Text
        size="bodyLarge"
        face="display"
        weight="bold"
        tabular
        style={{ color: v.fg, width: timeColumn, fontSize: 15, lineHeight: 21, paddingTop: space[2] }}
      >
        {f.time(item.start)}
      </Text>
      <View style={{ width: 12, alignItems: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: 2, height: 12, backgroundColor: first ? "transparent" : v.line }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tile(item.code).ink }} />
        <View style={{ width: 2, flex: 1, backgroundColor: last ? "transparent" : v.line }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: space[2] }}>
        {/* The course's whole name, on as many lines as it takes: never cut to a name it isn't. */}
        <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
          {name}
        </Text>
        {place ? (
          <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
            {place}
          </Text>
        ) : null}
      </View>
      {overlap && saysClash && (
        // A clash, once for the pair: the kit's mark, and when the other class starts unless it's this row's own time.
        <View
          style={{ alignSelf: "center", flexShrink: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`clash.today.${item.key}`}
        >
          <ClashMark detail={overlap.from > item.start ? f.time(overlap.from) : undefined} />
        </View>
      )}
      {/* Neutral: amber is for the Student's standing (absences), and a new room isn't. */}
      {chip && (
        <View style={{ alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: v.chip }}>
          <Text size="labelMedium" weight="semibold" style={{ color: v.fg2 }}>
            {chip}
          </Text>
        </View>
      )}
      {/* It opens the class's sheet, and looks like it does: the same quiet chevron on every row that opens something. */}
      <View style={{ alignSelf: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icons.ChevronRight size={16} color={v.muted} />
      </View>
    </PressScale>
  );
}

/** A class SIX shows today that the app couldn't read: the desktop's words for it, and the row as SIX writes it. */
function UnreadRow({ one, first, onOpen }: { one: UnreadSession; first: boolean; onOpen(): void }) {
  const t = useT();
  const v = useTheme().v4;
  const title = t("schedule.unread.title", { count: 1 });
  return (
    <PressScale
      onPress={onOpen}
      accessibilityLabel={`${title}, ${one.row}`}
      testID="row.today.unread"
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}
    >
      {!first && <View style={{ position: "absolute", top: 0, left: 70, right: 0, height: 1, backgroundColor: v.line }} />}
      <IconTile tone="plain" icon={(c) => <Icons.Info size={22} color={c} weight="bold" />} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="medium" numberOfLines={1} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
        <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, marginTop: 2 }}>
          {one.row}
        </Text>
      </View>
    </PressScale>
  );
}

/**
 * The row's one chip: a new time or room, in the desktop's words (src/app/screens/home.tsx classStatuses). A meeting only
 * Edunex announced says so. A course's absences are Perlu kamu urus's rows (one fact, one place); a clash is the row's icon.
 */
function chipOf(t: Translate, item: Item): string | null {
  if (item.kind === "meeting") return item.meeting.maybeInSix ? null : t("home.today.notInSix");
  const { facts } = item;
  if (facts.moved) return t(facts.moved.usualStart !== null ? "home.today.changed" : "home.today.roomChanged");
  return null;
}
