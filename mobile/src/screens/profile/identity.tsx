// Who the Student is, Profil's identity (round 4): one row straight on the page, no card. A 56 dp circle with their
// initials at the start, then their name as the screen's one title over the NIM and the program as one quiet line,
// start-aligned. 56 dp tall (with the page's 16 dp over it, 72): the avatar marks the tab as Profil without taking the
// top third. Edunex's account first, else SIX's (Settings' card read them the same way before).
import { View } from "react-native";
import { displayName, initials } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

const AVATAR = 56;

export function Identity() {
  const v = useTheme().v4;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const facts = factsLabel(account?.nim ?? student?.nim, student?.program);
  const shown = name ? displayName(name) : null;
  return (
    <View testID="profile.identity" style={{ flexDirection: "row", alignItems: "center", gap: space[3.5], minHeight: AVATAR }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}
      >
        {name ? (
          <Text face="display" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: v.brandInk }}>
            {initials(name)}
          </Text>
        ) : (
          <Icons.User size={28} color={v.brandInk} />
        )}
      </View>
      {shown ? (
        <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={factsLabel(shown, facts)}>
          <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" numberOfLines={1} style={{ color: v.fg, letterSpacing: -0.3 }}>
            {shown}
          </Text>
          {facts ? (
            <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted }}>
              {facts}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
