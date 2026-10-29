// The parts every screen is built from, the phone's versions of the desktop's (src/app/ui/layout.tsx)
// with the same names and the same rules: the page, its header, sections, lists of rows, one-line
// facts, notices and figures. Screens compose these instead of styling their own.
import { useScrollToTop } from "expo-router";
import { Children, type ComponentRef, Fragment, isValidElement, type ReactNode, type Ref, type RefObject, useCallback, useRef } from "react";
import { Pressable, RefreshControl, ScrollView, type ScrollViewProps, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icons } from "./icons";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

/**
 * A screen: scrolls, with the page's sides, and pulls to refresh when `onRefresh` is given ("Perbarui
 * sekarang"). The bottom keeps clear of the tab bar.
 */
export function Page({
  children,
  onRefresh,
  refreshing = false,
  header,
  testID,
  scrollRef,
  contentStyle,
  ...rest
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Above the scrolling content, fixed (a top bar). */
  header?: ReactNode;
  testID?: string;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  contentStyle?: ViewStyle;
} & Omit<ScrollViewProps, "children" | "refreshControl">) {
  const theme = useTheme();
  // A tap on the tab already open scrolls its page back to the top, as Android apps do.
  const own = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(own as RefObject<ComponentRef<typeof ScrollView>>);
  const ref = useCallback(
    (view: ComponentRef<typeof ScrollView> | null) => {
      own.current = view;
      if (typeof scrollRef === "function") scrollRef(view);
      else if (scrollRef) (scrollRef as RefObject<ComponentRef<typeof ScrollView> | null>).current = view;
    },
    [scrollRef],
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.canvas }} testID={testID}>
      {header}
      <ScrollView
        ref={ref}
        contentContainerStyle={[styles.page, contentStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.color.accent]} progressBackgroundColor={theme.color.raised} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** The top of a screen: what it is, the one line that matters most, and its actions under it. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  /** A short line above the title (the date on Beranda, the course code on a course). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space[6] }}>
      {eyebrow !== undefined && eyebrow !== null && (
        <View style={{ marginBottom: space[1.5] }}>
          {typeof eyebrow === "string" ? (
            <Text size="small" tone="muted" weight="medium">
              {eyebrow}
            </Text>
          ) : (
            eyebrow
          )}
        </View>
      )}
      <Text size="display" weight="semibold" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>
        {title}
      </Text>
      {description !== undefined && description !== null && (
        <View style={{ marginTop: space[1.5] }}>
          {typeof description === "string" ? (
            <Text size="lead" tone="muted">
              {description}
            </Text>
          ) : (
            description
          )}
        </View>
      )}
      {actions && <View style={{ marginTop: space[4], flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{actions}</View>}
    </View>
  );
}

/** A part of a screen under its own title; the count says how many before the Student reads them. */
export function Section({
  title,
  count,
  description,
  action,
  first = false,
  children,
  testID,
}: {
  title?: ReactNode;
  count?: number;
  description?: ReactNode;
  /** A link-like action at the heading's end ("Lihat semua"). */
  action?: ReactNode;
  /** The first section on a screen has no space above it. */
  first?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ marginTop: first ? 0 : space[8] }} testID={testID}>
      {title !== undefined && (
        <View style={styles.sectionHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="title" weight="semibold" accessibilityRole="header">
              {title}
              {count !== undefined && (
                <Text size="title" weight="medium" tone="faint" tabular>
                  {`  ${count}`}
                </Text>
              )}
            </Text>
            {description !== undefined && (
              <View style={{ marginTop: 2 }}>
                {typeof description === "string" ? (
                  <Text size="small" tone="muted">
                    {description}
                  </Text>
                ) : (
                  description
                )}
              </View>
            )}
          </View>
          {action && <View style={{ flexShrink: 0 }}>{action}</View>}
        </View>
      )}
      {children}
    </View>
  );
}

/** Rows that belong together, on one card, divided by hairlines. */
export function List({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={[styles.list, { borderColor: theme.color.edge, backgroundColor: theme.color.surface }, style]}>
      {rows.map((row, i) => (
        <View
          key={isValidElement(row) && row.key !== null ? row.key : i}
          style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line } : null}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

/**
 * One thing in a list: what it is (title), when and where (meta, one line), and at the end its state
 * or its one action. A tappable row is one target, the whole row, with a chevron saying it opens.
 * `actions` sit beside it, never inside it.
 */
export function Row({
  leading,
  title,
  meta,
  trailing,
  actions,
  onPress,
  onLongPress,
  label,
  current,
  testID,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  current?: boolean;
  testID?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const body = (
    <>
      {/* The indicator and the text as one block, centred in the row: the indicator level with the title's first line
          (22 high), however tall either is. */}
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        {leading !== undefined && <View style={{ flexShrink: 0, minHeight: 22, justifyContent: "center" }}>{leading}</View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof title === "string" ? (
            <Text size="body" weight="medium" numberOfLines={3}>
              {title}
            </Text>
          ) : (
            title
          )}
          {meta !== undefined && meta !== null && meta !== false && (
            <View style={{ marginTop: 2 }}>
              {typeof meta === "string" ? (
                <Text size="small" tone="muted">
                  {meta}
                </Text>
              ) : (
                meta
              )}
            </View>
          )}
          {children}
        </View>
      </View>
      {trailing !== undefined && trailing !== null && <View style={{ flexShrink: 0, alignItems: "flex-end", gap: 4, maxWidth: "42%" }}>{trailing}</View>}
    </>
  );
  const pressable = onPress || onLongPress;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, current && { backgroundColor: theme.color.selected }]}>
      {pressable ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          android_ripple={{ color: theme.color.selected }}
          style={[styles.row, { flex: 1, paddingRight: actions ? space[1] : space[3] }]}
        >
          {body}
          {!actions && onPress && <Icons.ChevronRight size={16} color={theme.color.faint} />}
        </Pressable>
      ) : (
        <View testID={testID} style={[styles.row, { flex: 1 }]}>
          {body}
        </View>
      )}
      {actions && <View style={{ flexDirection: "row", alignItems: "center", paddingRight: space[2] }}>{actions}</View>}
    </View>
  );
}

/** Splits facts: blanks dropped, text holding "·" split up. */
function factParts(children: ReactNode): ReactNode[] {
  const parts: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (typeof child === "string")
      parts.push(
        ...child
          .split("·")
          .map((piece) => piece.trim())
          .filter(Boolean),
      );
    else if (typeof child === "number") parts.push(String(child));
    else if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) parts.push(...factParts(child.props.children));
    else parts.push(child);
  }
  return parts;
}

/** Each fact's dot sits in a slot this wide before it; at the start of a line the slot is clipped away. */
const SEP = 18;

/**
 * Facts on one line, quietly separated: "11:00–12:59 · TVST C". Empty parts drop out, and text
 * holding " · " becomes separate facts. Each fact carries its own dot, so a fact that wraps takes
 * its dot along, and the dot of a fact that starts a line sits outside the box, clipped away (the
 * desktop's way): no line starts or ends with "·". Elements (a course dot, an icon) sit among the
 * facts. `numberOfLines`: one plain line, cut short.
 */
export function Meta({
  children,
  tone = "muted",
  size = "small",
  numberOfLines,
}: {
  children: ReactNode;
  tone?: "muted" | "faint" | "fg";
  size?: "small" | "caption";
  numberOfLines?: number;
}) {
  const parts = factParts(children);
  if (numberOfLines !== undefined && parts.every((part) => typeof part === "string"))
    return (
      <Text size={size} tone={tone} numberOfLines={numberOfLines}>
        {(parts as string[]).join("  ·  ")}
      </Text>
    );
  return (
    <View style={{ overflow: "hidden" }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 2, marginLeft: -SEP }}>
        {parts.map((part, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the facts are positional children; text has no key of its own
          <View key={i} style={{ flexDirection: "row", alignItems: "center", flexShrink: 1, maxWidth: "100%" }}>
            <Text size={size} tone="faint" style={{ width: SEP, textAlign: "center" }} accessible={false} importantForAccessibility="no">
              {i > 0 ? "·" : ""}
            </Text>
            {typeof part === "string" ? (
              <Text size={size} tone={tone} style={{ flexShrink: 1 }}>
                {part}
              </Text>
            ) : (
              <View style={{ flexShrink: 1 }}>{part}</View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The same facts as one plain string, for an accessible name: "PL3002 · 08:00–10:00 · R.SG PWK LT.6". */
export function factsLabel(...parts: (string | number | null | undefined | false)[]): string {
  return parts.filter((part): part is string | number => part !== null && part !== undefined && part !== false && String(part).trim() !== "").join(" · ");
}

const NOTICE = {
  info: { bg: "infoBg", fg: "infoFg", Icon: Icons.Info },
  warning: { bg: "warningBg", fg: "warningFg", Icon: Icons.AlertTriangle },
  danger: { bg: "dangerBg", fg: "dangerFg", Icon: Icons.AlertTriangle },
  success: { bg: "successBg", fg: "successFg", Icon: Icons.CheckCircle },
  neutral: { bg: "fill", fg: "fg", Icon: Icons.Info },
} as const;

/** Something to know right here, said once, with the one thing to do about it. */
export function Notice({
  tone = "info",
  icon,
  title,
  action,
  snooze,
  children,
  testID,
}: {
  tone?: keyof typeof NOTICE;
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  snooze?: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const { bg, fg, Icon } = NOTICE[tone];
  const color = theme.color[fg];
  return (
    <View testID={testID} style={[styles.notice, { backgroundColor: theme.color[bg] }]}>
      <View style={{ marginTop: 2 }}>{icon ?? <Icon size={18} color={color} weight="bold" />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text size="body" weight="semibold" style={{ color }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {children !== undefined && children !== null && (
          <View style={{ marginTop: 2, opacity: 0.92 }}>
            {typeof children === "string" ? (
              <Text size="small" style={{ color }}>
                {children}
              </Text>
            ) : (
              children
            )}
          </View>
        )}
        {(action || snooze) && (
          <View style={{ marginTop: space[3], flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {action}
            {snooze}
          </View>
        )}
      </View>
    </View>
  );
}

const STAT_TONE = { neutral: "fg", success: "success", warning: "warning", danger: "danger" } as const;

/** Figures read at a glance, side by side, split by hairlines: IPK, SKS, absences left. */
export function StatRow({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const stats = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ flexDirection: "row" }}>
      {stats.map((stat, i) => (
        <View
          key={isValidElement(stat) && stat.key !== null ? stat.key : i}
          style={[
            { flex: 1, minWidth: 0, paddingHorizontal: space[3] },
            i === 0 && { paddingLeft: 0 },
            i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.color.line },
          ]}
        >
          {stat}
        </View>
      ))}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  size = "figure",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONE;
  size?: "figure" | "heading";
}) {
  return (
    <View>
      <Text size="small" tone="muted" weight="medium">
        {label}
      </Text>
      <Text size={size} weight="semibold" tone={STAT_TONE[tone]} tabular>
        {value}
      </Text>
      {hint !== undefined &&
        hint !== null &&
        (typeof hint === "string" ? (
          <Text size="caption" tone="muted">
            {hint}
          </Text>
        ) : (
          hint
        ))}
    </View>
  );
}

/** Space between the parts of a screen that aren't sections (a card under the header). */
export function Gap({ size = 4 }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}

/** The bottom of the content, clear of the tab bar and the phone's gesture area. */
export function useBottomSpace(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + space[6];
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.page, paddingTop: space[4], paddingBottom: space[10] },
  sectionHead: { marginBottom: space[3], flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[4] },
  list: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingVertical: space[3], minHeight: 56 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: space[3], borderRadius: radius.xl, paddingHorizontal: space[4], paddingVertical: space[3] },
});
