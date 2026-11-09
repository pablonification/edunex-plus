// Kuliah without SIX, with nothing of it kept: where the count comes from, and the way in. (Round 3 took out the big
// number that led Kuliah: each row's meter says it, and "Perlu perhatian" heads the courses it counted.)
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useSignIn } from "../../shell/source-status";
import { BigButton } from "../../ui/big-button";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useCardStyle } from "../home/now";

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
