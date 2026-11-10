// Beranda's strip (round 4): the three daily questions in numbers, under the now card, each a tap into its page. What's
// due today (red), or with nothing today in the next seven days, "0" when nothing is (the Tugas tab); the courses at or
// past their absence limit, "Aman" when none (Kuliah); the days to the next exam (its page), left out with none ahead.
// A big number in the display face and a few words under it; colour only where it means something (red for a deadline
// today or a course past its limit, amber at it). Each fact is said here once: "Perlu kamu urus" on Beranda leaves out
// what the strip counts (./strip-facts.ts). Nothing worked out here: the rows are "Perlu kamu urus"'s (./urus.tsx:
// snoozed and handed-in things already out), the absences are ./problems.ts's, the exam is `attention`'s (src/core/needs).
import { type ReactNode, useMemo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { HomeContext } from "../../../../src/core/needs";
import { type Route, useNav } from "../../nav";
import { Skeleton } from "../../ui/display";
import { factsLabel } from "../../ui/layout";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import type { Problems } from "./problems";
import type { StripFacts } from "./strip-facts";

/** The shape's height (dp) at a font scale: its padding, the number's line, two lines of words, as most tiles have. */
export const stripHeight = (fontScale: number) => space[3] + space[0.5] + space[3] + (32 + 32) * fontScale;

type Tone = "red" | "amber" | null;

interface Tile {
  id: "due" | "attendance" | "exam";
  value: string;
  label: string;
  spoken: string;
  tone: Tone;
  go(): void;
}

export function Strip({ context, problems, facts }: { context: HomeContext; problems: Problems; facts: StripFacts }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const tiles = useMemo(() => {
    const out: Tile[] = [];
    // Due: always there, so "what's due today" is answered without a tap.
    const count = facts.due.size;
    out.push({
      id: "due",
      value: String(count),
      label: t(facts.today ? "mobile.home.strip.dueToday" : "mobile.home.strip.due"),
      spoken: t(facts.today ? "mobile.home.strip.dueTodaySpoken" : "mobile.home.strip.dueSpoken", { count }),
      tone: facts.today || facts.late ? "red" : null,
      go: () => go({ screen: "tasks" }),
    });
    // Attendance: once any course's count is known.
    const known = [...context.health.values()].some((health) => health.state !== "unknown");
    const risk = problems.absences.length;
    const toCourses = () => go({ screen: "presence" });
    if (risk) {
      const over = problems.absences.filter((item) => item.health.state === "out").length;
      out.push({
        id: "attendance",
        value: String(risk),
        label: t("mobile.home.strip.absences"),
        spoken: factsLabel(t("mobile.home.strip.absencesSpoken", { count: risk }), over > 0 && t("mobile.home.strip.absencesOverSpoken", { count: over })),
        tone: over ? "red" : "amber",
        go: toCourses,
      });
    } else if (known) {
      const value = t("mobile.home.strip.absencesSafe");
      const label = t("mobile.home.strip.absencesSafeLabel");
      out.push({ id: "attendance", value, label, spoken: `${label}: ${value}`, tone: null, go: toCourses });
    }
    const { exam } = facts;
    if (exam) {
      const kind = t(`exam.kind.${exam.need.exam.kind}`);
      const days = Math.max(0, f.dayOffset(exam.at));
      const value = days === 0 ? t("mobile.home.strip.examToday") : String(days);
      const label = days === 0 ? kind : t("mobile.home.strip.examDays", { count: days, kind });
      const route = exam.need.action.kind === "go" ? exam.need.action.route : ({ screen: "exam", examId: exam.need.exam.id } as Route);
      out.push({ id: "exam", value, label, spoken: `${value} ${label}`, tone: null, go: () => go(route) });
    }
    return out;
  }, [facts, problems, context, t, f, go]);
  return (
    <StripCard>
      {tiles.map((tile, i) => (
        <StripTile key={tile.id} tile={tile} first={i === 0} />
      ))}
    </StripCard>
  );
}

/** The tiles in one white card, hairlines between them; as tall as its words (the shape: as the usual two lines). */
function StripCard({ children, testID = "home.strip", busy }: { children: ReactNode; testID?: string; busy?: boolean }) {
  const v = useTheme().v4;
  const { fontScale } = useWindowDimensions();
  return (
    <View
      testID={testID}
      accessibilityState={busy ? { busy: true } : undefined}
      style={{ flexDirection: "row", backgroundColor: v.card, borderRadius: 20, minHeight: busy ? stripHeight(fontScale) : undefined, overflow: "hidden" }}
    >
      {children}
    </View>
  );
}

function StripTile({ tile, first }: { tile: Tile; first: boolean }) {
  const v = useTheme().v4;
  const ink = tile.tone === "red" ? v.redFg : tile.tone === "amber" ? v.ambFg : v.fg;
  return (
    <Pressable
      onPress={tile.go}
      accessibilityRole="button"
      accessibilityLabel={tile.spoken}
      testID={`strip.${tile.id}`}
      android_ripple={{ color: v.line }}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: 0,
          paddingHorizontal: space[3],
          paddingVertical: space[3],
          gap: space[0.5],
          borderLeftWidth: first ? 0 : 1,
          borderLeftColor: v.line,
        },
        iosPressed(pressed),
      ]}
    >
      <Text face="display" weight="bold" tabular numberOfLines={1} style={{ color: ink, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
        {tile.value}
      </Text>
      <Text size="labelMedium" weight="medium" numberOfLines={2} style={{ color: tile.tone ? ink : v.muted }}>
        {tile.label}
      </Text>
    </Pressable>
  );
}

/** The strip's shape before the data: three tiles' numbers and words in their place, the same height. */
export function StripShape() {
  return (
    <StripCard testID="home.strip.reading" busy>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flex: 1, paddingHorizontal: space[3], paddingVertical: space[3], gap: space[2] }}>
          <View style={{ height: 32, justifyContent: "center" }}>
            <Skeleton height={20} width={36} />
          </View>
          <Skeleton height={10} width="70%" />
        </View>
      ))}
    </StripCard>
  );
}
