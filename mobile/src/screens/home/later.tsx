// "Nanti hari ini" (round 2, v4): the classes and meetings still to come today, past the one on the now card. A row
// each: the course's tile, its name, "15:00 · R.SG PWK LT.6", and at most one chip for what's new about today's class
// (a new time or room; Hanya di Edunex for a meeting), in the neutral tone, and the clash's icon when it shares its time
// with another class (Perlu kamu urus leaves a clash later today to this row). A course's absences are Perlu kamu
// urus's, said once there (./urus.tsx). A row opens the class's sheet. A class on SIX's timetable today that the app couldn't read
// comes first, as the desktop's Hari ini puts it (it has no time to place it at), as SIX writes it; it opens Jadwal's
// sheet for it, with SIX's timetable. Hidden when nothing's left.
import { useRef, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import type { UnreadSession } from "../../../../src/core/models";
import type { ClassFacts, HomeContext, NowCard, TodayPlan } from "../../../../src/core/needs";
import { Rise } from "../../ui/expressive";
import { IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text, useTextWidth } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { DetailSheet } from "../schedule/details";
import { ClassSheet, classCard } from "./class-sheet";
import { nameOf, shortName } from "./parts";

type Item =
  | { kind: "class"; key: string; start: number; end: number; code: string; facts: ClassFacts }
  | { kind: "meeting"; key: string; start: number; end: number; code: string; meeting: TodayPlan["announced"][number] };

export function Later({ context, plan, courses, onCard }: { context: HomeContext; plan: TodayPlan; courses: readonly TermCourse[]; onCard: string | null }) {
  const t = useT();
  const now = useNow();
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
    .filter((item) => wibDay(item.start) === day && item.end > now && item.key !== onCard)
    .sort((a, b) => a.start - b.start);
  if (!items.length && !unread.length) return null;
  return (
    <View testID="section.today">
      <Rise screen="home" index={5}>
        <Text
          size="titleMedium"
          face="display"
          weight="bold"
          accessibilityRole="header"
          style={{ fontSize: 17, letterSpacing: -0.2, marginTop: space[6], marginBottom: space[3], marginLeft: space[1] }}
        >
          {t("mobile.home.laterToday")}
        </Text>
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
              courses={courses}
              onOpen={() =>
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
                )
              }
            />
          ))}
        </View>
      </Rise>
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
function Row({ item, first, last, courses, onOpen }: { item: Item; first: boolean; last: boolean; courses: readonly TermCourse[]; onOpen(): void }) {
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
      style={{ flexDirection: "row", alignItems: "stretch", gap: space[3], paddingHorizontal: space[1], minHeight: 64 }}
    >
      <Text
        size="bodyLarge"
        face="display"
        weight="bold"
        tabular
        style={{ color: v.fg, width: timeColumn, fontSize: 15, lineHeight: 21, paddingTop: space[3] }}
      >
        {f.time(item.start)}
      </Text>
      <View style={{ width: 12, alignItems: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: 2, height: 16, backgroundColor: first ? "transparent" : v.line }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tile(item.code).ink }} />
        <View style={{ width: 2, flex: 1, backgroundColor: last ? "transparent" : v.line }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: space[3] }}>
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
      {overlap && (
        // A clash: one icon and the word, the same pair Jadwal and Kuliah show.
        <View
          style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space[1] }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`clash.today.${item.key}`}
        >
          <Icons.Overlap size={16} weight="fill" color={v.ambFg} />
          <Text size="labelMedium" weight="semibold" style={{ color: v.ambFg }}>
            {t("mobile.home.chip.clash")}
          </Text>
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
