// The bottom tabs: the pages a Student opens most, in thumb's reach. Nilai, Rencana studi, the
// courses and Settings are under Lainnya. Each tab's badge is the desktop sidebar's count.
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useRememberCourseColors } from "../../../src/app/course-colors";
import { useTermCourses } from "../../../src/app/courses";
import { useT } from "../../../src/app/i18n";
import { type Badge, usePlanBadge, usePresenceBadge, useTasksBadge } from "../../../src/app/shell/badges";
import { Icons } from "../../src/ui/icons";
import { Text } from "../../src/ui/text";
import { useTheme } from "../../src/ui/theme";

/**
 * A tab's count, as the desktop sidebar's: grey says how many, amber with ⚠ that one needs the Student
 * today. Drawn by the app (not the tab bar's own badge) beside the icon's top corner, so it never covers
 * the icon, with the bar's colour around it.
 */
function TabIcon({ badge, children }: { badge: Badge; children: ReactNode }) {
  const theme = useTheme();
  const c = theme.color;
  const warning = badge?.tone === "warning";
  return (
    <View style={{ width: 24, height: 24 }}>
      {children}
      {badge && (
        <View
          style={{
            position: "absolute",
            left: 19,
            top: -7,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: c.sidebar,
            justifyContent: "center",
            backgroundColor: warning ? c.warningBg : c.neutralBg,
          }}
        >
          {warning && <Icons.AlertTriangle size={9} weight="bold" color={c.warningFg} />}
          <Text size="micro" weight="semibold" tabular style={{ color: warning ? c.warningFg : c.neutralFg, fontSize: 11, lineHeight: 14 }}>
            {String(badge.value)}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A tab's name for a screen reader, its count with it: "Presensi, 1, Perlu perhatianmu" (the desktop's). */
function tabLabel(t: ReturnType<typeof useT>, title: string, badge: Badge): string {
  if (!badge) return title;
  return badge.tone === "warning" ? `${title}, ${badge.value}, ${t("home.needs")}` : `${title}, ${badge.value}`;
}

export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const courses = useTermCourses();
  // Each course's automatic color, remembered the first time it shows, so it never moves by itself (the desktop's sidebar does this).
  useRememberCourseColors(courses?.map((course) => course.code));
  const tasks = useTasksBadge();
  const presence = usePresenceBadge();
  // Rencana studi's count lives under Lainnya: the tab carries it, so it's seen without opening Lainnya.
  const plan = usePlanBadge();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentFg,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.sidebar, borderTopColor: c.edge },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
        sceneStyle: { backgroundColor: c.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarButtonTestID: "tab.home",
          tabBarIcon: ({ color, focused }) => <Icons.Home color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("mobile.tab.tasks"),
          tabBarButtonTestID: "tab.tasks",
          tabBarAccessibilityLabel: tabLabel(t, t("mobile.tab.tasks"), tasks),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon badge={tasks}>
              <Icons.ListChecks color={color as string} size={24} weight={focused ? "bold" : "regular"} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("nav.schedule"),
          tabBarButtonTestID: "tab.schedule",
          tabBarIcon: ({ color, focused }) => <Icons.Calendar color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="presence"
        options={{
          title: t("nav.presence"),
          tabBarButtonTestID: "tab.presence",
          tabBarAccessibilityLabel: tabLabel(t, t("nav.presence"), presence),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon badge={presence}>
              <Icons.Hand color={color as string} size={24} weight={focused ? "fill" : "regular"} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("mobile.tab.more"),
          tabBarButtonTestID: "tab.more",
          tabBarAccessibilityLabel: tabLabel(t, t("mobile.tab.more"), plan),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon badge={plan}>
              <Icons.LayoutGrid color={color as string} size={24} weight={focused ? "fill" : "regular"} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
