// The presence button with a word that isn't Edunex's: SIX's own "Tandai Hadir" (and, on a course's block, joining an
// online class). `ui/kit.tsx`'s `PresenceButton` always says "Isi Presensi"; this is the same shape, size and hand for
// the other word, so the two read as one part. It goes the day the kit's button takes a `word` (and an `icon`).
import type { IconName } from "../../ui/icons";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

export function HandButton({
  word,
  onPress,
  label,
  icon = "Hand",
  tone = "page",
  ink,
  wide = false,
  testID,
}: {
  word: string;
  onPress(): void;
  /** What a screen reader says (the course, and where it opens). */
  label?: string;
  icon?: IconName;
  /** "page": the brand's blue on the page. "course": white on a block of the course's colour, the words in `ink`. */
  tone?: "page" | "course";
  ink?: string;
  wide?: boolean;
  testID: string;
}) {
  const v = useTheme().v4;
  const fill = tone === "course" ? "#ffffff" : v.brand;
  const fg = tone === "course" ? (ink ?? "#14171c") : v.onBrand;
  const Glyph = Icons[icon];
  return (
    <PressScale
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label ?? word}
      style={{
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: fill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        alignSelf: wide ? "stretch" : "flex-start",
      }}
    >
      <Glyph size={20} color={fg} weight="fill" />
      <Text size="labelLarge" weight="bold" numberOfLines={1} style={{ color: fg, fontSize: 15, lineHeight: 20, letterSpacing: 0, flexShrink: 0 }}>
        {word}
      </Text>
    </PressScale>
  );
}
