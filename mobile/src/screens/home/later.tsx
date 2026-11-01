// "Nanti hari ini" (round 2, v4): the classes and meetings still to come today, past the one on the now card. A row
// each: the course's tile, its name, "15:00 · R.SG PWK LT.6", and at most one chip for what matters today (no absences
// left, below target, a clash, a new time, not in SIX). A row opens the class's sheet. Hidden when nothing's left.
import { useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { wibDay } from "../../../../src/core/course-meetings";
import type { ClassFacts, HomeContext, NowCard, TodayPlan } from "../../../../src/core/needs";
import { type AbsenceTone, absenceInk, absenceTone } from "../../ui/absence";
import { Rise } from "../../ui/expressive";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { ClassSheet, classCard } from "./class-sheet";
import { nameOf } from "./parts";

type Item =
  | { kind: "class"; key: string; start: number; end: number; code: string; facts: ClassFacts }
  | { kind: "meeting"; key: string; start: number; end: number; code: string; meeting: TodayPlan["announced"][number] };

export function Later({ context, plan, courses, onCard }: { context: HomeContext; plan: TodayPlan; courses: readonly TermCourse[]; onCard: string | null }) {
  const t = useT();
  const now = useNow();
  const v = useTheme().v4;
  const [picked, setPicked] = useState<NowCard | null>(null);
  const day = wibDay(context.now);
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
  if (!items.length) return null;
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
        <View style={{ backgroundColor: v.card, borderRadius: 20, overflow: "hidden" }}>
          {items.map((item, i) => (
            <Row
              key={item.key}
              item={item}
              first={i === 0}
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
      <ClassSheet card={picked} courses={courses} open={picked !== null} onClose={() => setPicked(null)} />
    </View>
  );
}

function Row({ item, first, courses, onOpen }: { item: Item; first: boolean; courses: readonly TermCourse[]; onOpen(): void }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const name = item.kind === "class" ? nameOf(courses, item.code, item.facts.session.courseName) : nameOf(courses, item.code);
  const place = item.kind === "class" ? item.facts.session.room : item.meeting.meeting.online ? t("mobile.home.online") : null;
  const chip = chipOf(item);
  const ink = chip && absenceInk(v, chip.tone);
  return (
    <PressScale
      onPress={onOpen}
      testID={`row.today.${item.key}`}
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}
    >
      {!first && <View style={{ position: "absolute", top: 0, left: 70, right: 0, height: 1, backgroundColor: v.line }} />}
      <CourseTile code={item.code} name={name} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
          {name}
        </Text>
        <Text size="bodyMedium" tabular style={{ color: v.muted, marginTop: 2 }}>
          {[f.time(item.start), place].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {chip && ink && (
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: ink.bg }}>
          <Text size="labelMedium" weight="semibold" style={{ color: ink.fg }}>
            {t(chip.key)}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

type ChipKey =
  | "mobile.home.chip.noAbsences"
  | "mobile.home.chip.belowTarget"
  | "mobile.home.chip.clash"
  | "mobile.home.timeMoved"
  | "mobile.home.roomMoved"
  | "mobile.home.chip.notInSix";

/**
 * The row's one chip, the most pressing: no absences left, below target, a clash, a new time or room, not in SIX. The
 * absences take the app's absence scale (src/ui/absence.ts: "Jatah habis" amber, "Di bawah target" red); the rest amber.
 */
function chipOf(item: Item): { key: ChipKey; tone: AbsenceTone } | null {
  if (item.kind === "meeting") return item.meeting.maybeInSix ? null : { key: "mobile.home.chip.notInSix", tone: "amber" };
  const { facts } = item;
  const absence = absenceTone(facts.state);
  if (absence && (facts.state === "none" || facts.state === "out"))
    return { key: facts.state === "none" ? "mobile.home.chip.noAbsences" : "mobile.home.chip.belowTarget", tone: absence };
  if (facts.overlap) return { key: "mobile.home.chip.clash", tone: "amber" };
  if (facts.moved) return { key: facts.moved.usualStart !== null ? "mobile.home.timeMoved" : "mobile.home.roomMoved", tone: "amber" };
  return null;
}
