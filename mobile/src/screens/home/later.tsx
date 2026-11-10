// "Nanti hari ini": the classes and meetings still to come today, past the one on the block, as a timeline on the page.
// A row each: its time, a dot in the course's colour on the line down the day, the course's whole name (it wraps, never
// cut to a name it isn't), its room, and at most one chip for what's new about today's class (a new time or room; Hanya
// di Edunex for a meeting). A class that shares its time with another says so with one icon and the word "Bentrok". A
// course's absences are the strip's, said once there. A row opens the class's sheet. A class on SIX's timetable today
// that the app couldn't read comes first, as the desktop's Hari ini puts it (it has no time to place it at), as SIX
// writes it; it opens Jadwal's sheet for it, with SIX's timetable.
//
// Round 2: a clash is said once for the pair, on its first row (the kit's ClashMark); the row opens the class's sheet,
// which says which of the two to go to. Every row ends in the same quiet chevron: it opens something. And a short day
// isn't followed by a blank page: when three classes or fewer are left today, the next class day's follow under its own
// day ("Besok"), the same rows.
//
// Round 3, the row rethought (round 1's whole name and time column, round 2's one mark per pair and chevron): the time
// in its column, the course's own glyph in its colour on the line down the day (where the dot was), the name on the
// row's full width on up to two lines, and under it one quiet line: the room, then the clash mark or what changed.
// Nothing sits beside the name, so it never breaks one word per line. And Beranda's first screen ends on the day's
// first class: its row runs down to the fold (the line down the day with it), so the next class starts under it
// instead of half in (the first screen's 50 words).
//
// Round 4: the day that follows today's is the next day with anything on it, a class or a meeting only Edunex
// announced (Friday's meeting was skipped for next week's classes). An exam's row says so: "UTS" before the course's
// name and the exam glyph on the line, as Tugas and Jadwal draw it. A clash is marked on both rows, each with the
// time the two share. And today's rows are one height (the first row's, which reaches the fold), so the line down
// the day has even steps instead of one long one.
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { isExamActivity } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import type { UnreadSession } from "../../../../src/core/models";
import { type ClassFacts, classFacts, type HomeContext, type NowCard, type TodayPlan } from "../../../../src/core/needs";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { IconTile } from "../../ui/group";
import { Icons, ServiceIcons } from "../../ui/icons";
import { useTabsBottom } from "../../ui/insets";
import { ClashMark, SectionHeading } from "../../ui/kit";
import { PressScale } from "../../ui/press";
import { ROW_SIDE } from "../../ui/row-end";
import { Text, useTextWidth } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import { DetailSheet } from "../schedule/details";
import { blockClassKey, useBlockMovedOnTo } from "./banner";
import { ClassSheet, classCard } from "./class-sheet";
import { nameOf, shortName } from "./parts";

/** A row at its least: the name and the room line with room for a thumb. */
const ROW = 64;
/** The most a first row grows to reach the fold: past this (a tall phone) the next class simply shows. */
const REACH = 120;

type Item =
  | { kind: "class"; key: string; start: number; end: number; code: string; facts: ClassFacts }
  | { kind: "meeting"; key: string; start: number; end: number; code: string; meeting: TodayPlan["announced"][number] };

/** Today's list is short at this many rows or fewer: the next class day follows it. */
const SHORT_DAY = 3;
/** Rows under the fold's first screen, today's and the next day's together. */
const ROWS_AHEAD = 5;

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
  // The first row runs down to the fold, so the next class starts under it. Measured once, after the page's entrance
  // has settled and before the rows under it are drawn: they wait under the fold, so nothing is seen to move.
  const fold = useTabsBottom();
  const lead = useRef<ComponentRef<typeof View>>(null);
  const [reach, setReach] = useState<number | null>(null);
  useEffect(() => {
    if (reach !== null) return;
    const timer = setTimeout(() => {
      const node = lead.current;
      if (!node || fold <= 0) return setReach(0);
      node.measureInWindow((_x, y, _w, h) => {
        const gap = fold - (y + h);
        setReach(gap > 0 && gap <= REACH && y > 0 ? Math.ceil(h + gap) + 2 : 0);
      });
    }, 1100);
    return () => clearTimeout(timer);
  }, [fold, reach]);
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
  // A short day: the next day with anything on it follows, a class or a meeting only Edunex announced (the plan
  // holds tomorrow's), so the page never ends in a blank third and never skips a day the Student has to turn up on.
  const ahead = useMemo((): Item[] => {
    if (items.length + unread.length > SHORT_DAY) return [];
    const classes = (context.schedule ?? [])
      .filter((session) => wibDay(session.start) > day)
      .map((session) => ({ start: session.start, code: session.courseCode, key: `class:${session.id}`, session, announced: null }));
    const meetings = plan.announced
      .filter((one) => wibDay(one.meeting.start) > day)
      .map((one) => ({ start: one.meeting.start, code: one.code, key: `meeting:${one.code}:${one.meeting.start}`, session: null, announced: one }));
    const later = [...classes, ...meetings].sort((a, b) => a.start - b.start);
    const nextDay = later[0] ? wibDay(later[0].start) : null;
    return later
      .filter((one) => wibDay(one.start) === nextDay && one.key !== onCard && blockClassKey(one.code, one.start) !== onBlock)
      .slice(0, ROWS_AHEAD - items.length)
      .map(
        (one): Item =>
          one.session
            ? { kind: "class", key: one.key, start: one.start, end: one.session.end, code: one.code, facts: classFacts(context, one.session) }
            : { kind: "meeting", key: one.key, start: one.start, end: one.announced.meeting.end, code: one.code, meeting: one.announced },
      );
  }, [context, plan.announced, day, items.length, unread.length, onCard, onBlock]);
  if (!items.length && !unread.length && !ahead.length) return null;
  // Today's rows share the first row's height (it reaches the fold): even steps down the day.
  const step = items.length + ahead.length > 1 && reach ? reach : undefined;
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
  // A section of its own under the services: the heading and the day's next class close Beranda's first screen.
  const heading = { marginTop: space[8], marginBottom: space[2], marginLeft: space[1] };
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
              {items.map((item, i) =>
                i === 0 ? (
                  <View key={item.key} ref={lead} collapsable={false}>
                    <Row item={item} first={!unread.length} last={items.length === 1} clash courses={courses} minHeight={step} onOpen={() => open(item)} />
                  </View>
                ) : reach === null ? null : (
                  <Row
                    key={item.key}
                    item={item}
                    first={false}
                    last={i === items.length - 1}
                    clash
                    courses={courses}
                    minHeight={step}
                    onOpen={() => open(item)}
                  />
                ),
              )}
            </View>
          </Rise>
        </>
      )}
      {ahead.length > 0 && (reach !== null || items.length === 0) && (
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

/**
 * "Nanti hari ini" before its classes are read (the first read): the heading where it will be and two rows' shapes
 * under it, from the first frame, so the timeline fills in instead of popping into a blank third of the page.
 */
export function LaterShape() {
  const t = useT();
  const v = useTheme().v4;
  const timeColumn = useTextWidth(44);
  return (
    <View testID="section.today.reading" accessibilityState={{ busy: true }}>
      <SectionHeading style={{ marginTop: space[8], marginBottom: space[2], marginLeft: space[1] }}>{t("mobile.home.laterToday")}</SectionHeading>
      {[0, 1].map((row) => (
        <View key={row} style={{ flexDirection: "row", gap: space[3], paddingHorizontal: ROW_SIDE, minHeight: ROW }}>
          <View style={{ width: timeColumn, paddingTop: space[2.5] + 4 }}>
            <Skeleton width={36} height={14} />
          </View>
          <View style={{ width: 24, alignItems: "center" }}>
            <View style={{ width: 2, height: space[2], backgroundColor: row === 0 ? "transparent" : v.line }} />
            <View style={{ height: 26, justifyContent: "center" }}>
              <Skeleton width={18} height={18} style={{ borderRadius: 9 }} />
            </View>
            <View style={{ width: 2, flex: 1, backgroundColor: row === 1 ? "transparent" : v.line }} />
          </View>
          <View style={{ flex: 1, paddingTop: space[2.5] + 4, gap: space[2.5] }}>
            <Skeleton width={row === 0 ? "70%" : "85%"} height={14} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * One class on the day's timeline: its time in a column, the course's glyph in its colour on the line down the day,
 * the name on the row's full width (two lines at most), and under it the room with the clash mark or what changed.
 */
function Row({
  item,
  first,
  last,
  clash: saysClash,
  courses,
  minHeight = ROW,
  onOpen,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  /** This row says its clash: today's rows do, both of a pair, each with the time they share. */
  clash: boolean;
  courses: readonly TermCourse[];
  /** The first row's height when it runs down to the fold. */
  minHeight?: number;
  onOpen(): void;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const timeColumn = useTextWidth(44);
  const course = item.kind === "class" ? nameOf(courses, item.code, item.facts.session.courseName) : nameOf(courses, item.code);
  // An exam says so before the course's name ("UTS Komunikasi Pemasaran"), as Jadwal's block does.
  const exam = item.kind === "class" && isExamActivity(item.facts.session.activity) ? item.facts.session.activity : null;
  const name = exam ? `${exam} ${course}` : course;
  const { ink } = useCourseTile()(item.code);
  const place = item.kind === "class" ? item.facts.session.room : item.meeting.meeting.online ? t("mobile.home.online") : null;
  const chip = chipOf(t, item);
  const meta = [f.time(item.start), place].filter(Boolean).join(" · ");
  const overlap = item.kind === "class" ? item.facts.overlap : null;
  const clash = overlap ? t("mobile.course.ex.clash", { course: shortName(nameOf(courses, overlap.code)) }) : null;
  const marked = overlap !== null && saysClash;
  return (
    <PressScale
      onPress={onOpen}
      accessibilityLabel={[name, meta, clash, chip].filter(Boolean).join(", ")}
      testID={`row.today.${item.key}`}
      style={{ flexDirection: "row", alignItems: "stretch", gap: space[3], paddingHorizontal: ROW_SIDE, minHeight }}
    >
      <Text
        size="bodyLarge"
        face="display"
        weight="bold"
        tabular
        style={{ color: v.fg, width: timeColumn, fontSize: 15, lineHeight: 22, paddingTop: space[2.5] }}
      >
        {f.time(item.start)}
      </Text>
      {/* The line down the day, with the course's own glyph on it where the dot was. */}
      <View style={{ width: 24, alignItems: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: 2, height: space[2], backgroundColor: first ? "transparent" : v.line }} />
        <View style={{ height: 26, justifyContent: "center" }}>
          {exam ? <ServiceIcons.Exams size={22} color={ink} /> : <CourseGlyph code={item.code} name={course} size={22} />}
        </View>
        <View style={{ width: 2, flex: 1, backgroundColor: last ? "transparent" : v.line }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: space[2.5], paddingBottom: space[3] }}>
        {/* The course's whole name on the row's full width: nothing beside it, so it never breaks a word a line. */}
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 22 }}>
          {name}
        </Text>
        {(place || marked || chip) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[3], rowGap: 2, marginTop: 2 }}>
            {place ? (
              <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, flexShrink: 1 }}>
                {place}
              </Text>
            ) : null}
            {marked && (
              // A clash, on both rows of the pair with the time they share: the sheet this row opens says which to go to.
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`clash.today.${item.key}`}>
                <ClashMark detail={overlap ? f.timeRange(overlap.from, overlap.to) : undefined} />
              </View>
            )}
            {/* Neutral words: amber is for the Student's standing and the clash, and a new room isn't either. */}
            {chip && (
              <Text size="bodyMedium" weight="semibold" numberOfLines={1} style={{ color: v.fg2, fontSize: 13, lineHeight: 18, letterSpacing: 0 }}>
                {chip}
              </Text>
            )}
          </View>
        )}
      </View>
      {/* It opens the class's sheet, and looks like it does: the same quiet chevron on every row that opens something. */}
      <View style={{ height: ROW, justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: ROW_SIDE, paddingVertical: space[3], minHeight: 68 }}
    >
      {!first && <View style={{ position: "absolute", top: 0, left: ROW_SIDE + 44 + space[3], right: 0, height: 1, backgroundColor: v.line }} />}
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
