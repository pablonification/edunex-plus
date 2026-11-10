// Beranda's strip (round 4): the Student's week in two or three numbers, under the now card, each a tap into its page.
// What's due in the next seven days (the Tugas tab), the courses at or past their absence limit (Presensi), and the
// days to the next exam (its page). A big number in the display face and a few words under it; colour only where it
// means something (red past a limit or a deadline, amber with no absences left). Attendance always has its tile once
// a course's count is known, so "is my attendance safe" is answered without a tap ("Aman"); the others are left out
// with nothing to say. Nothing worked out here: the rows are "Perlu kamu urus"'s (./urus.tsx: snoozed and handed-in
// things already out), the absences are ./problems.ts's, the exam is `attention`'s (src/core/needs).
import { router } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { HomeContext, Need } from "../../../../src/core/needs";
import { type Route, useNav } from "../../nav";
import { Skeleton } from "../../ui/display";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { DAY } from "./parts";
import type { Problems } from "./problems";
import type { UrusRow } from "./urus";

/** The strip's height (dp) at a font scale: its padding, the number's line, two lines of words. Its shape keeps it. */
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

export function Strip({ context, problems, rows, needs }: { context: HomeContext; problems: Problems; rows: readonly UrusRow[]; needs: readonly Need[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const tiles = useMemo(() => {
    const out: Tile[] = [];
    // What's due in the week ahead: "Perlu kamu urus"'s Task rows (a Presence handed in as a Task too), late ones in.
    const due = rows.filter(
      (row) =>
        row.kind === "todo" && (row.item.need.kind === "task" || (row.item.need.kind === "presence" && row.item.presenceTag)) && row.item.at < now + 7 * DAY,
    );
    if (due.length) {
      const label = t("mobile.home.strip.due");
      const late = due.some((row) => row.kind === "todo" && row.item.late);
      out.push({ id: "due", value: String(due.length), label, spoken: `${due.length} ${label}`, tone: late ? "red" : null, go: () => go({ screen: "tasks" }) });
    }
    // Attendance: once any course's count is known.
    const known = [...context.health.values()].some((health) => health.state !== "unknown");
    const risk = problems.absences.length;
    if (risk) {
      const over = problems.absences.some((item) => item.health.state === "out");
      out.push({
        id: "attendance",
        value: String(risk),
        label: t("mobile.home.strip.absences"),
        spoken: t("mobile.home.strip.absencesSpoken", { count: risk }),
        tone: over ? "red" : "amber",
        go: () => router.push("/presence"),
      });
    } else if (known) {
      const value = t("mobile.home.strip.absencesSafe");
      const label = t("mobile.home.strip.absencesSafeLabel");
      out.push({ id: "attendance", value, label, spoken: `${label}: ${value}`, tone: null, go: () => router.push("/presence") });
    }
    // The next exam: the soonest sitting still ahead (an open window: its close).
    const exam = needs
      .flatMap((need) => (need.kind === "exam" ? [{ need, at: need.sitting.start > now ? need.sitting.start : (need.at ?? need.sitting.start) }] : []))
      .sort((x, y) => x.at - y.at)[0];
    if (exam) {
      const kind = t(`exam.kind.${exam.need.exam.kind}`);
      const days = Math.max(0, f.dayOffset(exam.at));
      const value = days === 0 ? t("mobile.home.strip.examToday") : String(days);
      const label = days === 0 ? kind : t("mobile.home.strip.examDays", { count: days, kind });
      const route = exam.need.action.kind === "go" ? exam.need.action.route : ({ screen: "exam", examId: exam.need.exam.id } as Route);
      out.push({ id: "exam", value, label, spoken: `${value} ${label}`, tone: null, go: () => go(route) });
    }
    return out;
  }, [rows, problems, needs, context, now, t, f, go]);
  if (!tiles.length) return null;
  return (
    <StripCard>
      {tiles.map((tile, i) => (
        <StripTile key={tile.id} tile={tile} first={i === 0} />
      ))}
    </StripCard>
  );
}

function StripCard({ children, testID = "home.strip", busy }: { children: ReactNode; testID?: string; busy?: boolean }) {
  const v = useTheme().v4;
  const { fontScale } = useWindowDimensions();
  return (
    <View
      testID={testID}
      accessibilityState={busy ? { busy: true } : undefined}
      style={{ flexDirection: "row", backgroundColor: v.card, borderRadius: 20, minHeight: stripHeight(fontScale), overflow: "hidden" }}
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
          paddingHorizontal: space[3.5],
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
        <View key={i} style={{ flex: 1, paddingHorizontal: space[3.5], paddingVertical: space[3], gap: space[2] }}>
          <View style={{ height: 32, justifyContent: "center" }}>
            <Skeleton height={20} width={36} />
          </View>
          <Skeleton height={10} width="70%" />
        </View>
      ))}
    </StripCard>
  );
}
