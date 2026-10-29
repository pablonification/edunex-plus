// The bottom tabs: the pages a Student opens most, in thumb's reach. Nilai, Rencana studi, the
// courses and Settings are under Lainnya. Each tab's badge is the desktop sidebar's count.
import { Tabs } from "expo-router";
import { useRememberCourseColors } from "../../../src/app/course-colors";
import { useTermCourses } from "../../../src/app/courses";
import { useT } from "../../../src/app/i18n";
import { type Badge, usePresenceBadge, useTasksBadge } from "../../../src/app/shell/badges";
import { Icons } from "../../src/ui/icons";
import { useTheme } from "../../src/ui/theme";

/** A tab's count, as the desktop sidebar's: grey says how many, amber that one needs the Student today. */
function badgeOf(badge: Badge, c: { warningBg: string; warningFg: string; neutralBg: string; neutralFg: string }) {
  if (!badge) return {};
  const warning = badge.tone === "warning";
  return {
    tabBarBadge: badge.value,
    tabBarBadgeStyle: { backgroundColor: warning ? c.warningBg : c.neutralBg, color: warning ? c.warningFg : c.neutralFg, fontSize: 11 },
  };
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
          ...badgeOf(tasks, c),
          tabBarIcon: ({ color, focused }) => <Icons.ListChecks color={color as string} size={24} weight={focused ? "bold" : "regular"} />,
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
          ...badgeOf(presence, c),
          tabBarIcon: ({ color, focused }) => <Icons.Hand color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("mobile.tab.more"),
          tabBarButtonTestID: "tab.more",
          tabBarIcon: ({ color, focused }) => <Icons.LayoutGrid color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
    </Tabs>
  );
}
