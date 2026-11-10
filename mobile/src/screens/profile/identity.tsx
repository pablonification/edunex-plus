// Who the Student is, Profil's hero (round 4): straight on the page, centred, no card. A large circle with their
// initials (as the top bars' avatar drew them before round 4), their name as the screen's one title, then the NIM and the
// program as one quiet line. Edunex's account first, else SIX's (Settings' card read them the same way before).
import { View } from "react-native";
import { displayName, initials } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

const AVATAR = 88;

export function Identity() {
  const v = useTheme().v4;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const facts = factsLabel(account?.nim ?? student?.nim, student?.program);
  const shown = name ? displayName(name) : null;
  return (
    <View testID="profile.identity" style={{ alignItems: "center", paddingTop: space[4], paddingBottom: space[2], gap: space[3] }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}
      >
        {name ? (
          <Text face="display" weight="bold" style={{ fontSize: 34, lineHeight: 42, color: v.brandInk }}>
            {initials(name)}
          </Text>
        ) : (
          <Icons.User size={40} color={v.brandInk} />
        )}
      </View>
      {shown ? (
        <View style={{ alignItems: "center", gap: space[1], paddingHorizontal: space[4] }} accessible accessibilityLabel={factsLabel(shown, facts)}>
          <Text
            size="headlineSmall"
            face="display"
            weight="bold"
            accessibilityRole="header"
            numberOfLines={2}
            style={{ color: v.fg, textAlign: "center", letterSpacing: -0.3 }}
          >
            {shown}
          </Text>
          {facts ? (
            <Text size="bodyMedium" style={{ color: v.muted, textAlign: "center" }}>
              {facts}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
