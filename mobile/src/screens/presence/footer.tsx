// What Kuliah says once for every course, one tap deeper (round 2, v4: no explanatory sentences on a tab's first
// screen): the big number's sheet, also in ⋮ as "Cara menghitungnya". The answer for the next class day ("Hari ini ada 4
// kuliah. Hanya PL3002 yang masih ada jatah absen."), the target, how attendance is recorded and up to when SIX's
// timetable is read (src/app/screens/presence.tsx's Footer), how to read the absences (its BudgetKey, drawn with the
// phone's pips), and how it's counted (its HowCounted), with SIX's timetable a press away. Words are the desktop's.
import type { ReactNode } from "react";
import { View } from "react-native";
import type { Attendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { dayAnswer } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import { sixTimetableUrl } from "../../../../src/core/links";
import { type AbsenceTone, absenceInk } from "../../ui/absence";
import { BigButton } from "../../ui/big-button";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { dayLabel, footerDates, noonOf, targetRange } from "./logic";

export function FactsSheet({ attendance, open, onClose }: { attendance: Attendance; open: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open6 = useOpenExternal();
  const student = useDataset("six.student");
  const { courses, lastDay, sixConnected } = attendance;
  const targets = courses.map((c) => c.health.target);
  const [low, high] = [Math.min(...targets), Math.max(...targets)];
  // Said while lectures run: how it's recorded, and the dates (later classes estimated from the weekly slot).
  const running = sixConnected && courses.length > 0 && !(lastDay !== null && wibDay(now) > lastDay);
  const date = lastDay ? dayLabel(f, noonOf(lastDay)) : "-";
  const points = [
    t("presence.how.six"),
    t("presence.how.left", { date }),
    t("presence.how.uncertain"),
    t("presence.how.edunex"),
    t("presence.how.target"),
    t("presence.how.check"),
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      background={v.card}
      testID="sheet.kuliahFacts"
      title={
        <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg }}>
          {t("mobile.kuliah.facts")}
        </Text>
      }
    >
      <View style={{ gap: space[3] }}>
        {sixConnected && <DayLine attendance={attendance} />}
        {sixConnected && courses.length > 0 && (
          <Said icon={<Icons.Target size={18} color={v.muted} />}>{t("presence.target", { value: low === high ? low : `${low}–${high}` })}</Said>
        )}
        {running && <Said icon={<Icons.Hand size={18} color={v.muted} />}>{t("presence.footer")}</Said>}
        {running && <Said icon={<Icons.Calendar size={18} color={v.muted} />}>{footerDates(t, f, attendance)}</Said>}
      </View>
      {sixConnected && courses.length > 0 && <BudgetKey target={targetRange(courses)} />}
      <Text
        size="titleMedium"
        face="display"
        weight="bold"
        accessibilityRole="header"
        style={{ color: v.fg, fontSize: 17, marginTop: space[6], marginBottom: space[2] }}
      >
        {t("presence.how")}
      </Text>
      <View style={{ gap: space[2] }}>
        {points.map((point) => (
          <View key={point} style={{ flexDirection: "row", gap: space[2] }}>
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {"•"}
            </Text>
            <Text size="bodyMedium" style={{ color: v.fg2, flex: 1 }}>
              {point}
            </Text>
          </View>
        ))}
      </View>
      {student && (
        <View style={{ marginTop: space[5], marginBottom: space[2] }}>
          <BigButton
            variant="outline"
            icon={<Icons.ArrowUpRight size={18} color={v.fg} />}
            onPress={() => open6(sixTimetableUrl(student))}
            testID="action.openSix"
          >
            {t("presence.openSix")}
          </BigButton>
        </View>
      )}
    </Sheet>
  );
}

function Said({ icon, children }: { icon: ReactNode; children: string }) {
  const v = useTheme().v4;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
      <View style={{ paddingTop: 2 }}>{icon}</View>
      <Text size="bodyMedium" style={{ color: v.fg2, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** "Hari ini, hanya PL3002 yang masih ada jatah absen.", or the next class day, or when lectures ended. */
function DayLine({ attendance }: { attendance: Attendance }): ReactNode {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const unread = useDataset("six.scheduleUnread");
  const answer = dayAnswer(
    attendance.courses.map((c) => c.health),
    attendance.schedule,
    attendance.period,
    now,
    unread,
  );
  if (!answer) return null;
  const line = (text: string) => (
    <Text size="bodyLarge" testID="line.kuliahDay" style={{ color: v.fg, marginBottom: space[1] }}>
      {text}
    </Text>
  );
  if (answer.kind === "ended") return line(t("presence.ended", { date: dayLabel(f, noonOf(answer.lastDay)) }));
  // A class SIX shows that the app couldn't read: counted on its day, and said, with where to look.
  const unreadLine = answer.unread ? ` ${t("presence.day.unread", { count: answer.unread })}` : "";
  if (answer.kind === "next") return line(`${t("presence.day.next", { day: dayLabel(f, answer.at) })}${unreadLine}`);
  // As src/app/screens/presence.tsx's DayLine: the answer stands alone, how many classes the day has said only without one.
  const count = t(answer.day === "today" ? "presence.day.today" : "presence.day.tomorrow", { count: answer.count });
  const { spare } = answer;
  const day = t(answer.day === "today" ? "presence.day.when.today" : "presence.day.when.tomorrow");
  // Said only of the courses SIX has a count for; with some still uncounted (or one course that day), they're named
  // instead of "only" or "each".
  const named = spare && { day, codes: f.list(spare.codes), count: spare.codes.length };
  const answerLine =
    !spare || !named
      ? count
      : spare.of < spare.courses || spare.of === 1
        ? spare.codes.length
          ? t("presence.day.some", named)
          : spare.courses === 1
            ? `${count} ${t("presence.day.oneNone")}`
            : count
        : spare.codes.length === spare.of
          ? t("presence.day.all", { day })
          : spare.codes.length === 0
            ? t("presence.day.none", { day })
            : t("presence.day.only", named);
  return line(`${answerLine}${unreadLine}`);
}

/**
 * The key to the absences (the desktop's BudgetKey), drawn as the phone draws them on a class's and a course's sheet:
 * one pip per absence, used in the absence scale's colour (src/ui/absence.ts), still allowed in the track's. What a
 * pip, a full row and a row past the limit mean, with the words the rows use.
 */
function BudgetKey({ target }: { target: string }) {
  const t = useT();
  const v = useTheme().v4;
  const examples: { key: string; used: number; left: number; tone: AbsenceTone; word: string; means: string }[] = [
    { key: "left", used: 1, left: 2, tone: "ok", word: t("presence.bar.left", { count: 2 }), means: t("presence.key.left") },
    { key: "none", used: 3, left: 0, tone: "amber", word: t("presence.bar.noneLeft"), means: t("presence.key.none") },
    { key: "over", used: 4, left: 0, tone: "red", word: t("presence.bar.over", { count: 1 }), means: t("presence.key.over", { target }) },
  ];
  return (
    <View testID="note.budgetKey" style={{ marginTop: space[6], gap: space[3] }}>
      <View style={{ gap: space[1] }}>
        <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg, fontSize: 17 }}>
          {t("presence.key.title")}
        </Text>
        <Text size="bodyMedium" style={{ color: v.fg2 }}>
          {t("presence.key.lead", { target })}
        </Text>
      </View>
      {examples.map((example) => {
        const ink = example.tone === "ok" ? v.fg : absenceInk(v, example.tone).fg;
        const pip = example.tone === "ok" ? v.muted : absenceInk(v, example.tone).fg;
        return (
          <View key={example.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
            <View
              style={{ flexDirection: "row", gap: 4, width: 4 * 18 + 3 * 4, paddingTop: 7 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {Array.from({ length: example.used + example.left }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: pips are positions
                <View key={i} style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: i < example.used ? pip : v.line }} />
              ))}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="bodyMedium" weight="semibold" tabular style={{ color: ink }}>
                {example.word}
              </Text>
              <Text size="bodyMedium" style={{ color: v.muted }}>
                {example.means}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
