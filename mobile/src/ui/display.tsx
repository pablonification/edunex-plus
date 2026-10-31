// Small pieces that show a state: cards, badges, tags, a Task's status, a course's color, bars, the
// skeleton and the empty state. The phone's versions of src/app/ui/display.tsx, with the same names and
// meanings, drawn in Material 3's tonal surfaces (DESIGN.md): no hairline boxes.
import { type ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useT } from "../../../src/app/i18n";
import { Icons } from "./icons";
import { useReduceMotion } from "./motion";
import { Text } from "./text";
import { type Palette, radius, shape, space, useTheme } from "./theme";

export function Card({
  variant = "plain",
  style,
  children,
  testID,
}: {
  variant?: "plain" | "raised" | "sunken";
  style?: ViewStyle;
  children: ReactNode;
  testID?: string;
}) {
  const c = useTheme().color;
  // M3's filled card on the page (surfaceContainerLow); raised, the one card that leads a screen, a step up
  // (surfaceContainer); sunken, a quiet well (surfaceContainerHigh). Separated by tone, never a border or a shadow.
  const look: ViewStyle = {
    backgroundColor: variant === "sunken" ? c.surfaceContainerHigh : variant === "raised" ? c.surfaceContainer : c.surfaceContainerLow,
    borderRadius: variant === "raised" ? shape.lgPlus : shape.lg,
  };
  return (
    <View testID={testID} style={[{ overflow: "hidden" }, look, style]}>
      {children}
    </View>
  );
}

/** Nothing to show: why, and the next step as its `children` (a button). Never shown while data is still coming. */
export function EmptyState({ icon, title, description, children }: { icon: ReactNode; title: string; description?: ReactNode; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space[10], paddingHorizontal: space[6], gap: space[2] }}>
      <View
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.color.secondaryContainer, alignItems: "center", justifyContent: "center" }}
      >
        {icon}
      </View>
      <Text size="titleMedium" style={{ textAlign: "center", marginTop: space[2] }}>
        {title}
      </Text>
      {description !== undefined &&
        (typeof description === "string" ? (
          <Text size="bodyMedium" tone="muted" style={{ textAlign: "center" }}>
            {description}
          </Text>
        ) : (
          description
        ))}
      {children && <View style={{ marginTop: space[3] }}>{children}</View>}
    </View>
  );
}

/** A placeholder in the shape of what's coming, breathing slowly (still, when the phone asks for less motion). */
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: ViewStyle["width"]; style?: ViewStyle }) {
  const theme = useTheme();
  const still = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, still]);
  return <Animated.View style={[{ height, width, borderRadius: shape.sm, backgroundColor: theme.color.surfaceContainerHigh, opacity: pulse }, style]} />;
}

export function LiveDot({ color }: { color?: string }) {
  const theme = useTheme();
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color ?? theme.color.live }} />;
}

/** A thin bar for a share (a value 0–1), in a meaning's color. */
export function Bar({ value, color, label, style }: { value: number; color: string; label: string; style?: ViewStyle }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: theme.color.meterTrack }, style]}
    >
      <View style={{ height: "100%", width: `${clamped * 100}%`, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

const TONE: Record<string, [keyof Palette, keyof Palette]> = {
  neutral: ["neutralBg", "neutralFg"],
  warning: ["warningBg", "warningFg"],
  danger: ["dangerBg", "dangerFg"],
  success: ["successBg", "successFg"],
  info: ["infoBg", "infoFg"],
};
export type Tone = "neutral" | "warning" | "danger" | "success" | "info";

/** A small count or label pill. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const theme = useTheme();
  const [bg, fg] = TONE[tone]!;
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: radius.full,
        backgroundColor: theme.color[bg],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text size="micro" weight="semibold" tabular style={{ color: theme.color[fg] }}>
        {children}
      </Text>
    </View>
  );
}

/** A word marking one row as the exception ("Baru", "Hadir", "UTS"), in a tone; never on every row. */
export function Tag({ tone = "neutral", size = "sm", children }: { tone?: Tone; size?: "sm" | "md"; children: ReactNode }) {
  const theme = useTheme();
  const [bg, fg] = TONE[tone]!;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: radius.tag,
        paddingHorizontal: size === "md" ? 8 : 6,
        paddingVertical: size === "md" ? 3 : 1,
        backgroundColor: theme.color[bg],
      }}
    >
      {typeof children === "string" ? (
        <Text size={size === "md" ? "caption" : "micro"} weight="semibold" style={{ color: theme.color[fg] }} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export type TaskStatus = "not_started" | "draft" | "submitted" | "overdue" | "closed" | "in_review";

const STATUS: Record<TaskStatus, [keyof Palette, keyof Palette]> = {
  not_started: ["neutralBg", "neutralFg"],
  draft: ["statusDraftBg", "statusDraftFg"],
  submitted: ["statusSubmittedBg", "statusSubmittedFg"],
  overdue: ["statusOverdueBg", "statusOverdueFg"],
  closed: ["statusClosedBg", "statusClosedFg"],
  in_review: ["statusReviewBg", "statusReviewFg"],
};

export function StatusGlyph({ status, size = 14, color }: { status: TaskStatus; size?: number; color?: string }) {
  const theme = useTheme();
  const c = color ?? theme.color[STATUS[status][1]];
  switch (status) {
    case "submitted":
      return <Icons.CheckCircle size={size} color={c} weight="bold" />;
    case "overdue":
      return <Icons.AlertTriangle size={size} color={c} weight="bold" />;
    case "closed":
      return <Icons.Lock size={size} color={c} weight="bold" />;
    case "in_review":
      return <Icons.Clock size={size} color={c} weight="bold" />;
    case "draft":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" fill="none" stroke={c} strokeWidth="2" />
          <Path d="M12 3a9 9 0 0 1 0 18z" fill={c} />
        </Svg>
      );
    default:
      return <Icons.Circle size={size} color={c} weight="bold" />;
  }
}

/** A Task's true status. Color is never the only signal: each has its own glyph and word. */
export function StatusChip({ status }: { status: TaskStatus }) {
  const t = useT();
  const theme = useTheme();
  const [bg, fg] = STATUS[status];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 24,
        paddingHorizontal: 8,
        borderRadius: radius.full,
        backgroundColor: theme.color[bg],
      }}
    >
      <StatusGlyph status={status} size={12} />
      <Text size="caption" weight="semibold" style={{ color: theme.color[fg] }} numberOfLines={1}>
        {t(`taskStatus.${status}`)}
      </Text>
    </View>
  );
}

/** A course's color, as a small square; no color: an outline, so grey never stands for a course. */
export function CourseDot({ color, size = 10 }: { color: string | undefined; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: 2 },
        color ? { backgroundColor: theme.course(color) } : { borderWidth: 1, borderColor: theme.color.faint },
      ]}
    />
  );
}

export function CourseCode({
  code,
  color,
  size = "small",
  column = false,
}: {
  code: string;
  color: string | undefined;
  size?: "small" | "caption" | "body";
  /** In a list's leading column: one width for every code, so the names beside it start in one column. */
  column?: boolean;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, column && { width: 84 }]}>
      <CourseDot color={color} size={8} />
      <Text size={size} weight="semibold" tabular>
        {code}
      </Text>
    </View>
  );
}

/** The desktop's Loader turning (animate-spin): something is under way right now. */
export function Spinner({ size = 14, color }: { size?: number; color: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icons.Loader size={size} color={color} />
    </Animated.View>
  );
}

/** A thin bar for work under way (a hand-in, a download); `indeterminate` while how far is unknown. */
export function ProgressBar({ value, label, indeterminate = false }: { value: number; label: string; indeterminate?: boolean }) {
  const theme = useTheme();
  if (indeterminate) return <ActivityIndicator accessibilityLabel={label} color={theme.color.primary} />;
  return <Bar value={value} color={theme.color.primary} label={label} style={{ height: 4 }} />;
}
