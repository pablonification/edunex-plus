// The bottom tabs: the pages a Student opens most, in thumb's reach. Nilai, Rencana studi, the
// courses and Settings are under Lainnya. Each tab's badge is the desktop sidebar's count.
import { Tabs } from "expo-router";
import { useT } from "../../../src/app/i18n";
import { Icons } from "../../src/ui/icons";
import { useTheme } from "../../src/ui/theme";

export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
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
