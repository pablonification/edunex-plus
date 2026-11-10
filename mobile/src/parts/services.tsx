// The app's services (round 4): what Beranda's grid and "Semua layanan" show, each one a saturated tile with a filled
// white icon and a short label, opening a screen the app already has. One list, so a service has the same colour, icon
// and word wherever it shows. The grammar is the one students know from the apps they use daily (a grid of services,
// the rest behind "Lainnya"); the colours and icons are the app's own (Phosphor, filled). Every colour carries its white
// icon at 3:1 or more in both themes (test/mobile/services.test.ts), and no two services share an icon, so neighbours
// differ by shape for a Student who can't tell their colours apart.

import { type Href, router } from "expo-router";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BooksIcon } from "phosphor-react-native/src/icons/Books";
import { CalendarBlankIcon } from "phosphor-react-native/src/icons/CalendarBlank";
import { CalendarDotsIcon } from "phosphor-react-native/src/icons/CalendarDots";
import { CheckSquareIcon } from "phosphor-react-native/src/icons/CheckSquare";
import { ClipboardTextIcon } from "phosphor-react-native/src/icons/ClipboardText";
import { ClockIcon } from "phosphor-react-native/src/icons/Clock";
import { ExamIcon } from "phosphor-react-native/src/icons/Exam";
import { GearSixIcon } from "phosphor-react-native/src/icons/GearSix";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { HandPalmIcon } from "phosphor-react-native/src/icons/HandPalm";
import { LifebuoyIcon } from "phosphor-react-native/src/icons/Lifebuoy";
import { NotePencilIcon } from "phosphor-react-native/src/icons/NotePencil";
import { PathIcon } from "phosphor-react-native/src/icons/Path";
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

export interface Service {
  id: string;
  /** Its word under the tile: one word on Beranda; two where one can't say it ("Rencana studi"), on "Semua layanan" only. */
  label: StringKey;
  /** The tile's colour on a light and a dark page; the icon on it is white. `null`: the quiet tile ("Lainnya"). */
  color: { light: string; dark: string } | null;
  icon: () => Glyph;
  /** The screen it opens (typed routes are generated only when Expo runs, so a new screen's path is a plain string here). */
  href: string;
  /** Its heading on "Semua layanan"; none for "Lainnya", which only Beranda shows. */
  group: ServiceGroup | null;
}

const web = (url: string) => `/web?url=${encodeURIComponent(url)}`;

/** Every service, by id, in each group's order. Beranda's grid shows `HOME_GRID`; "Semua layanan" groups all of them. */
export const SERVICES = {
  // Kuliah: the week's classes and work.
  tasks: {
    id: "tasks",
    label: "mobile.service.tasks",
    color: { light: "#2563eb", dark: "#2257cc" },
    icon: () => CheckSquareIcon,
    href: "/tasks",
    group: "courses",
  },
  schedule: {
    id: "schedule",
    label: "mobile.service.schedule",
    color: { light: "#0f8a6c", dark: "#0d7a60" },
    icon: () => ClockIcon,
    href: "/schedule",
    group: "courses",
  },
  month: {
    id: "month",
    label: "mobile.service.month",
    color: { light: "#b8338f", dark: "#a32e7f" },
    icon: () => CalendarBlankIcon,
    href: "/schedule-month",
    group: "courses",
  },
  presence: {
    id: "presence",
    label: "mobile.service.presence",
    color: { light: "#15994f", dark: "#1c8a4c" },
    icon: () => HandPalmIcon,
    href: "/courses",
    group: "courses",
  },
  materials: {
    id: "materials",
    label: "mobile.service.materials",
    color: { light: "#0b8fa8", dark: "#0f8298" },
    icon: () => BooksIcon,
    href: "/materials",
    group: "courses",
  },
  exams: {
    id: "exams",
    label: "mobile.service.exams",
    color: { light: "#7a4fe0", dark: "#6f4ad0" },
    icon: () => NotePencilIcon,
    href: "/exams",
    group: "courses",
  },
  // Akademik: grades and the study plan.
  grades: {
    id: "grades",
    label: "mobile.service.grades",
    color: { light: "#d47300", dark: "#c46a00" },
    icon: () => ExamIcon,
    href: "/grades",
    group: "academic",
  },
  planner: {
    id: "planner",
    label: "mobile.service.planner",
    color: { light: "#4f5bd5", dark: "#4650c0" },
    icon: () => PathIcon,
    href: "/plan/planner",
    group: "academic",
  },
  curriculum: {
    id: "curriculum",
    label: "mobile.service.curriculum",
    color: { light: "#a0522d", dark: "#8f4a28" },
    icon: () => TreeStructureIcon,
    href: "/plan/curriculum",
    group: "academic",
  },
  krs: {
    id: "krs",
    label: "mobile.service.krs",
    color: { light: "#d6336c", dark: "#c0336a" },
    icon: () => ClipboardTextIcon,
    href: "/plan/krs",
    group: "academic",
  },
  // Administrasi: the term's dates, the fee, and the app itself.
  calendar: {
    id: "calendar",
    label: "mobile.service.calendar",
    color: { light: "#e04434", dark: "#cc4436" },
    icon: () => CalendarDotsIcon,
    href: "/plan/deadlines",
    group: "admin",
  },
  bills: {
    id: "bills",
    label: "mobile.service.bills",
    color: { light: "#b8860b", dark: "#a67c12" },
    icon: () => WalletIcon,
    href: "/plan/bills",
    group: "admin",
  },
  alerts: { id: "alerts", label: "mobile.service.alerts", color: { light: "#8b45c9", dark: "#7c3eb5" }, icon: () => BellIcon, href: "/alerts", group: "admin" },
  settings: {
    id: "settings",
    label: "mobile.service.settings",
    color: { light: "#5b6577", dark: "#525b6b" },
    icon: () => GearSixIcon,
    href: "/settings",
    group: "admin",
  },
  report: {
    id: "report",
    label: "mobile.service.report",
    color: { light: "#c2410c", dark: "#b23c0b" },
    icon: () => LifebuoyIcon,
    href: "/report",
    group: "admin",
  },
  // Buka di web: the sites themselves, signed in, in the app's own browser.
  edunex: {
    id: "edunex",
    label: "mobile.service.edunex",
    color: { light: "#1f63e0", dark: "#1b57c4" },
    icon: () => StudentIcon,
    href: web(`${EDUNEX_WEB}/`),
    group: "web",
  },
  six: { id: "six", label: "mobile.service.six", color: { light: "#0f6f80", dark: "#0d6170" }, icon: () => GlobeIcon, href: web(`${SIX_WEB}/`), group: "web" },
  more: { id: "more", label: "mobile.service.more", color: null, icon: () => SquaresFourIcon, href: "/services", group: null },
} as const satisfies Record<string, Service>;

export type ServiceId = keyof typeof SERVICES;

/** Beranda's grid, 4 across and 2 down, "Lainnya" last. */
export const HOME_GRID: readonly ServiceId[] = ["presence", "grades", "exams", "materials", "krs", "calendar", "bills", "more"];

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
const TAB_HREFS = new Set(["/tasks", "/schedule", "/courses"]);

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
  const fill = service.color ? service.color[theme.scheme === "dark" ? "dark" : "light"] : v.chip;
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
        <Glyph size={28} color={service.color ? "#ffffff" : v.fg2} weight="fill" />
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
