// What a part of Nilai or Rencana studi needs SIX for (src/app/screens/plan/six-needed.tsx), said
// where the part would be: what signing in unlocks and the button that does it ("Masuk ke SIX").
// While SIX is connecting, a calm line instead; when the session or the connection is the
// problem, the shell's banner already says so.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import type { DatasetName } from "../../../../src/core/models";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Card } from "../../ui/display";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

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
  const theme = useTheme();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  const changed = useChangedPage(datasets);
  if (changed && datasets.length) return <SixPageNote datasets={datasets} />;
  const signedOut = status.state === "signed-out";
  const connecting = status.state === "connecting" || status.state === "live";
  return (
    <Card
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4], paddingHorizontal: space[4], paddingVertical: space[4] }}
      testID="note.sixNeeded"
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: theme.color.fill, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="body" weight="semibold">
          {title}
        </Text>
        <Text size="small" tone="muted" style={{ marginTop: 2 }}>
          {connecting ? t("plan.loading") : signedOut ? body : t("plan.needSixWait")}
        </Text>
        {(signedOut || action) && (
          <View style={{ marginTop: space[3], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
            {signedOut && (
              <Button variant="primary" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
                {t("plan.signInSix")}
              </Button>
            )}
            {action}
          </View>
        )}
      </View>
    </Card>
  );
}
