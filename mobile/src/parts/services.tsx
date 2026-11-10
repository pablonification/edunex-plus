// The app's services (round 4): what Beranda's grid and "Semua layanan" show, each one a coloured tile with a filled
// white icon and a short label, opening a screen the app already has. One list, so a service has the same colour, icon
// and word wherever it shows. The grammar is the one students know from the apps they use daily (a grid of services,
// the rest behind "Lainnya"); the colours and icons are the app's own (Phosphor, filled). Colour means the group: every
// service in Kuliah, Akademik, Administrasi or Buka di web shares its group's one colour, four hues told apart by
// lightness as well as hue, so they hold for a Student who can't tell red from green. Inside a group, services differ
// by their icon's shape: no two share one. Every colour carries its white icon at 3:1 or more in both themes
// (test/mobile/services.test.ts). Tugas and Jadwal aren't here: they're bottom tabs, and Jadwal opens its month view.

import { type Href, router } from "expo-router";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BooksIcon } from "phosphor-react-native/src/icons/Books";
import { CalendarDotsIcon } from "phosphor-react-native/src/icons/CalendarDots";
import { ClipboardTextIcon } from "phosphor-react-native/src/icons/ClipboardText";
import { ExamIcon } from "phosphor-react-native/src/icons/Exam";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { HandPalmIcon } from "phosphor-react-native/src/icons/HandPalm";
import { LifebuoyIcon } from "phosphor-react-native/src/icons/Lifebuoy";
import { PathIcon } from "phosphor-react-native/src/icons/Path";
import { PencilLineIcon } from "phosphor-react-native/src/icons/PencilLine";
import { SquaresFourIcon } from "phosphor-react-native/src/icons/SquaresFour";
import { StudentIcon } from "phosphor-react-native/src/icons/Student";
import { TreeStructureIcon } from "phosphor-react-native/src/icons/TreeStructure";
import { WalletIcon } from "phosphor-react-native/src/icons/Wallet";
import type { ComponentType } from "react";
import { View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { EDUNEX_WEB, SIX_WEB } from "../../../src/core/links";
import type { StringKey } from "../../../src/core/strings";
import { countOpen } from "../screens/services/opens";
import { PressScale } from "../ui/press";
import { Text } from "../ui/text";
import { space, useTheme } from "../ui/theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: "fill" | "regular" | "duotone" }>;

/** The four headings of "Semua layanan". */
export type ServiceGroup = "courses" | "academic" | "admin" | "web";

/**
 * Each group's one colour on a light and a dark page; the icon on it is white. Picked to sit beside Edunex blue
 * (`#1f63e0`) in the header without being it: Kuliah teal-green, Akademik violet, Administrasi amber-orange, Buka di web
 * slate.
 */
export const GROUP_COLORS: Record<ServiceGroup, { light: string; dark: string }> = {
  courses: { light: "#0f8a6c", dark: "#0d7a60" },
  academic: { light: "#7a4fe0", dark: "#6d45d0" },
  admin: { light: "#c2580c", dark: "#b04f0b" },
  web: { light: "#5b6577", dark: "#525b6b" },
};

export interface Service {
  id: string;
  /** Its word under the tile: one word on Beranda; two where one can't say it ("Rencana studi"), on "Semua layanan" only. */
  label: StringKey;
  icon: () => Glyph;
  /** The screen it opens (typed routes are generated only when Expo runs, so a new screen's path is a plain string here). */
  href: string;
  /** Its heading on "Semua layanan", and so its colour; none for "Lainnya", the quiet tile only Beranda shows. */
  group: ServiceGroup | null;
}

const web = (url: string) => `/web?url=${encodeURIComponent(url)}`;

/** Every service, by id, in each group's order. Beranda's grid shows `HOME_GRID`; "Semua layanan" groups the rest. */
export const SERVICES = {
  // Kuliah: the week's classes and work.
  presence: { id: "presence", label: "mobile.service.presence", icon: () => HandPalmIcon, href: "/courses", group: "courses" },
  materials: { id: "materials", label: "mobile.service.materials", icon: () => BooksIcon, href: "/materials", group: "courses" },
  exams: { id: "exams", label: "mobile.service.exams", icon: () => PencilLineIcon, href: "/exams", group: "courses" },
  // Akademik: grades and the study plan.
  grades: { id: "grades", label: "mobile.service.grades", icon: () => ExamIcon, href: "/grades", group: "academic" },
  krs: { id: "krs", label: "mobile.service.krs", icon: () => ClipboardTextIcon, href: "/plan/krs", group: "academic" },
  planner: { id: "planner", label: "mobile.service.planner", icon: () => PathIcon, href: "/plan/planner", group: "academic" },
  curriculum: {
    id: "curriculum",
    label: "mobile.service.curriculum",
    icon: () => TreeStructureIcon,
    href: "/plan/curriculum",
    group: "academic",
  },
  // Administrasi: the term's dates, the fee, and the app itself.
  calendar: { id: "calendar", label: "mobile.service.calendar", icon: () => CalendarDotsIcon, href: "/plan/deadlines", group: "admin" },
  bills: { id: "bills", label: "mobile.service.bills", icon: () => WalletIcon, href: "/plan/bills", group: "admin" },
  alerts: { id: "alerts", label: "mobile.service.alerts", icon: () => BellIcon, href: "/alerts", group: "admin" },
  settings: { id: "settings", label: "mobile.service.settings", icon: () => GearSixIcon, href: "/settings", group: "admin" },
  report: { id: "report", label: "mobile.service.report", icon: () => LifebuoyIcon, href: "/report", group: "admin" },
  // Buka di web: the sites themselves, signed in, in the app's own browser.
  edunex: { id: "edunex", label: "mobile.service.edunex", icon: () => StudentIcon, href: web(`${EDUNEX_WEB}/`), group: "web" },
  six: { id: "six", label: "mobile.service.six", icon: () => GlobeIcon, href: web(`${SIX_WEB}/`), group: "web" },
  more: { id: "more", label: "mobile.service.more", icon: () => SquaresFourIcon, href: "/services", group: null },
} as const satisfies Record<string, Service>;

export type ServiceId = keyof typeof SERVICES;

/** Beranda's grid, 4 across and 2 down, read by group (Kuliah's, Akademik's, Administrasi's), "Lainnya" last. */
export const HOME_GRID: readonly ServiceId[] = ["presence", "materials", "exams", "grades", "krs", "calendar", "bills", "more"];

/** "Semua layanan"'s headings, in order, each with its services in `SERVICES`' order. */
export const SERVICE_GROUPS: readonly { group: ServiceGroup; title: StringKey; ids: readonly ServiceId[] }[] = (
  [
    ["courses", "mobile.services.group.courses"],
    ["academic", "mobile.services.group.academic"],
    ["admin", "mobile.services.group.admin"],
    ["web", "mobile.services.group.web"],
  ] as const
).map(([group, title]) => ({
  group,
  title,
  ids: (Object.keys(SERVICES) as ServiceId[]).filter((id) => (SERVICES[id] as Service).group === group),
}));

/** The tile's side (dp): a touch target and more. */
export const SERVICE_TILE = 52;

/** The bottom tabs: opened from a screen over them, back down to them first, as `useNav().go` does (../nav.ts). */
const TAB_HREFS = new Set(["/courses"]);

/** Opens a service, and counts the open toward "Sering kamu buka" after the tap is on its way. */
export function openService(id: ServiceId): void {
  const href = SERVICES[id].href;
  if (TAB_HREFS.has(href)) {
    if (router.canDismiss()) router.dismissAll();
    router.navigate(href as Href);
  } else router.push(href as Href);
  if (id !== "more") countOpen(id);
}

/**
 * One service: its tile over its word. The whole thing is the target (`service.<id>`). `lines`: 1 on Beranda (every
 * word there fits a quarter of a 411 dp phone at font size 1.1); 2 on "Semua layanan", centred.
 */
export function ServiceTile({ id, onPress, lines = 1 }: { id: ServiceId; onPress?: () => void; lines?: 1 | 2 }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const service: Service = SERVICES[id];
  const Glyph = service.icon();
  const fill = service.group ? GROUP_COLORS[service.group][theme.scheme === "dark" ? "dark" : "light"] : v.chip;
  return (
    <PressScale
      onPress={onPress ?? (() => openService(id))}
      accessibilityRole="button"
      accessibilityLabel={t(service.label)}
      testID={`service.${id}`}
      style={{ flex: 1, alignItems: "center", gap: space[1.5], paddingVertical: space[1], paddingHorizontal: space[0.5] }}
    >
      <View
        style={{
          width: SERVICE_TILE,
          height: SERVICE_TILE,
          borderRadius: 18,
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Glyph size={28} color={service.group ? "#ffffff" : v.fg2} weight="fill" />
      </View>
      <Text
        size="labelMedium"
        weight="medium"
        numberOfLines={lines}
        importantForAccessibility="no"
        style={{ color: v.fg, textAlign: "center", alignSelf: "stretch" }}
      >
        {t(service.label)}
      </Text>
    </PressScale>
  );
}

/** Services in rows of four. */
export function ServiceGrid({ ids, testID, lines = 1 }: { ids: readonly ServiceId[]; testID?: string; lines?: 1 | 2 }) {
  const rows: ServiceId[][] = [];
  for (let i = 0; i < ids.length; i += 4) rows.push(ids.slice(i, i + 4));
  return (
    <View testID={testID} style={{ gap: space[3] }}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {row.map((id) => (
            <ServiceTile key={id} id={id} lines={lines} />
          ))}
          {/* A short last row keeps the columns' width. */}
          {Array.from({ length: 4 - row.length }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: empty cells, never reordered
            <View key={i} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
