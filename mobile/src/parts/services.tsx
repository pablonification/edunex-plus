// The app's services (round 4): what Beranda's grid and "Semua layanan" show, each one a saturated tile with a filled
// icon and a one-word label, opening a screen the app already has. One list, so a service has the same colour, icon
// and word wherever it shows. The grammar is the one students know from the apps they use daily (a grid of services,
// the rest behind "Lainnya"); the colours and icons are the app's own (Phosphor, filled).

import { type Href, router } from "expo-router";
import { BooksIcon } from "phosphor-react-native/src/icons/Books";
import { CalendarDotsIcon } from "phosphor-react-native/src/icons/CalendarDots";
import { ClipboardTextIcon } from "phosphor-react-native/src/icons/ClipboardText";
import { ExamIcon } from "phosphor-react-native/src/icons/Exam";
import { HandPalmIcon } from "phosphor-react-native/src/icons/HandPalm";
import { NotePencilIcon } from "phosphor-react-native/src/icons/NotePencil";
import { SquaresFourIcon } from "phosphor-react-native/src/icons/SquaresFour";
import { WalletIcon } from "phosphor-react-native/src/icons/Wallet";
import type { ComponentType } from "react";
import { View } from "react-native";
import { useT } from "../../../src/app/i18n";
import type { StringKey } from "../../../src/core/strings";
import { PressScale } from "../ui/press";
import { Text } from "../ui/text";
import { space, useTheme } from "../ui/theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: "fill" | "regular" | "duotone" }>;

export interface Service {
  id: string;
  /** One word, under the tile. */
  label: StringKey;
  /** The tile's colour on a light and a dark page; the icon on it is white. `null`: the quiet tile ("Lainnya"). */
  color: { light: string; dark: string } | null;
  icon: () => Glyph;
  /** The screen it opens (typed routes are generated only when Expo runs, so a new screen's path is a plain string here). */
  href: string;
}

/** Every service, by id. Beranda's grid shows `HOME_GRID`; "Semua layanan" groups all of them. */
export const SERVICES = {
  presence: { id: "presence", label: "mobile.service.presence", color: { light: "#15994f", dark: "#1c8a4c" }, icon: () => HandPalmIcon, href: "/presence" },
  grades: { id: "grades", label: "mobile.service.grades", color: { light: "#e07b00", dark: "#c96f06" }, icon: () => ExamIcon, href: "/grades" },
  exams: { id: "exams", label: "mobile.service.exams", color: { light: "#7a4fe0", dark: "#6f4ad0" }, icon: () => NotePencilIcon, href: "/exams" },
  materials: { id: "materials", label: "mobile.service.materials", color: { light: "#0b8fa8", dark: "#0f8298" }, icon: () => BooksIcon, href: "/materials" },
  krs: { id: "krs", label: "mobile.service.krs", color: { light: "#d6336c", dark: "#c0336a" }, icon: () => ClipboardTextIcon, href: "/plan/krs" },
  calendar: {
    id: "calendar",
    label: "mobile.service.calendar",
    color: { light: "#e04434", dark: "#cc4436" },
    icon: () => CalendarDotsIcon,
    href: "/plan/deadlines",
  },
  bills: { id: "bills", label: "mobile.service.bills", color: { light: "#b8860b", dark: "#a67c12" }, icon: () => WalletIcon, href: "/plan/bills" },
  more: { id: "more", label: "mobile.service.more", color: null, icon: () => SquaresFourIcon, href: "/services" },
} as const satisfies Record<string, Service>;

export type ServiceId = keyof typeof SERVICES;

/** Beranda's grid, 4 across and 2 down, "Lainnya" last. */
export const HOME_GRID: readonly ServiceId[] = ["presence", "grades", "exams", "materials", "krs", "calendar", "bills", "more"];

/** The tile's side (dp): a touch target and more. */
export const SERVICE_TILE = 52;

/** One service: its tile over its word. The whole thing is the target (`service.<id>`). */
export function ServiceTile({ id, onPress }: { id: ServiceId; onPress?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const service: Service = SERVICES[id];
  const Glyph = service.icon();
  const fill = service.color ? service.color[theme.scheme === "dark" ? "dark" : "light"] : v.chip;
  return (
    <PressScale
      onPress={onPress ?? (() => router.push(service.href as Href))}
      accessibilityRole="button"
      accessibilityLabel={t(service.label)}
      testID={`service.${id}`}
      style={{ flex: 1, alignItems: "center", gap: space[1.5], paddingVertical: space[1] }}
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
      <Text size="labelMedium" weight="medium" numberOfLines={1} style={{ color: v.fg, textAlign: "center" }}>
        {t(service.label)}
      </Text>
    </PressScale>
  );
}

/** Services in rows of four. */
export function ServiceGrid({ ids, testID }: { ids: readonly ServiceId[]; testID?: string }) {
  const rows: ServiceId[][] = [];
  for (let i = 0; i < ids.length; i += 4) rows.push(ids.slice(i, i + 4));
  return (
    <View testID={testID} style={{ gap: space[2] }}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row" }}>
          {row.map((id) => (
            <ServiceTile key={id} id={id} />
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
