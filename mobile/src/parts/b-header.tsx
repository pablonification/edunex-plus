// Direction B's top of a tab: no bar, just the tab's name big on the white page (the official app's "Explore
// Courses", in Indonesian) with the data's status under it only when it says something, then Search and the bell,
// regular Fluent glyphs, always in the same place. No avatar: the Student is the Profil tab. A tap on the name opens
// the sources' sheet, as before.

import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { ProblemBanner, StatusLine, SyncPanel, useSyncText, useUnreadAlerts } from "../shell/source-status";
import { useB } from "../ui/b";
import { IconButton } from "../ui/controls";
import { Fluent } from "../ui/fluent";
import { useTopInset } from "../ui/insets";
import { Tap } from "../ui/moves";
import { PressScale } from "../ui/press";
import { Text } from "../ui/text";
import { space, TOUCH } from "../ui/theme";

/**
 * The bell, with a dot while something new is unread: the way to Notifikasi from every tab. `filled`: on Beranda's
 * row, a circle of that side on the search bar's own fill, so the row's three things are one height (48 dp to touch).
 */
export function BellButton({ filled }: { filled?: number } = {}) {
  const t = useT();
  const b = useB();
  const unread = useUnreadAlerts();
  const label = unread > 0 ? t("alerts.open", { count: unread }) : t("alerts.title");
  const open = () => router.push("/alerts");
  if (filled !== undefined) {
    const reach = Math.max(0, (TOUCH - filled) / 2);
    return (
      <View>
        <PressScale
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={label}
          testID="action.alerts"
          hitSlop={{ top: reach, bottom: reach, left: reach, right: reach }}
          style={{ width: filled, height: filled, borderRadius: filled / 2, backgroundColor: b.soft, alignItems: "center", justifyContent: "center" }}
        >
          {/* The bell a little smaller in the smaller circle, so it sits in it as the magnifier sits in the bar. */}
          <Fluent name="Alert24Regular" size={filled < 44 ? 22 : 24} color={b.fg} />
        </PressScale>
        {unread > 0 && (
          <View
            pointerEvents="none"
            testID="badge.alerts"
            style={{
              position: "absolute",
              top: filled / 2 - (filled < 44 ? 11 : 13),
              right: filled / 2 - (filled < 44 ? 10 : 12),
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: b.red,
              borderWidth: 2,
              borderColor: b.soft,
            }}
          />
        )}
      </View>
    );
  }
  return (
    <View>
      <IconButton label={label} onPress={open} testID="action.alerts">
        <Fluent name="Alert24Regular" color={b.fg} />
      </IconButton>
      {unread > 0 && (
        <View
          pointerEvents="none"
          testID="badge.alerts"
          style={{
            position: "absolute",
            top: 11,
            right: 12,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: b.red,
            borderWidth: 2,
            borderColor: b.page,
          }}
        />
      )}
    </View>
  );
}

export function BTabHeader({ title, actions, search = true }: { title: string; actions?: ReactNode; search?: boolean }) {
  const t = useT();
  const b = useB();
  const top = useTopInset();
  const sync = useSyncText();
  const [panel, setPanel] = useState(false);
  return (
    <View style={{ backgroundColor: b.page }}>
      <View style={{ marginTop: top, flexDirection: "row", alignItems: "center", paddingLeft: space[5], paddingRight: space[2], minHeight: 64 }}>
        <Tap
          feel="row"
          testID="action.syncStatus"
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${t("sync.title")}: ${sync}`}
          onPress={() => setPanel(true)}
          style={{ flex: 1, minWidth: 0, minHeight: TOUCH, justifyContent: "center" }}
        >
          <Text size="headlineSmall" face="display" weight="bold" numberOfLines={1} accessibilityRole="header" style={{ color: b.fg, letterSpacing: -0.4 }}>
            {title}
          </Text>
          <StatusLine />
        </Tap>
        {actions}
        {search && (
          <IconButton label={t("search.open")} onPress={() => router.push("/search")} testID="action.search">
            <Fluent name="Search24Regular" color={b.fg} />
          </IconButton>
        )}
        <BellButton />
      </View>
      <ProblemBanner />
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </View>
  );
}
