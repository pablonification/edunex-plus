// Direction B's own parts ("Edunex Mobile LMS done right"): a white page with almost no chrome, round service circles
// (a filled Fluent glyph, each service its own colour), counts the Student can tap (the official app's logbook
// numbers), a plain heading between sections, rows on the page itself with a hairline between them (no card around a
// list). Everything here is drawn with views and react-native-svg.
import type { ReactNode } from "react";
import { type AccessibilityProps, StyleSheet, View, type ViewStyle } from "react-native";
import { Skeleton } from "./display";
import { Fluent, type FluentName } from "./fluent";
import { PressScale } from "./press";
import { Text } from "./text";
import { space, useTheme } from "./theme";

/** A service's colour: its ink (the glyph) and its tint (the circle), light then dark. No two alike. */
const TONES = {
  green: ["#11692f", "#8fe0a8", "#dcf3e3", "#14301f"],
  amber: ["#8f4c00", "#ffcf8a", "#ffe9c2", "#3a2a12"],
  red: ["#b3261e", "#ffb4ab", "#fde0de", "#3d1b1a"],
  indigo: ["#4a3fd0", "#c0b8ff", "#e6e3ff", "#2a2752"],
  teal: ["#00697a", "#7fdbe8", "#d3f0f4", "#10353b"],
  blue: ["#1450c4", "#b9ceff", "#dbe6ff", "#22355f"],
  magenta: ["#a3157f", "#ffaede", "#fbdcf0", "#43203a"],
  lime: ["#4a6200", "#c5e384", "#e6f2c4", "#2a3312"],
  grey: ["#3f4652", "#c8cdd6", "#eceef2", "#2a2f39"],
} as const;
export type ServiceTone = keyof typeof TONES;

/** B's surfaces: the page (white; near black in dark), a soft fill a step off it (the search field), and the inks. */
export function useB() {
  const theme = useTheme();
  const v = theme.v4;
  const dark = theme.scheme === "dark";
  return {
    dark,
    page: dark ? v.page : v.card,
    soft: dark ? v.card : v.page,
    line: v.line,
    fg: v.fg,
    fg2: v.fg2,
    muted: v.muted,
    brand: v.brand,
    onBrand: v.onBrand,
    red: v.redFg,
    ok: v.okFg,
    amber: v.ambFg,
    tone(name: ServiceTone): { ink: string; tint: string } {
      const tone = TONES[name];
      return { ink: tone[dark ? 1 : 0], tint: tone[dark ? 3 : 2] };
    },
  };
}

/** A filled glyph in a circle of its own colour: a service's mark, on a tile or at a row's start. */
export function ServiceCircle({ icon, tone, size = 56 }: { icon: FluentName; tone: ServiceTone; size?: number }) {
  const { ink, tint } = useB().tone(tone);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}
    >
      <Fluent name={icon} color={ink} />
    </View>
  );
}

/** One service on a grid, four across: its circle, one word under it. */
export function ServiceTile({ icon, tone, label, onPress, testID }: { icon: FluentName; tone: ServiceTone; label: string; onPress(): void; testID?: string }) {
  const b = useB();
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} testID={testID} style={styles.tile}>
      <ServiceCircle icon={icon} tone={tone} />
      <Text size="bodyMedium" weight="medium" numberOfLines={1} style={{ color: b.fg, fontSize: 13, lineHeight: 18, letterSpacing: 0, textAlign: "center" }}>
        {label}
      </Text>
    </PressScale>
  );
}

/** A row of service tiles, four across; a short row keeps the same columns. */
export function ServiceRow({ children, count }: { children: ReactNode; count: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
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
      <Text size="bodyMedium" numberOfLines={1} style={{ color: b.fg2, fontSize: 13, lineHeight: 18, letterSpacing: 0 }}>
        {label}
      </Text>
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
  tile: { flex: 1, alignItems: "center", gap: space[2], paddingVertical: space[1] },
  count: { flex: 1, alignItems: "center", paddingVertical: space[2], gap: 2 },
});
