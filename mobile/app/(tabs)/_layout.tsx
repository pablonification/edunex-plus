// The bottom tabs: Android's own navigation bar (expo-router's NativeTabs, a Material
// BottomNavigationView through react-native-screens), five jobs a Student has every day (PROGRESS.md,
// "The new shape of the app"): Beranda, Jadwal, Tugas, Kuliah (the courses with their absences left,
// once Presensi) and Akademik (IPK, Nilai, the study plan, KRS, UKT). Every tab is mounted ahead, so a
// switch is instant and each keeps its scroll; a second tap on the open tab scrolls it to the top.
// Labels always show. The icons are the app's own Phosphor glyphs as Android drawables
// (plugins/tab-icons.js), outlined at rest and filled when picked. The badges come a moment after Beranda's first frame
// (`TabBadges`): working them out (every Task and exam, every course's absences, the KRS and the bills) held the splash
// up for numbers on tabs the Student hasn't looked at yet.
import { NativeTabs } from "expo-router/native-tabs";
import { startTransition, useEffect, useState } from "react";
import { useRememberCourseColors } from "../../../src/app/course-colors";
import { useTermCourses } from "../../../src/app/courses";
import { useT } from "../../../src/app/i18n";
import { type Badge, usePlanBadge, usePresenceBadge, useTasksBadge } from "../../../src/app/shell/badges";
import { perfDoing } from "../../src/perf";
import { useFirstFrameShown } from "../../src/shell/first-frame";
import { InTabs } from "../../src/ui/insets";
import { useTheme } from "../../src/ui/theme";

/**
 * A tab's badge, Material's (the error colour): only what needs the Student today (the desktop's amber ⚠ counts). A
 * plain count (six Tasks to do) stays on the tab's page: a red number that never goes away teaches the Student to
 * stop reading badges.
 */
function badgeOf(badge: Badge): string | undefined {
  return badge?.tone === "warning" ? String(badge.value) : undefined;
}

/** A tab's name for a screen reader, its count with it: "Kuliah, 1, Perlu perhatianmu" (the desktop's). */
function tabLabel(t: ReturnType<typeof useT>, title: string, badge: Badge): string {
  if (!badge) return title;
  return badge.tone === "warning" ? `${title}, ${badge.value}, ${t("home.needs")}` : `${title}, ${badge.value}`;
}

export default function TabsLayout() {
  const t = useT();
  const c = useTheme().color;
  const courses = useTermCourses();
  // Each course's automatic color, remembered the first time it shows, so it never moves by itself (the desktop's sidebar does this).
  useRememberCourseColors(courses?.map((course) => course.code));
  const [{ tasks, presence, plan }, setBadges] = useState<Badges>(NO_BADGES);
  const counting = useFirstFrameShown();
  const tabs = [
    { name: "index", title: t("nav.home"), id: "home", icon: "home", badge: null },
    { name: "schedule", title: t("nav.schedule"), id: "schedule", icon: "schedule", badge: null },
    { name: "tasks", title: t("mobile.tab.tasks"), id: "tasks", icon: "tasks", badge: tasks },
    { name: "courses", title: t("mobile.tab.courses"), id: "courses", icon: "courses", badge: presence },
    { name: "academic", title: t("mobile.tab.academic"), id: "academic", icon: "academic", badge: plan },
  ] as const;
  return (
    <InTabs.Provider value>
      <NativeTabs
        backgroundColor={c.surfaceContainer}
        indicatorColor={c.secondaryContainer}
        rippleColor={c.selected}
        iconColor={{ default: c.onSurfaceVariant, selected: c.onSecondaryContainer }}
        labelStyle={{
          default: { color: c.onSurfaceVariant, fontSize: 12, fontWeight: "500" },
          selected: { color: c.onSurface, fontSize: 12, fontWeight: "600" },
        }}
        badgeBackgroundColor={c.error}
        badgeTextColor={c.onError}
        labelVisibilityMode="labeled"
      >
        {tabs.map((tab) => (
          <NativeTabs.Trigger
            key={tab.name}
            name={tab.name}
            testID={`tab.${tab.id}`}
            accessibilityLabel={tabLabel(t, tab.title, tab.badge)}
            contentStyle={{ backgroundColor: c.surface }}
          >
            <NativeTabs.Trigger.Icon drawable={{ default: `tab_${tab.icon}`, selected: `tab_${tab.icon}_filled` }} />
            <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Badge hidden={!badgeOf(tab.badge)}>{badgeOf(tab.badge)}</NativeTabs.Trigger.Badge>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
      {counting && <TabBadges onChange={setBadges} />}
    </InTabs.Provider>
  );
}

interface Badges {
  tasks: Badge;
  presence: Badge;
  plan: Badge;
}

const NO_BADGES: Badges = { tasks: null, presence: null, plan: null };

/** The tabs' badges, worked out from the first frame on; the tabs hear of them only when one changes. */
function TabBadges({ onChange }: { onChange(badges: Badges): void }) {
  // A stall as they're first worked out is theirs (later ones are the data's, named by the dataset).
  useState(() => perfDoing("the tabs' badges"));
  const tasks = useTasksBadge();
  const presence = usePresenceBadge();
  // Akademik carries what's to do there (send the KRS, pay the UKT); a clash to ask about stays on its row.
  const planCount = usePlanBadge();
  const plan = planCount?.tone === "warning" ? planCount : null;
  const key = JSON.stringify([tasks, presence, plan]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the three badges, said the same way when they are
  useEffect(() => startTransition(() => onChange({ tasks, presence, plan })), [key, onChange]);
  return null;
}
