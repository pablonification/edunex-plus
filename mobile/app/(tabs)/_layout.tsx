// The bottom tabs: Android's own navigation bar (expo-router's NativeTabs, a Material
// BottomNavigationView through react-native-screens), five jobs a Student has every day (PROGRESS.md,
// "The new shape of the app"): Beranda, Jadwal, Tugas, Kuliah (the courses with their absences left,
// once Presensi) and Profil (the Student, their IPK, Nilai, the study plan, KRS, UKT, Settings and the account). Every tab is mounted ahead, so a
// switch is instant and each keeps its scroll; a second tap on the open tab scrolls it to the top.
// Labels always show. The icons are Fluent's 24 px drawings as Android drawables
// (plugins/tab-icons.js), regular at rest and filled when picked. The picked tab is said by the icon filling and
// turning the brand's blue with its label, in light and dark: no Material pill behind it (the pill's colour is the
// bar's own, so it never draws). On an iPhone it's iOS's own tab bar: Apple's
// symbols (the same things, outlined and filled), iOS's colours over its own bar (Liquid Glass from iOS 26), the
// app's accent on the picked tab. The badges come a moment after Beranda's first frame
// (`TabBadges`): working them out (every Task and exam, the KRS and the bills) held the splash
// up for numbers on tabs the Student hasn't looked at yet.
import { NativeTabs, type SFSymbolIcon } from "expo-router/native-tabs";
import { type Dispatch, type SetStateAction, startTransition, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRememberCourseColors } from "../../../src/app/course-colors";
import { useTermCourses } from "../../../src/app/courses";
import { useT } from "../../../src/app/i18n";
import { type Badge, usePlanBadge, useTasksBadge } from "../../../src/app/shell/badges";
import { perfDoing } from "../../src/perf";
import { useFirstFrameShown } from "../../src/shell/first-frame";
import { InTabs } from "../../src/ui/insets";
import { useTheme } from "../../src/ui/theme";

/**
 * A tab's badge, Material's (the error colour): a count the tab's page leads with, or it's gone. Tugas's is its
 * page's own "Belum selesai" number, shown only when one of them is late or due within a day. Kuliah has none: its
 * count (presence windows open now) isn't a number the page leads with (the page leads with the presence line itself,
 * and Beranda's first block says it too), so a "1" there read as unexplained beside three courses out of absences.
 * A red number nobody can explain teaches the Student to stop reading badges.
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
  const v = useTheme().v4;
  const [{ tasks, plan }, setBadges] = useState<Badges>(NO_BADGES);
  const tabs = [
    { name: "index", title: t("nav.home"), id: "home", icon: "home", badge: null },
    { name: "schedule", title: t("nav.schedule"), id: "schedule", icon: "schedule", badge: null },
    { name: "tasks", title: t("mobile.tab.tasks"), id: "tasks", icon: "tasks", badge: tasks },
    { name: "courses", title: t("mobile.tab.courses"), id: "courses", icon: "courses", badge: null },
    { name: "profile", title: t("mobile.tab.profile"), id: "profile", icon: "profile", badge: plan },
  ] as const;
  return (
    <InTabs.Provider value>
      <NativeTabs
        {...(Platform.OS === "ios"
          ? // iOS's own bar and colours (on iOS 26 it draws its glass itself); the picked tab in the app's accent.
            { tintColor: c.accent }
          : {
              backgroundColor: c.surfaceContainer,
              // No pill: the indicator in the bar's own colour. The picked tab is its filled icon and its label in the brand's blue.
              indicatorColor: c.surfaceContainer,
              rippleColor: c.selected,
              iconColor: { default: c.onSurfaceVariant, selected: v.brand },
              labelStyle: {
                default: { color: c.onSurfaceVariant, fontSize: 12, fontWeight: "500" },
                selected: { color: v.brand, fontSize: 12, fontWeight: "700" },
              },
            })}
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
            <NativeTabs.Trigger.Icon sf={SF[tab.icon]} drawable={{ default: `tab_${tab.icon}`, selected: `tab_${tab.icon}_filled` }} />
            <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Badge hidden={!badgeOf(tab.badge)}>{badgeOf(tab.badge)}</NativeTabs.Trigger.Badge>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
      <TabBadgesLater onChange={setBadges} />
    </InTabs.Provider>
  );
}

interface Badges {
  tasks: Badge;
  plan: Badge;
}

/** Each tab's icon on an iPhone: Apple's symbol, outlined at rest and filled when picked, as Android's drawables are. */
const SF: Record<"home" | "schedule" | "tasks" | "courses" | "profile", SFSymbolIcon["sf"]> = {
  home: { default: "house", selected: "house.fill" },
  schedule: { default: "calendar", selected: "calendar" },
  tasks: { default: "checkmark.circle", selected: "checkmark.circle.fill" },
  courses: { default: "book", selected: "book.fill" },
  profile: { default: "person", selected: "person.fill" },
};

const NO_BADGES: Badges = { tasks: null, plan: null };

/**
 * The badges from the first frame on, apart from the tabs: the moment it's up draws this alone, not the tab bar and
 * every tab's screen under it again.
 */
function TabBadgesLater({ onChange }: { onChange: Dispatch<SetStateAction<Badges>> }) {
  return useFirstFrameShown() ? <TabBadges onChange={onChange} /> : null;
}

/** The tabs' badges; the tabs hear of them only when one changes (none, at the start: they aren't drawn again). */
function TabBadges({ onChange }: { onChange: Dispatch<SetStateAction<Badges>> }) {
  // A stall as they're first worked out is theirs (later ones are the data's, named by the dataset).
  useState(() => perfDoing("the tabs' badges"));
  const tasks = useTasksBadge();
  // Profil carries what's to do in the Student's studies (send the KRS, pay the UKT); a clash to ask about stays on its row.
  const planCount = usePlanBadge();
  const plan = planCount?.tone === "warning" ? planCount : null;
  const key = JSON.stringify([tasks, plan]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the three badges, said the same way when they are
  useEffect(
    () => startTransition(() => onChange((before) => (JSON.stringify([before.tasks, before.plan]) === key ? before : { tasks, plan }))),
    [key, onChange],
  );
  return null;
}
