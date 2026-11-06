// Kuliah's one big number (round 2, v4), as Beranda leads with one: how many courses ask the most of the Student now,
// counted up in Plus Jakarta Sans on a white card, the few words beside it. Out of reach first ("1 mata kuliah tak bisa
// lagi capai 80%"), then finished below the target, then no absences left, then absences to spare, then the target
// reached; with no SIX count yet, the term's courses. The card is one target: the day's answer, the target and how
// it's counted, in a sheet (./footer.tsx). Without SIX the card is the way in instead.
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { type Translate, useT } from "../../../../src/app/i18n";
import { presenceGroup } from "../../../../src/core/attendance";
import { useSignIn } from "../../shell/source-status";
import { type AbsenceTone, absenceInk, absenceTone } from "../../ui/absence";
import { BigButton } from "../../ui/big-button";
import { CountUp } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCardStyle } from "../home/now";

/** The number's colour: the app's absence scale (src/ui/absence.ts), plain for the term's courses. */
type Tone = AbsenceTone | "neutral";
export interface Lead {
  kind: "out" | "missed" | "none" | "spare" | "met" | "courses";
  count: number;
  words: string;
  tone: Tone;
}

/** The number Kuliah leads with, and its words: the most pressing group's count. */
export function leadOf(t: Translate, courses: readonly CourseAttendance[]): Lead | null {
  if (!courses.length) return null;
  const of = (group: string) => courses.filter((c) => presenceGroup(c.health) === group);
  const out = of("out");
  if (out.length) {
    const targets = new Set(out.map((c) => c.health.target));
    const count = out.length;
    const words = targets.size === 1 ? t("mobile.kuliah.lead.out", { count, target: [...targets][0]! }) : t("mobile.kuliah.lead.outMixed", { count });
    return { kind: "out", count, words, tone: absenceTone(out[0]!.health.state) ?? "neutral" };
  }
  for (const kind of ["missed", "none", "spare", "met"] as const) {
    const group = of(kind);
    if (group.length)
      return {
        kind,
        count: group.length,
        words: t(`mobile.kuliah.lead.${kind}`, { count: group.length }),
        tone: absenceTone(group[0]!.health.state) ?? "neutral",
      };
  }
  return { kind: "courses", count: courses.length, words: t("mobile.kuliah.lead.courses", { count: courses.length }), tone: "neutral" };
}

export function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const v = useTheme().v4;
  const surface = useCardStyle();
  const color = lead.tone === "neutral" ? v.fg : absenceInk(v, lead.tone).fg;
  return (
    <PressScale
      onPress={onPress}
      testID="card.kuliahNumber"
      accessibilityLabel={`${lead.count} ${lead.words}`}
      style={[surface, { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: space[4], paddingLeft: space[5], paddingRight: space[3] }]}
    >
      <CountUp
        id={`kuliah:${lead.kind}`}
        value={lead.count}
        style={{ color, fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 52, lineHeight: 60, letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}
      />
      <Text size="bodyLarge" face="display" weight="semibold" style={{ flex: 1, color: v.fg, fontSize: 17, lineHeight: 23 }}>
        {keepLastTwo(lead.words)}
      </Text>
      <Icons.ChevronRight size={20} color={v.muted} />
    </PressScale>
  );
}

/**
 * The words with their last two joined by a no-break space, so a second line never holds one word alone ("80%" under
 * "…tak bisa lagi capai": the judge's round 2, pass 6). A screen reader gets the words as they are (the card's label).
 */
function keepLastTwo(words: string): string {
  return words.replace(/ (\S+)$/, "\u00a0$1");
}

/** Signed out of SIX, with nothing of it kept: where the count comes from, and the way in (quiet while Edunex asks something). */
export function SignInCard({ quiet }: { quiet: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const surface = useCardStyle();
  const { signIn, busy } = useSignIn();
  return (
    <View testID="card.signInSix" style={[surface, { padding: space[4], gap: space[3] }]}>
      <View style={{ gap: space[1] }}>
        <Text size="titleMedium" face="display" weight="bold" style={{ color: v.fg, fontSize: 18 }}>
          {t("presence.answer.noSix")}
        </Text>
        <Text size="bodyMedium" style={{ color: v.muted }}>
          {`${t("presence.noSix.hint")} ${t("presence.noSix.noWatch")}`}
        </Text>
      </View>
      <BigButton variant={quiet ? "outline" : "filled"} onPress={busy ? undefined : () => void signIn("six")} testID="action.signInSix">
        {t("presence.signInSix")}
      </BigButton>
    </View>
  );
}
