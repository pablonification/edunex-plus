// The phone's first minute: two doors, one room. Edunex and SIX are two places every ITB student signs in to, and the
// app is the one room behind both. The scene happens around what must happen anyway (one sign-in, then a first read
// that takes tens of seconds), so nothing is added to wait for and there's nothing to swipe or skip:
//
//   1. Two doors, one per system, each with its own logo and what it holds, and one button in the thumb's reach.
//   2. Each door wakes while its system signs in and fills with its colour as it connects, with a haptic each.
//   3. The doors close up, the app's mark lands on the seam, and its blue floods the screen: the Student is in the room.
//   4. The room fills with the Student's own things as the read brings them, by name (./arrivals.ts), over two small
//      doors that fill as each system is read.
//   5. Once Beranda has what it shows, the blue lifts into Beranda's header, the greeting already in its place, and
//      the scene fades off the real screen that was under it all along (./seam.ts).
//
// All motion runs on the UI thread (Reanimated). With Remove animations the same steps cross-fade and nothing moves.
// Loaded only when nobody is signed in (./gate.tsx).
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorKey } from "../../../../src/app/bridge";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useSaved } from "../../../../src/app/saved";
import { useBridge, useDataset, useSettings, useSignInStep, useSourceState } from "../../../../src/app/store";
import { firstRead, homeReady, SCAN_PARTS } from "../../../../src/core/first-scan";
import type { DatasetName } from "../../../../src/core/models";
import type { Saved } from "../../../../src/core/saved";
import { useReadStatuses } from "../../screens/first-scan/scan";
import { partOfDay } from "../../screens/home/greeting";
import { BigButton } from "../../ui/big-button";
import { SourceLogo } from "../../ui/brand";
import { haptic } from "../../ui/haptics";
import { type IconProps, Icons } from "../../ui/icons";
import { useReduceMotion } from "../../ui/motion";
import { iosPressed, PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../../ui/theme";
import { type Arrival, type ArrivalKind, useArrivals } from "./arrivals";
import { seam } from "./seam";

type Source = "edunex" | "six";
type DoorState = "rest" | "waking" | "lit";
type Phase = "doors" | "room" | "leaving";

/**
 * Each system's own colour, light and dark: Edunex's blue, SIX's navy. `full` is the door once its system is in (white
 * reads on it at 4.5:1 or more), `tint` the door before, `ink` what's written on the tint.
 */
const DOOR_COLOR: Record<Source, Record<"light" | "dark", { full: string; tint: string; ink: string }>> = {
  edunex: {
    light: { full: "#1f63e0", tint: "#dbe6ff", ink: "#1450c4" },
    dark: { full: "#1f63e0", tint: "#1b2c52", ink: "#b9ceff" },
  },
  six: {
    light: { full: "#0f2f6b", tint: "#d5dbea", ink: "#0f2f6b" },
    dark: { full: "#2b4a94", tint: "#1a2238", ink: "#b4c0e0" },
  },
};
/** What's written on a door's full colour, on the mark's badge and in the knob once it's a check. */
const ON_FULL = "#ffffff";
/** What each door holds, said on it. */
const HOLDS: Record<Source, "mobile.first.holds.edunex" | "mobile.first.holds.six"> = {
  edunex: "mobile.first.holds.edunex",
  six: "mobile.first.holds.six",
};

/** What the room reads, and what decides Beranda is ready (src/core/first-scan.ts homeReady). */
const READ: readonly DatasetName[] = ["six.student", ...SCAN_PARTS.edunex, ...SCAN_PARTS.six, ...SCAN_PARTS.itb];

/** The gap between the doors, closed as they join. */
const GAP = 14;
const SIDE = space[6];
/** The mark's badge on the seam, and the dot its blue floods out from. */
const BADGE = 64;
const FLOOD = 80;
/** Both in: this long to see the second door fill before they join. */
const BOTH_HOLD_MS = 700;
/** One in: this long for the other to come along on the same sign-in before the room opens without it. */
const OTHER_WAIT_MS = 3_500;
/** The join and the flood, start to room. */
const OPEN_MS = 1_250;
/** The room stays at least this long once open, so the hand-over never cuts the flood short. */
const MIN_ROOM_MS = 1_800;
/** The room never holds the Student longer than this: Beranda opens with what's in and fills in there. */
const PATIENCE_MS = 25_000;
const LIFT_MS = 560;
/** Material's emphasized curve, for the flood and the lift. */
const EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);
/** The newest thing at full strength, each older one fainter, seven at most (fewer on a small phone). */
const AGES = [1, 0.72, 0.56, 0.42, 0.3, 0.2, 0.14] as const;
/** A thing's row, at the normal font size. */
const ROW = 52;

const KIND_ICON: Record<ArrivalKind, React.ComponentType<IconProps>> = {
  course: Icons.BookOpen,
  task: Icons.ListChecks,
  class: Icons.Calendar,
  program: Icons.GraduationCap,
};

export function FirstMinute({ onDone }: { onDone(): void }) {
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const theme = useTheme();
  const v = theme.v4;
  const insets = useSafeAreaInsets();
  const bridge = useBridge();
  const still = useReduceMotion();
  const screen = useWindowDimensions();
  const [size, setSize] = useState({ width: screen.width, height: screen.height });
  const edunex = useSourceState("edunex");
  const six = useSourceState("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const edunexStep = useSignInStep("edunex");
  const sixStep = useSignInStep("six");
  const saved = useSaved(READ);
  const statuses = useReadStatuses();

  const [phase, setPhase] = useState<Phase>("doors");
  const [stageGone, setStageGone] = useState(false);
  const [busy, setBusy] = useState<Source | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [seamY, setSeamY] = useState<number | null>(null);
  const [waited, setWaited] = useState({ least: false, patience: false });

  const edunexIn = edunex !== "signed-out" || account !== undefined;
  const sixIn = six !== "signed-out" || student !== undefined;
  const anyIn = edunexIn || sixIn;
  const bothIn = edunexIn && sixIn;
  const ready = homeReady(saved, statuses);
  const read = firstRead(saved, statuses);

  // One value per move, each on the UI thread: the doors closing up, the mark landing, the blue flooding out, the
  // room's things coming in, the blue lifting into Beranda's header, the scene fading off Beranda.
  const join = useSharedValue(0);
  const mark = useSharedValue(0);
  const flood = useSharedValue(0);
  const roomIn = useSharedValue(0);
  const lift = useSharedValue(0);
  const out = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((run: () => void, ms: number) => void timers.current.push(setTimeout(run, ms)), []);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // The status bar's icons read on what's under them: the page's colour until the blue has covered it, then white as
  // on Beranda. Beranda asks for white the moment a system is in, while the stage is still up: asked again right after.
  const [barTurn, setBarTurn] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: again each time a system comes in or goes
  useEffect(() => setBarTurn((turn) => turn + 1), [anyIn]);

  // A door fills: felt, once each.
  const was = useRef({ edunexIn, sixIn });
  useEffect(() => {
    if ((edunexIn && !was.current.edunexIn) || (sixIn && !was.current.sixIn)) haptic.confirm();
    was.current = { edunexIn, sixIn };
  }, [edunexIn, sixIn]);

  const openRoom = useCallback(() => {
    setPhase("room");
    haptic.tick();
    if (still) {
      join.value = 1;
      mark.value = withTiming(1, { duration: motion.duration.short });
      flood.value = withDelay(200, withTiming(1, { duration: motion.duration.medium }));
      roomIn.value = withDelay(450, withTiming(1, { duration: motion.duration.medium }));
    } else {
      join.value = withSpring(1, motion.spatialDefault);
      mark.value = withDelay(140, withSpring(1, motion.expressive));
      flood.value = withDelay(560, withTiming(1, { duration: 620, easing: EMPHASIZED }));
      roomIn.value = withDelay(1_100, withTiming(1, { duration: 280 }));
    }
    later(() => setStageGone(true), OPEN_MS);
    later(() => setWaited((so) => ({ ...so, least: true })), OPEN_MS + MIN_ROOM_MS);
    later(() => setWaited((so) => ({ ...so, patience: true })), PATIENCE_MS);
  }, [still, join, mark, flood, roomIn, later]);

  // A system is in: the room opens once the other has come along, or soon after without it.
  useEffect(() => {
    if (phase !== "doors" || !anyIn) return;
    const timer = setTimeout(openRoom, bothIn ? BOTH_HOLD_MS : OTHER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [phase, anyIn, bothIn, openRoom]);

  // The sign-in didn't hold after all (the first read refused it): back to the doors, where the reason is said.
  useEffect(() => {
    if (phase !== "room" || anyIn) return;
    clearTimers();
    for (const value of [join, mark, flood, roomIn, lift, out]) {
      cancelAnimation(value);
      value.value = 0;
    }
    setStageGone(false);
    setWaited({ least: false, patience: false });
    setPhase("doors");
  }, [phase, anyIn, clearTimers, join, mark, flood, roomIn, lift, out]);

  // Beranda has what it shows (or the room has held long enough): the blue lifts into its header, then the scene goes.
  useEffect(() => {
    if (phase !== "room" || !waited.least || !(ready || waited.patience)) return;
    setPhase("leaving");
    haptic.confirm();
    if (still) {
      out.value = withTiming(1, { duration: motion.duration.long });
      later(onDone, motion.duration.long + 40);
    } else {
      lift.value = withTiming(1, { duration: LIFT_MS, easing: EMPHASIZED });
      out.value = withDelay(LIFT_MS + 80, withTiming(1, { duration: motion.duration.medium }));
      later(onDone, LIFT_MS + 80 + motion.duration.medium + 40);
    }
  }, [phase, waited, ready, still, lift, out, later, onDone]);

  const signIn = async (source: Source) => {
    setFailed(null);
    setBusy(source);
    try {
      // Edunex on Microsoft's page; SIX tries the same session out of sight right after (signInToBoth).
      await bridge.invoke("auth.signIn", { source });
    } catch (error) {
      setFailed(t(errorKey(error, "welcome.signInFailed")));
    } finally {
      setBusy(null);
    }
  };

  const arrivals = useArrivals(phase === "room", () => haptic.tick());

  const rest = seam.restHeight(insets);
  const cover = (2 * Math.hypot(size.width, size.height)) / FLOOD + 1;
  const travel = size.height - rest;
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const stageBack = useAnimatedStyle(() => ({ opacity: flood.value >= 1 ? 0 : 1 }));
  const floodStyle = useAnimatedStyle(() => ({
    opacity: still || flood.value <= 0 || flood.value >= 1 ? 0 : 1,
    transform: [{ scale: Math.max(0.001, flood.value * cover) }],
  }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: still ? flood.value : flood.value >= 1 ? 1 : 0,
    transform: [{ translateY: -lift.value * travel }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: mark.value * (1 - roomIn.value), transform: [{ scale: still ? 1 : mark.value }] }));
  const leftDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (join.value * GAP) / 2 }] }));
  const rightDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (-join.value * GAP) / 2 }] }));
  const greetingStyle = useAnimatedStyle(() => ({ opacity: roomIn.value }));
  const roomStyle = useAnimatedStyle(() => ({ opacity: roomIn.value * (1 - Math.min(1, lift.value * 3)) }));

  // Each part comes up a beat after the one before (a fade where the phone asks for less motion).
  const enter = (step: number) =>
    still
      ? FadeIn.delay(step * 60)
      : FadeInDown.delay(step * 80)
          .springify()
          .damping(18)
          .stiffness(180);

  const doorWidth = (size.width - SIDE * 2 - GAP) / 2;
  // What each door holds is said on it where there's room: a small phone or big text keeps the logo and the name.
  const roomy = size.height >= 700 && PixelRatio.getFontScale() <= 1.15;
  const doorState = (source: Source): DoorState => {
    const isIn = source === "edunex" ? edunexIn : sixIn;
    const step = source === "edunex" ? edunexStep : sixStep;
    return isIn ? "lit" : step !== null || busy === source ? "waking" : "rest";
  };

  const name = account?.name ?? student?.name;
  const part = partOfDay(new Date(now).getHours(), lang);
  const hello = name ? t(`mobile.home.hello.${part}`, { name: firstName(name) }) : t(`time.greeting.${part}`);
  const courses = useDataset("edunex.courses")?.length ?? 0;
  const tasks = useDataset("edunex.tasks")?.length ?? 0;
  const counts = [courses ? t("scan.read.courses", { count: courses }) : null, tasks ? t("scan.read.tasks", { count: tasks }) : null]
    .filter(Boolean)
    .join(" · ");
  const reading =
    read.progress < 1 && read.next
      ? t("mobile.home.reading", { part: `${t(`source.${read.next.source}`)} · ${t(`scan.part.${read.next.part}`)}` })
      : t("welcome.readingWait");
  // As many rows as the room holds over its two small doors, so the newest is never cut off.
  const listHeight = size.height - rest - space[4] - insets.bottom - space[6] - TOUCH - space[6];
  const rows = Math.max(2, Math.min(AGES.length, Math.floor(listHeight / (ROW * PixelRatio.getFontScale()))));
  const shown = arrivals.slice(-rows);
  const ink = seam.ink(v);

  return (
    <Animated.View
      testID="screen.firstMinute"
      onLayout={(event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      pointerEvents={phase === "leaving" ? "none" : "auto"}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { zIndex: 60 }, rootStyle]}
    >
      <StatusBar key={barTurn} style={stageGone || theme.scheme === "dark" ? "light" : "dark"} />
      {/* The stage: the page's own colour, there until the blue has covered it. Beranda waits under it. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: v.page }, stageBack]} />

      {!stageGone && (
        <View
          testID="screen.welcome"
          importantForAccessibility={phase === "doors" ? "auto" : "no-hide-descendants"}
          style={[StyleSheet.absoluteFill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space[2], minHeight: TOUCH + space[2], alignItems: "center" }}>
            <LanguageChip />
          </View>
          <View
            onLayout={(event: LayoutChangeEvent) => setSeamY(event.nativeEvent.layout.y + event.nativeEvent.layout.height / 2)}
            style={{ flex: 1, minHeight: 180, justifyContent: "center", paddingVertical: space[2] }}
          >
            {/* The doors: the screen's one picture, as tall as a door is, in the middle of the room left over. */}
            <View style={{ flex: 1, maxHeight: doorWidth * 2.3, flexDirection: "row", gap: GAP, marginHorizontal: SIDE }}>
              <Animated.View entering={enter(0)} style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1 }, leftDoor]}>
                  <Door source="edunex" state={doorState("edunex")} width={doorWidth} roomy={roomy} />
                </Animated.View>
              </Animated.View>
              <Animated.View entering={enter(1)} style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1 }, rightDoor]}>
                  <Door source="six" state={doorState("six")} width={doorWidth} roomy={roomy} />
                </Animated.View>
              </Animated.View>
            </View>
          </View>
          <Animated.View entering={enter(2)} style={{ marginTop: space[4], paddingHorizontal: SIDE }}>
            <Text size="headlineMedium" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg, letterSpacing: -0.4 }}>
              Edunex Plus
            </Text>
            <Text size="bodyLarge" style={{ color: v.muted, marginTop: space[1] }}>
              {t("mobile.welcome.line")}
            </Text>
          </Animated.View>
          <Animated.View entering={enter(3)} style={{ paddingHorizontal: SIDE, paddingTop: space[6], paddingBottom: space[6], gap: space[3] }}>
            {failed && (
              <View style={{ borderRadius: shape.md, backgroundColor: v.redBg, padding: space[3] }} accessibilityLiveRegion="polite">
                <Text size="bodyMedium" style={{ color: v.redFg }}>
                  {failed}
                </Text>
              </View>
            )}
            <BigButton busy={busy !== null || anyIn} onPress={() => void signIn("edunex")} testID="action.signIn">
              {t("mobile.welcome.signIn")}
            </BigButton>
            <Text size="bodySmall" style={{ color: v.muted, textAlign: "center" }}>
              {t("welcome.connectLead")}
            </Text>
          </Animated.View>
        </View>
      )}

      {/* The app's blue, out from the seam until it covers the screen; then one sheet of it, which lifts at the end. */}
      {seamY !== null && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flood, { left: size.width / 2 - FLOOD / 2, top: seamY - FLOOD / 2, backgroundColor: seam.color(v) }, floodStyle]}
        />
      )}
      <Animated.View pointerEvents="none" style={[styles.panel, { height: size.height, backgroundColor: seam.color(v) }, panelStyle]} />

      {/* The app's mark, landing on the seam where the two doors meet. */}
      {seamY !== null && (
        <Animated.View pointerEvents="none" style={[styles.badge, { left: size.width / 2 - BADGE / 2, top: seamY - BADGE / 2 }, badgeStyle]}>
          <Image
            source={require("../../../assets/android-icon-monochrome.png")}
            style={{ width: BADGE * 1.5, height: BADGE * 1.5, tintColor: DOOR_COLOR.edunex.light.full }}
            accessibilityIgnoresInvertColors
            accessibilityElementsHidden
          />
        </Animated.View>
      )}

      {phase !== "doors" && (
        <>
          {/* The greeting, where Beranda's own is: it doesn't move when the scene goes. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: insets.top,
                left: seam.greeting.inset,
                right: seam.greeting.inset,
                height: seam.greeting.height,
                justifyContent: "center",
              },
              greetingStyle,
            ]}
          >
            <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} accessibilityRole="header" style={{ color: ink, letterSpacing: -0.3 }}>
              {hello}
            </Text>
          </Animated.View>
          <Animated.View
            testID="firstMinute.room"
            style={[{ position: "absolute", left: SIDE, right: SIDE, top: rest + space[4], bottom: insets.bottom + space[6] }, roomStyle]}
          >
            {/* The Student's own things, down the room as they come: the newest last and strongest. */}
            <View style={{ flex: 1, overflow: "hidden" }}>
              {shown.map((item, i) => (
                <ArrivalRow key={item.key} item={item} age={shown.length - 1 - i} ink={ink} still={still} />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[6], minHeight: TOUCH }}>
              <View style={{ flexDirection: "row", gap: space[1] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SmallDoor ink={ink} isIn={edunexIn} share={shareRead(saved, "edunex")} />
                <SmallDoor ink={ink} isIn={sixIn} share={shareRead(saved, "six")} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {counts ? (
                  <Text size="bodyLarge" weight="medium" tabular numberOfLines={1} style={{ color: ink }}>
                    {counts}
                  </Text>
                ) : null}
                <Text testID="status.firstRead" size="bodySmall" numberOfLines={1} accessibilityLiveRegion="polite" style={{ color: ink, opacity: 0.8 }}>
                  {reading}
                </Text>
              </View>
              {/* SIX didn't come along on the same sign-in: its door is here to open, and nothing waits for it. */}
              {phase === "room" && edunexIn && !sixIn && sixStep === null && busy !== "six" && (
                <PressScale
                  onPress={() => void signIn("six")}
                  testID="action.firstMinute.six"
                  style={{
                    minHeight: TOUCH,
                    borderRadius: TOUCH / 2,
                    borderWidth: 1.5,
                    borderColor: ink,
                    paddingHorizontal: space[4],
                    justifyContent: "center",
                  }}
                >
                  <Text size="labelLarge" style={{ color: ink }}>
                    {t("welcome.connectSource", { source: t("source.six") })}
                  </Text>
                </PressScale>
              )}
            </View>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

/** How much of what the scan reads from a system is in, 0 to 1. */
function shareRead(saved: Saved, source: Source): number {
  const parts: readonly DatasetName[] = SCAN_PARTS[source];
  return parts.filter((name) => saved[name] !== undefined).length / parts.length;
}

/**
 * A system as a door, in its own colour: its logo, its name and what it holds. At rest it's a pale shape with the
 * room's light along its floor. The light breathes up the door while its sign-in runs, and rises to fill it, the knob
 * turning to a check, once it's connected. With less motion asked for, the colour fades in and nothing rises.
 */
function Door({ source, state, width, roomy }: { source: Source; state: DoorState; width: number; roomy: boolean }) {
  const t = useT();
  const theme = useTheme();
  const still = useReduceMotion();
  const { full, tint, ink } = DOOR_COLOR[source][theme.scheme];
  const lit = state === "lit";
  const [height, setHeight] = useState(0);
  // How far up the door the light is, 0 to 1.
  const level = useSharedValue(lit ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (state === "lit") {
      level.value = still ? withTiming(1, { duration: motion.duration.short }) : withSpring(1, motion.spatialSlow);
      if (!still) pop.value = withSequence(withTiming(1.035, { duration: 110 }), withSpring(1, motion.expressive));
    } else if (state === "waking") {
      level.value = still
        ? withTiming(0.2, { duration: motion.duration.short })
        : withRepeat(withSequence(withTiming(0.3, { duration: 640 }), withTiming(0.16, { duration: 640 })), -1);
    } else level.value = withTiming(0, { duration: motion.duration.medium });
  }, [state, still, level, pop]);
  const lightStyle = useAnimatedStyle(() =>
    still ? { opacity: level.value, transform: [{ translateY: 0 }] } : { opacity: 1, transform: [{ translateY: (1 - level.value) * height }] },
  );
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const name = t(`source.${source}`);
  const says = lit
    ? t("scan.connected", { sources: name })
    : state === "waking"
      ? t("signIn.finishing", { source: name })
      : `${name}: ${t("welcome.notConnected")}`;
  // What's written turns white once the light has risen past it, not the moment it starts.
  const [white, setWhite] = useState(lit);
  useEffect(() => {
    if (!lit) return setWhite(false);
    const timer = setTimeout(() => setWhite(true), still ? 0 : 220);
    return () => clearTimeout(timer);
  }, [lit, still]);
  const fg = white ? ON_FULL : ink;
  return (
    <Animated.View
      testID={`door.${source}`}
      accessible
      accessibilityLabel={says}
      accessibilityLiveRegion="polite"
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      style={[
        {
          flex: 1,
          borderTopLeftRadius: width / 2,
          borderTopRightRadius: width / 2,
          borderBottomLeftRadius: shape.lg,
          borderBottomRightRadius: shape.lg,
          backgroundColor: tint,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Math.max(space[4], width * 0.2),
          paddingBottom: space[5],
          paddingHorizontal: space[2],
        },
        popStyle,
      ]}
    >
      {/* The room's light: along the floor at rest, up the door as its system comes in. Drawn once the door's height
          is known, so it never shows full for a frame. */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: full }} />
      {height > 0 && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: full }, lightStyle]} />}
      <View style={{ alignItems: "center", gap: space[2] }}>
        <SourceLogo source={source} size={44} />
        <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} style={{ color: fg, letterSpacing: -0.3 }}>
          {name}
        </Text>
        {roomy &&
          t(HOLDS[source])
            .split(" · ")
            .map((word) => (
              <Text key={word} size="bodyMedium" numberOfLines={1} style={{ color: fg }}>
                {word}
              </Text>
            ))}
      </View>
      {/* The knob: a ring until its system is in, then a check. */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: white ? 0 : 2,
          borderColor: state === "rest" ? ink : ON_FULL,
          backgroundColor: white ? ON_FULL : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {white && <Icons.Check size={18} weight="bold" color={full} />}
      </View>
    </Animated.View>
  );
}

/** A door, small, in the room: an outline that fills from the floor as its system is read; faint while it isn't in. */
function SmallDoor({ ink, isIn, share }: { ink: string; isIn: boolean; share: number }) {
  return (
    <View style={[styles.smallDoor, { borderColor: ink, opacity: isIn ? 1 : 0.4 }]}>
      <View style={{ height: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`, backgroundColor: ink }} />
    </View>
  );
}

/** One thing the read brought: what kind (its icon), its name, and the one fact beside it. */
function ArrivalRow({ item, age, ink, still }: { item: Arrival; age: number; ink: string; still: boolean }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <Animated.View
      entering={still ? FadeIn.duration(motion.duration.medium) : FadeInDown.springify().damping(18).stiffness(200)}
      layout={still ? undefined : LinearTransition.springify().damping(22).stiffness(240)}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: ROW, opacity: AGES[age] ?? 0 }}>
        <Icon size={22} weight="fill" color={ink} />
        <Text size="titleLarge" face="display" weight="semibold" numberOfLines={1} style={{ flex: 1, color: ink, letterSpacing: -0.2 }}>
          {item.title}
        </Text>
        {item.meta && (
          <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: ink, opacity: 0.8 }}>
            {item.meta}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/** Indonesia or English, as a small chip: the phone's language picked it; a tap switches. Settings has it later. */
function LanguageChip() {
  const t = useT();
  const v = useTheme().v4;
  const bridge = useBridge();
  const { lang } = useSettings();
  const other = lang === "id" ? "en" : "id";
  const name = { id: "Indonesia", en: "English" } as const;
  return (
    <Pressable
      testID="action.welcomeLanguage"
      accessibilityRole="button"
      accessibilityLabel={`${t("settings.language")}: ${name[lang]}`}
      accessibilityHint={name[other]}
      onPress={() => void bridge.invoke("settings.update", { lang: other }).catch(() => undefined)}
      android_ripple={{ color: v.line }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [[styles.chip, { borderColor: v.line }], iosPressed(pressed)]}
    >
      <Icons.Globe size={18} color={v.muted} />
      <Text size="labelLarge" style={{ color: v.muted }}>
        {name[lang]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flood: { position: "absolute", width: FLOOD, height: FLOOD, borderRadius: FLOOD / 2 },
  panel: { position: "absolute", top: 0, left: 0, right: 0 },
  badge: {
    position: "absolute",
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: ON_FULL,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  smallDoor: {
    width: 20,
    height: 28,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1.5,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    height: 32,
    paddingHorizontal: space[3],
    borderRadius: shape.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
});
