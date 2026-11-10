// Direction B's own parts ("Edunex Mobile LMS done right"): a white page with almost no chrome, solid service tiles
// (a white filled Fluent glyph on the service's own colour), counts the Student can tap (the official app's logbook
// numbers), a plain heading between sections, rows on the page itself with a hairline between them (no card around a
// list). Everything here is drawn with views and react-native-svg.
import type { ReactNode } from "react";
import { type AccessibilityProps, StyleSheet, View, type ViewStyle } from "react-native";
import { Skeleton } from "./display";
import { Fluent, type FluentName } from "./fluent";
import { Icons, type ServiceIconName, ServiceIcons } from "./icons";
import { ON_SERVICE, SERVICE_TONES } from "./palette";
import { PressScale } from "./press";
import { Text } from "./text";
import { space, useTheme } from "./theme";

export type ServiceTone = keyof typeof SERVICE_TONES;

/** A service's glyph: one of the app's service icons (ui/icons.tsx) by name, or a prototype glyph by its Fluent name. */
export type ServiceGlyph = FluentName | ServiceIconName;

/**
 * B's surfaces: the page (white; one dark surface in dark), a soft fill a step off it (the search field), and the inks.
 * The same in both themes: a list is flat on `page`, with `line` between its rows.
 */
export { ON_SERVICE, SERVICE_TONES };

export function useB() {
  const theme = useTheme();
  const v = theme.v4;
  const dark = theme.scheme === "dark";
  const at = dark ? 1 : 0;
  return {
    dark,
    page: v.page,
    soft: v.chip,
    line: v.line,
    fg: v.fg,
    fg2: v.fg2,
    muted: v.muted,
    brand: v.brand,
    onBrand: v.onBrand,
    red: v.redFg,
    ok: v.okFg,
    amber: v.ambFg,
    tone(name: ServiceTone): { ink: string; tint: string; solid: string; edge: string } {
      const tone = SERVICE_TONES[name];
      return { ink: tone.ink[at], tint: tone.tint[at], solid: tone.solid[at], edge: tone.edge[at] };
    },
  };
}

/**
 * A service's mark: a rounded square in the service's own colour, its filled glyph in white. The big one (48 dp and
 * up) stands on a slightly darker lower edge; a row's small one (`size` 28 to 44) is the same colour and glyph, flat.
 * Two views and one Path: no gradient, no shadow.
 */
export function ServiceCircle({ icon, tone, size = 56 }: { icon: ServiceGlyph; tone: ServiceTone; size?: number }) {
  const { solid, edge } = useB().tone(tone);
  const big = size >= 48;
  const radius = Math.round(size * 0.3);
  const glyph = big ? Math.round(size / 2) : Math.round(size * 0.58);
  const Named = icon in ServiceIcons ? ServiceIcons[icon as ServiceIconName] : null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: big ? edge : solid, flexShrink: 0 }}
    >
      <View style={{ height: big ? size - 3 : size, borderRadius: radius, backgroundColor: solid, alignItems: "center", justifyContent: "center" }}>
        {Named ? <Named size={glyph} color={ON_SERVICE} /> : <Fluent name={icon as FluentName} color={ON_SERVICE} size={glyph} />}
      </View>
    </View>
  );
}

/**
 * One service on a grid, four across: its solid tile, its name under it (one word on Beranda; `lines` 2 where a name
 * needs two, on Semua layanan). The whole column is the one target and gives on a press.
 */
export function ServiceTile({
  icon,
  tone,
  label,
  lines = 1,
  onPress,
  testID,
}: {
  icon: ServiceGlyph;
  tone: ServiceTone;
  label: string;
  lines?: 1 | 2;
  onPress(): void;
  testID?: string;
}) {
  const b = useB();
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} testID={testID} style={styles.tile}>
      <ServiceCircle icon={icon} tone={tone} />
      <Text
        size="bodyMedium"
        weight="semibold"
        numberOfLines={lines}
        style={{ color: b.fg, fontSize: 13, lineHeight: 18, letterSpacing: 0, textAlign: "center" }}
      >
        {label}
      </Text>
    </PressScale>
  );
}

/** A row of service tiles, four across; a short row keeps the same columns. */
export function ServiceRow({ children, count, top = false }: { children: ReactNode; count: number; top?: boolean }) {
  return (
    // `top`: tiles line up by their tops where a name may take two lines (Semua layanan).
    <View style={{ flexDirection: "row", alignItems: top ? "flex-start" : undefined }}>
      {children}
      {Array.from({ length: Math.max(0, 4 - count) }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: empty columns, in order
        <View key={i} style={{ flex: 1 }} />
      ))}
    </View>
  );
}

/** A section's heading on the page: plain words in the display face, with at most one quiet action at its end. */
export function BHeading({ children, trailing, style }: { children: string; trailing?: ReactNode; style?: ViewStyle }) {
  const b = useB();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", minHeight: 24, marginBottom: space[3] }, style]}>
      <Text
        size="titleMedium"
        face="display"
        weight="bold"
        accessibilityRole="header"
        style={{ flex: 1, color: b.fg, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 }}
      >
        {children}
      </Text>
      {trailing}
    </View>
  );
}

/**
 * A count the Student can tap (the logbook's numbers): the number big, what it counts under it. `mark`: good news is a
 * check, never "0". `ink` colours the number only when it says something is wrong. `pending`: the number is still on
 * its way, its shape stands in.
 */
export function CountCell({
  value,
  label,
  ink,
  mark = false,
  pending = false,
  onPress,
  testID,
  ...a11y
}: { value: string; label: string; ink?: string; mark?: boolean; pending?: boolean; onPress(): void; testID?: string } & AccessibilityProps) {
  const b = useB();
  return (
    <PressScale onPress={onPress} testID={testID} accessibilityLabel={mark ? label : `${value} ${label}`} {...a11y} style={styles.count}>
      <View style={{ height: 32, justifyContent: "center" }}>
        {pending ? (
          <Skeleton width={28} height={20} />
        ) : mark ? (
          <Fluent name="CheckmarkCircle28Filled" color={b.ok} />
        ) : (
          <Text
            size="headlineSmall"
            face="display"
            weight="extrabold"
            tabular
            numberOfLines={1}
            style={{ color: ink ?? b.fg, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 }}
          >
            {value}
          </Text>
        )}
      </View>
      {/* The label and a small chevron: the count opens something, and looks like it does. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, maxWidth: "100%" }}>
        <Text size="bodyMedium" weight="medium" numberOfLines={1} style={{ color: b.fg2, fontSize: 13, lineHeight: 18, letterSpacing: 0, flexShrink: 1 }}>
          {label}
        </Text>
        <Icons.ChevronRight size={12} color={b.muted} />
      </View>
    </PressScale>
  );
}

/** Counts side by side, a hairline between them: one strip, each count its own target. */
export function CountStrip({ children, testID }: { children: ReactNode[]; testID?: string }) {
  const b = useB();
  const cells = children.filter(Boolean);
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "stretch" }}>
      {cells.map((cell, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the cells in the order given
        <View key={i} style={{ flex: 1, flexDirection: "row" }}>
          {i > 0 && <View style={{ width: StyleSheet.hairlineWidth * 2, marginVertical: space[2], backgroundColor: b.line }} />}
          {cell}
        </View>
      ))}
    </View>
  );
}

/** A row on the page itself: a mark, a title with one quiet line, something at its end; a hairline under all but the last. */
export function BRow({
  leading,
  title,
  meta,
  metaColor,
  trailing,
  last = false,
  onPress,
  testID,
  ...a11y
}: {
  leading?: ReactNode;
  title: string;
  meta?: ReactNode;
  metaColor?: string;
  trailing?: ReactNode;
  last?: boolean;
  onPress?(): void;
  testID?: string;
} & AccessibilityProps) {
  const b = useB();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 64 }}>
      {leading}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          paddingVertical: space[3],
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2,
          borderBottomColor: b.line,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: b.fg }}>
            {title}
          </Text>
          {typeof meta === "string" ? (
            <Text size="bodyMedium" numberOfLines={2} style={{ color: metaColor ?? b.muted }}>
              {meta}
            </Text>
          ) : (
            meta
          )}
        </View>
        {trailing}
      </View>
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <PressScale onPress={onPress} testID={testID} {...a11y}>
      {body}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 48, alignItems: "center", gap: space[2], paddingVertical: space[1], paddingHorizontal: 2 },
  count: { flex: 1, minHeight: 56, alignItems: "center", paddingVertical: space[2], paddingHorizontal: space[1], gap: 2 },
});
