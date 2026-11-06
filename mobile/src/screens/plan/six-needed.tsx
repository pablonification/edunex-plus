// What a part of Nilai or Rencana studi needs SIX for (src/app/screens/plan/six-needed.tsx), said
// where the part would be: what signing in unlocks and the button that does it ("Masuk ke SIX").
// While SIX is connecting, a calm line instead. A session that ended gets its own "Masuk lagi"
// here too: on a phone the banner at the top may be scrolled away from the card. Offline, the
// banner says so and the card waits.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import type { DatasetName } from "../../../../src/core/models";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Panel } from "../../ui/group";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/** `datasets`: what the part shows from SIX; when that page changed before it was ever read, the part says so instead of waiting. */
export function SixNeeded({
  icon,
  title,
  body,
  action,
  datasets = [],
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  datasets?: readonly DatasetName[];
}) {
  const t = useT();
  const v = useTheme().v4;
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  const changed = useChangedPage(datasets);
  if (changed && datasets.length) return <SixPageNote datasets={datasets} />;
  const signedOut = status.state === "signed-out";
  const expired = status.state === "expired";
  const connecting = status.state === "connecting" || status.state === "live";
  return (
    // v4: a white card on the page's grey, its icon in a tinted square.
    <Panel style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4], padding: space[5] }} testID="note.sixNeeded">
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.chip, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="semibold" style={{ color: v.fg }}>
          {title}
        </Text>
        <Text size="bodyMedium" style={{ marginTop: 2, color: v.muted }}>
          {connecting ? t("plan.loading") : signedOut || expired ? body : t("plan.needSixWait")}
        </Text>
        {(signedOut || expired || action) && (
          <View style={{ marginTop: space[3], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
            {(signedOut || expired) && (
              <Button variant="primary" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
                {expired ? t("action.signInAgain") : t("plan.signInSix")}
              </Button>
            )}
            {action}
          </View>
        )}
      </View>
    </Panel>
  );
}
