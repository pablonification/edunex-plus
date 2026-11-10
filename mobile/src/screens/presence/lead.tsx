// Kuliah without SIX, with nothing of it kept: said once, on one line at the top (never on each course): where the
// count comes from, and the way in.
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** Signed out of SIX: "Jatah absen dihitung dari SIX" and "Masuk ke SIX" (quiet while Edunex asks something). */
export function SignInCard({ quiet }: { quiet: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const { signIn, busy } = useSignIn();
  return (
    <View testID="card.signInSix" style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56 }}>
      <Text size="bodyLarge" style={{ flex: 1, minWidth: 0, color: v.fg2 }}>
        {t("presence.answer.noSix")}
      </Text>
      <Button variant={quiet ? "secondary" : "tonal"} size="sm" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
        {t("presence.signInSix")}
      </Button>
    </View>
  );
}
