// Stand-ins for two shared parts Foundations is writing in `ui/kit.tsx` (`PresenceButton`, `ClashMark`): the one
// "Isi Presensi" button and the one clash sign, the same on Beranda, Jadwal and Kuliah. When `ui/kit.tsx` has them,
// Kuliah's files import from there and this file goes.
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { Icons } from "../../ui/icons";
import { Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** The one button that marks attendance: a raised hand and its word ("Isi Presensi" in Edunex, "Tandai Hadir" in SIX). */
export function PresenceButton({
  children,
  onPress,
  label,
  quiet = false,
  testID = "action.presence",
}: {
  children: string;
  onPress: () => void;
  /** What a screen reader says (the course, and where it opens). */
  label?: string;
  /** Without SIX nobody can say it counts: the same part, outlined. */
  quiet?: boolean;
  testID?: string;
}) {
  const v = useTheme().v4;
  const ink = quiet ? v.fg : v.onBrand;
  return (
    <Tap
      feel="card"
      onPress={onPress}
      accessibilityLabel={label ?? children}
      testID={testID}
      style={{
        minHeight: 48,
        borderRadius: 24,
        paddingHorizontal: space[4],
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        flexShrink: 0,
        backgroundColor: quiet ? "transparent" : v.brand,
        borderWidth: quiet ? 1.5 : 0,
        borderColor: v.line,
      }}
    >
      <Icons.Hand size={20} weight="fill" color={ink} />
      <Text size="labelLarge" weight="semibold" style={{ color: ink }}>
        {children}
      </Text>
    </Tap>
  );
}

/** A clash's one sign: the overlapping squares and the word "Bentrok", in amber. */
export function ClashMark() {
  const t = useT();
  const v = useTheme().v4;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <Icons.Overlap size={18} weight="bold" color={v.ambFg} />
      <Text size="bodyMedium" weight="semibold" style={{ color: v.ambFg }}>
        {t("mobile.kuliah.clash.word")}
      </Text>
    </View>
  );
}
