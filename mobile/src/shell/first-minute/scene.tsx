// The phone's first minute: two doors, one room. Edunex and SIX are two places every ITB student signs in to, and the
// app is the one room behind both. The scene happens around what must happen anyway (one sign-in), so nothing is added
// to wait for and there's nothing to swipe or skip. Second by second (DESIGN.md, "The first minute"):
//
//   1. The stage is Edunex Plus's blue, full height, from the app's first frame (../welcome.tsx). On it: two doors in
//      the upper half, one per system, both the same; between them the app's mark with a still glow, the stage's one
//      light; the headline bottom-left; one button under the thumb. Once drawn, nothing on it moves: no frame is drawn.
//   2. The tap: the button becomes the status in words, in place; the language chip and the note about signing in go
//      with it. While a system connects, a line of light breathes at its door's foot (the one thing that moves). Once
//      it's in, its door lights and shows what the system just said: the name and NIM under Edunex, the programme
//      under SIX, a tick at the foot, a haptic each. The headline stays through all of it.
//   3. Both in: the doors close onto the mark, which answers with one beat.
//   4. The hand-over, at once: the words fade, then the whole stage (doors, mark) lifts away like a curtain. Under it
//      the real Beranda was there all along, filling as the first read brings it. A strip of the stage's blue holds
//      the status bar until the curtain's edge reaches it, so nothing slides across the clock. The scene leaves
//      nothing on Beranda and knows nothing of its layout (./seam.ts).
//
// Nothing here waits for the read: the scene ends about a second after the systems are in. Every move runs on the UI
// thread (Reanimated), on transforms and opacity only, each a timing that ends (no spring left to settle); every
// colour is opaque (./colors.ts) and no shape is clipped, so a frame is a few flat fills. The hand-over is one
// transform on one view, kept as one picture only while it lifts. With Remove animations the same steps cross-fade
// and nothing moves. Loaded only when nobody is signed in (./gate.tsx).
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { errorKey } from "../../../../src/app/bridge";
import { useT } from "../../../../src/app/i18n";
import { displayName } from "../../../../src/app/names";
import { useBridge, useDataset, useSettings, useSignInStep, useSourceState } from "../../../../src/app/store";
import { SourceLogo } from "../../ui/brand";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { useReduceMotion } from "../../ui/motion";
import { Tap } from "../../ui/moves";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../../ui/theme";
import {
  BUTTON,
  CHIP_EDGE_ALPHA,
  DOOR_FACT,
  DOOR_INK,
  DOOR_LIGHT,
  DOOR_LIT,
  DOOR_REST,
  FAILED,
  GLOW_ALPHA,
  HEM,
  MARK_COLOR,
  MARK_INK,
  STAGE,
  STAGE_INK,
} from "./colors";
import { setCovering } from "./covering";
import { setFirstMinuteStageUp } from "./gate";
import { seam } from "./seam";

type Source = "edunex" | "six";
type Scheme = "light" | "dark";
/** A door's three states, each one true: nothing yet, its system signing in, its system in. */
type DoorState = "rest" | "working" | "in";
/** The doors on the stage; the doors closing onto the mark; the stage lifting off Beranda. */
type Phase = "doors" | "joining" | "lifting";

/** The gap between the doors, closed as they join. */
const GAP = 20;
const SIDE = space[6];
/** The mark between the doors: as large as the room under the doors' words lets it be, between these. */
const BADGE = { min: 48, max: 104 } as const;
/** The glow behind the mark, by the mark's size. */
const GLOW = 2.3;
/** A door's tick, and the room under it. */
const TICK = 32;
const FOOT = space[4];
/** What a system just learned: up to three lines of this height (sp) under its name. */
const FACT_LINE = 20;
/** Both in: this long to see the second door light before they join. */
const BOTH_HOLD_MS = 450;
/** One in: this long for the other to come along on the same sign-in; then the hand-over goes without it. */
const OTHER_WAIT_MS = 2_000;
/** The doors closing onto the mark, before the stage moves. */
const JOIN_MS = 520;
/** The stage lifting off Beranda. */
const LIFT_MS = 600;
/** How far into the lift the curtain's edge reaches the status bar: its icons turn then (the curve is fast early). */
const CLEARS_TOP = 0.6;
/** Material's emphasized curve, for the lift; its decelerate, for what arrives. */
const EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);
const ARRIVING = Easing.bezier(0.05, 0.7, 0.1, 1);

export function FirstMinute({ onDone }: { onDone(): void }) {
  const t = useT();
  const scheme: Scheme = useTheme().scheme === "dark" ? "dark" : "light";
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

  const [phase, setPhase] = useState<Phase>("doors");
  const [busy, setBusy] = useState<Source | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Beranda's page shows at the top of the screen: the status bar's icons are its now.
  const [uncovered, setUncovered] = useState(false);
  // Where things are, once drawn: the room the doors have, and where a door's name ends.
  const [area, setArea] = useState<{ y: number; height: number } | null>(null);
  const [nameEnd, setNameEnd] = useState<number | null>(null);

  const edunexIn = edunex !== "signed-out" || account !== undefined;
  const sixIn = six !== "signed-out" || student !== undefined;
  const anyIn = edunexIn || sixIn;
  const bothIn = edunexIn && sixIn;
  // The tap is behind the Student: the button is the status now.
  const asked = busy !== null || anyIn;
  // A system that tried to come along and stopped is said so; one that hasn't tried yet isn't.
  const tried = useRef({ edunex: false, six: false });
  if (edunexStep) tried.current.edunex = true;
  if (sixStep) tried.current.six = true;

  // One value per move, each on the UI thread and each a timing that ends: the doors closing, the mark's beat, the
  // words leaving, the stage lifting off Beranda; and, where the phone asks for less motion, the scene fading off it.
  const join = useSharedValue(0);
  const beat = useSharedValue(0);
  const words = useSharedValue(1);
  const lift = useSharedValue(0);
  const out = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((run: () => void, ms: number) => void timers.current.push(setTimeout(run, ms)), []);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // The stage is up while the doors are: a sign-in page with nothing left for the Student steps aside for it. And it
  // covers the screen until it lifts: what's under it rests and stays out of TalkBack's reach (./covering.ts).
  useEffect(() => {
    setFirstMinuteStageUp(phase === "doors");
    setCovering("scene", phase !== "lifting");
    return () => {
      setFirstMinuteStageUp(false);
      setCovering("scene", false);
    };
  }, [phase]);

  // A system is in: felt and said, once each.
  const was = useRef({ edunexIn, sixIn });
  useEffect(() => {
    const came: Source[] = [];
    if (edunexIn && !was.current.edunexIn) came.push("edunex");
    if (sixIn && !was.current.sixIn) came.push("six");
    was.current = { edunexIn, sixIn };
    if (came.length === 0) return;
    haptic.confirm();
    AccessibilityInfo.announceForAccessibility(came.map((source) => t("scan.connected", { sources: t(`source.${source}`) })).join(". "));
  }, [edunexIn, sixIn, t]);

  const done = useRef(onDone);
  done.current = onDone;
  const handOver = useCallback(() => {
    setPhase("joining");
    // The words go first, so only the stage's blue and its doors pass under the status bar.
    words.value = withDelay(JOIN_MS - 180, withTiming(0, { duration: 160 }));
    if (still) {
      // The same steps as fades: the words, then the stage cross-fades to Beranda. Nothing moves, nothing cuts.
      out.value = withDelay(JOIN_MS, withTiming(1, { duration: motion.duration.long }));
      later(() => {
        setPhase("lifting");
        haptic.confirm();
      }, JOIN_MS);
      later(() => setUncovered(true), JOIN_MS + motion.duration.long / 2);
      later(() => done.current(), JOIN_MS + motion.duration.long + 40);
      return;
    }
    // The whole hand-over is set going here, on the UI thread: the first read's JavaScript can't hold a step of it up.
    // The timers after it only tell the screen reader, the touch layer, the phone's bars and the haptics where it is.
    join.value = withTiming(1, { duration: 360, easing: EMPHASIZED });
    beat.value = withDelay(180, withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 200 })));
    lift.value = withDelay(JOIN_MS, withTiming(1, { duration: LIFT_MS, easing: EMPHASIZED }));
    later(() => haptic.tick(), 240);
    later(() => {
      setPhase("lifting");
      haptic.confirm();
    }, JOIN_MS);
    later(() => setUncovered(true), JOIN_MS + LIFT_MS * CLEARS_TOP);
    later(() => done.current(), JOIN_MS + LIFT_MS + 40);
  }, [still, join, beat, words, lift, out, later]);

  // A system is in: the hand-over starts once the other has come along, or soon after without it (Beranda has its own
  // way to connect the other, and it joins there if it's only slow).
  useEffect(() => {
    if (phase !== "doors" || !anyIn) return;
    const timer = setTimeout(handOver, bothIn ? BOTH_HOLD_MS : OTHER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [phase, anyIn, bothIn, handOver]);

  // The sign-in didn't hold after all (the first read refused it): back to the doors, where the reason is said.
  useEffect(() => {
    if (phase === "doors" || anyIn) return;
    clearTimers();
    for (const value of [join, beat, lift, out]) {
      cancelAnimation(value);
      value.value = 0;
    }
    cancelAnimation(words);
    words.value = 1;
    setUncovered(false);
    setPhase("doors");
  }, [phase, anyIn, clearTimers, join, beat, words, lift, out]);

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

  const fontScale = PixelRatio.getFontScale();
  // Where the doors stand: the upper part of the screen, as tall as the room over the headline lets them be.
  const rowWidth = size.width - SIDE * 2;
  const doorWidth = (rowWidth - GAP) / 2;
  const room = area?.height ?? size.height * 0.4;
  const doorHeight = Math.max(120, Math.min(room - space[2], doorWidth * 2.25));
  const doorsTop = (area?.y ?? insets.top + TOUCH + space[2]) + Math.max(0, room - doorHeight) * 0.35;
  // The mark stands between a door's words (its name, then what its system learned) and its tick, touching neither.
  const wordsEnd = (nameEnd ?? 0) + space[1] + Math.round(3 * FACT_LINE * fontScale);
  const tickTop = doorHeight - FOOT - TICK;
  const badge = Math.max(BADGE.min, Math.min(BADGE.max, tickTop - wordsEnd - space[4]));
  const markY = Math.max(wordsEnd + badge / 2, (wordsEnd + tickTop) / 2);
  const glow = Math.round(badge * GLOW);
  // The curtain is the screen and its rounded lower edge, which waits under the screen until the lift.
  const curtain = size.height + seam.edge;
  const top = insets.top;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const curtainStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * curtain }] }));
  // The strip over the status bar stays until the curtain's edge reaches it, then leaves with it.
  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min(0, curtain * (1 - lift.value) - top) }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value }));
  const leftDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (join.value * GAP) / 2 }] }));
  const rightDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (-join.value * GAP) / 2 }] }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + beat.value * 0.14 }] }));

  // Each part comes up a beat after the one before, once (a fade where the phone asks for less motion).
  const enter = (step: number) =>
    still
      ? FadeIn.delay(step * 60).duration(motion.duration.short)
      : FadeInDown.delay(step * 70)
          .duration(320)
          .easing(ARRIVING);

  const stepOf = (source: Source) => (source === "edunex" ? edunexStep : sixStep);
  const doorState = (source: Source): DoorState =>
    (source === "edunex" ? edunexIn : sixIn) ? "in" : stepOf(source) !== null || busy === source ? "working" : "rest";
  // What each system just said, for its door: Edunex the name and NIM, SIX the programme (the name is said already).
  const learned = (source: Source): string[] =>
    source === "edunex" ? (account ? [displayName(account.name), account.nim] : []) : student ? [student.program ?? student.nim] : [];

  // What the button became: where the sign-in is, in words. Nothing once both are in: the doors say that.
  const sourceName = (source: Source) => t(`source.${source}`);
  const other = (source: Source) => {
    const step = stepOf(source);
    if (step === "slow") return t("signIn.slow", { source: sourceName(source) });
    if (step) return t("welcome.bringingAlong", { source: sourceName(source) });
    return tried.current[source] ? t(source === "six" ? "welcome.sixLater" : "welcome.edunexLater") : "";
  };
  const busyStep = busy === "six" ? sixStep : edunexStep;
  const status = bothIn
    ? ""
    : edunexIn
      ? other("six")
      : sixIn
        ? other("edunex")
        : busyStep === "slow"
          ? t("signIn.slow", { source: sourceName(busy ?? "edunex") })
          : busyStep === "finishing"
            ? t("signIn.finishing", { source: sourceName(busy ?? "edunex") })
            : t("welcome.waitingShort");

  const headline = [t("welcome.headline1"), t("welcome.headline2")];
  const headlineFont = headlineSize(rowWidth, headline);
  const headlineRoom = 2 * Math.round(headlineFont * LINE) * fontScale;
  const lifting = phase === "lifting";
  // Big text or a small phone: the note under the button goes before the doors lose their room.
  const tight = size.height < 700 && fontScale > 1.15;

  return (
    <Animated.View
      testID="screen.firstMinute"
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((now) => (now.width === width && now.height === height ? now : { width, height }));
      }}
      // Lifting, Beranda under it is the Student's to touch and to hear; the scene only finishes leaving.
      pointerEvents={lifting ? "none" : "auto"}
      accessibilityViewIsModal={!lifting}
      accessibilityElementsHidden={lifting}
      importantForAccessibility={lifting ? "no-hide-descendants" : "auto"}
      style={[StyleSheet.absoluteFill, { zIndex: 60 }, rootStyle]}
    >
      {/* White icons on the stage, in both themes. The status bar's turn once the stage has cleared the top of
          Beranda's page; the three buttons' as the lift starts, when its lower edge leaves them. */}
      <StatusBar style={uncovered ? seam.statusBar(scheme) : "light"} />
      <NavigationBar style={lifting ? (scheme === "dark" ? "dark" : "light") : "dark"} />

      {/* The stage and everything on it, one sheet: it lifts as one at the hand-over. */}
      <Animated.View
        // Lifting, it's one picture moved by the GPU: nothing on it is drawn again frame by frame. Only then.
        renderToHardwareTextureAndroid={lifting}
        shouldRasterizeIOS={lifting}
        style={[styles.curtain, { height: curtain, backgroundColor: HEM[scheme] }, curtainStyle]}
      >
        {/* The sheet's face over its hem: in dark the hem is a clear line along the lower edge. */}
        {HEM[scheme] !== STAGE[scheme] && <View style={[styles.face, { backgroundColor: STAGE[scheme] }]} />}
        {/* What's said on the stage: the headline bottom-left, the one button under the thumb. */}
        <View testID="screen.welcome" style={{ height: size.height, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space[4], minHeight: TOUCH + space[2], alignItems: "center" }}>
            {!asked && <LanguageChip />}
          </View>
          {/* The doors' room: they're drawn over it (below), at a size worked out from it. */}
          <View
            onLayout={(event: LayoutChangeEvent) => {
              const { y, height } = event.nativeEvent.layout;
              setArea((now) => (now && now.y === y && now.height === height ? now : { y, height }));
            }}
            style={{ flex: 1, minHeight: 140 }}
          />
          <Animated.View style={wordsStyle}>
            <Animated.View entering={enter(2)} style={{ paddingHorizontal: SIDE, paddingTop: space[4] }}>
              {/* The desktop's headline, broken where it breathes: each half keeps to its one line at any font size. */}
              <View accessible accessibilityRole="header" style={{ minHeight: headlineRoom, justifyContent: "flex-end" }}>
                {headline.map((half) => (
                  <Headline key={half} size={headlineFont}>
                    {half}
                  </Headline>
                ))}
              </View>
            </Animated.View>
            <Animated.View entering={enter(3)} style={{ paddingHorizontal: SIDE, paddingTop: space[5], paddingBottom: space[5], gap: space[3] }}>
              {failed && !asked && (
                <View
                  style={{ borderRadius: shape.md, backgroundColor: FAILED.bg, padding: space[3] }}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Text size="bodyMedium" style={{ color: FAILED.ink }}>
                    {failed}
                  </Text>
                </View>
              )}
              {asked ? (
                // The button's place, now the status: words only, one line, swapped at once and at full strength.
                <View testID="status.signIn" accessibilityLiveRegion="polite" style={{ minHeight: BUTTON_HEIGHT, justifyContent: "center" }}>
                  <Text size="bodyLarge" weight="semibold" style={{ color: STAGE_INK }}>
                    {status}
                  </Text>
                </View>
              ) : (
                <Tap onPress={() => void signIn("edunex")} testID="action.signIn" style={[styles.button, { backgroundColor: BUTTON.bg[scheme] }]}>
                  <Text size="bodyLarge" weight="semibold" style={{ color: BUTTON.ink, textAlign: "center" }}>
                    {t("mobile.welcome.signIn")}
                  </Text>
                </Tap>
              )}
              {!tight && (
                // About signing in: it leaves with the button, its room kept so nothing above it moves at the tap.
                <Text
                  size="bodySmall"
                  style={{ color: STAGE_INK, opacity: asked ? 0 : 1 }}
                  accessibilityElementsHidden={asked}
                  importantForAccessibility={asked ? "no" : "auto"}
                >
                  {t("welcome.connectLead")}
                </Text>
              )}
            </Animated.View>
          </Animated.View>
        </View>

        {/* The doors and the mark between them: the screen's one picture. Nothing on them is a control. */}
        {area !== null && (
          <View pointerEvents="none" style={{ position: "absolute", left: SIDE, top: doorsTop, width: rowWidth, height: doorHeight }}>
            <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
              {(["edunex", "six"] as const).map((source, index) => (
                <Animated.View key={source} entering={enter(index)} style={{ flex: 1 }}>
                  <Animated.View style={[{ flex: 1 }, index === 0 ? leftDoor : rightDoor]}>
                    <Door
                      source={source}
                      state={doorState(source)}
                      // Seen only once Microsoft's page has stepped aside: nothing breathes under it.
                      breathing={stepOf(source) !== null}
                      facts={learned(source)}
                      width={doorWidth}
                      height={doorHeight}
                      scheme={scheme}
                      onName={index === 0 ? setNameEnd : undefined}
                    />
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
            {/* The app's mark, there from the start (once the doors know where their names end): the doors close onto
                it, and it leaves with the stage. */}
            {nameEnd !== null && (
              <Animated.View
                entering={enter(1)}
                style={{ position: "absolute", left: rowWidth / 2 - glow / 2, top: markY - glow / 2, width: glow, height: glow }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Glow size={glow} scheme={scheme} />
                <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, markStyle]}>
                  <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: MARK_COLOR[scheme] }]}>
                    <Image
                      source={require("../../../assets/android-icon-monochrome.png")}
                      style={{ width: badge * 1.5, height: badge * 1.5, tintColor: MARK_INK }}
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </View>
        )}
      </Animated.View>

      {/* The stage's blue held over the status bar from the hand-over on: the doors pass under it, not across the clock. */}
      {phase !== "doors" && top > 0 && (
        <Animated.View pointerEvents="none" style={[styles.strip, { height: top, backgroundColor: STAGE[scheme] }, stripStyle]} />
      )}
    </Animated.View>
  );
}

/** The sign-in button's height, and the status line's that takes its place: nothing under it moves at the tap. */
const BUTTON_HEIGHT = 52;

/** The headline's size at its largest (sp), its line's height by its size, and a letter's share of it (a little over). */
const HEADLINE = 32;
const LINE = 1.22;
const LETTER = 0.52;

/**
 * The headline's two halves at one size: the largest at which the longer half keeps to its one line on this screen at
 * this font size, so no word is left alone on a line and the halves never differ.
 */
function headlineSize(width: number, halves: readonly string[]): number {
  const scale = PixelRatio.getFontScale();
  const longest = Math.max(...halves.map((half) => half.length));
  return Math.min(HEADLINE, width / (longest * LETTER) / scale);
}

/** One line of the headline (a hair smaller rather than broken, should it run wide). */
function Headline({ size, children }: { size: number; children: string }) {
  return (
    <Text
      size="headlineLarge"
      face="display"
      weight="bold"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={{ color: STAGE_INK, fontSize: size, lineHeight: Math.round(size * LINE), letterSpacing: -0.4 }}
    >
      {children}
    </Text>
  );
}

/** The still glow behind the mark: the stage's one light, drawn once and never moved. */
const Glow = memo(function Glow({ size, scheme }: { size: number; scheme: Scheme }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="firstMinuteGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0.4" stopColor={DOOR_LIGHT} stopOpacity={GLOW_ALPHA[scheme]} />
          <Stop offset="1" stopColor={DOOR_LIGHT} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#firstMinuteGlow)" />
    </Svg>
  );
});

/**
 * A system as a door: its logo and its name on an arch. Nothing on it is a control, and both doors are the same until
 * a system moves. At rest nothing on it changes. While its sign-in runs, a line of light breathes at its foot: the
 * scene's one endless move, an opacity on one small view, stopped the moment the system is in or the app is behind
 * something. Once it's in, the door's lit face fades in over the resting one, whole (its name in the system's colour,
 * what the system just said, a tick at its foot), so every frame between the two is two readable faces, never white
 * words on a half-lit door. Its size never changes. With less motion asked for, the line is still and nothing pops.
 */
function Door({
  source,
  state,
  breathing,
  facts,
  width,
  height,
  scheme,
  onName,
}: {
  source: Source;
  state: DoorState;
  /** The line of light may breathe (the stage is in view). */
  breathing: boolean;
  /** What the system just said about the Student, a line each. */
  facts: readonly string[];
  width: number;
  height: number;
  scheme: Scheme;
  /** Where the name ends, from the door's top. */
  onName?: (y: number) => void;
}) {
  const t = useT();
  const still = useReduceMotion();
  const isIn = state === "in";
  const working = state === "working";
  // The lit face over the resting one, the tick's size, and the line of light at the foot.
  const lit = useSharedValue(isIn ? 1 : 0);
  const tick = useSharedValue(1);
  const light = useSharedValue(0);
  useEffect(() => {
    lit.value = withTiming(isIn ? 1 : 0, { duration: motion.duration.medium });
    if (isIn && !still) {
      tick.value = 0.6;
      tick.value = withDelay(motion.duration.medium - 60, withSequence(withTiming(1.15, { duration: 140 }), withTiming(1, { duration: 160 })));
    }
  }, [isIn, still, lit, tick]);
  useEffect(() => {
    if (!working) {
      light.value = 0;
      return;
    }
    light.value = 1;
    // Not through useLoopWhileShown: that rests whatever the stage covers, and this is on the stage.
    if (!breathing || still) return;
    light.value = withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(light);
  }, [working, breathing, still, light]);
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.value }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tick.value }] }));
  const name = t(`source.${source}`);
  const says = isIn
    ? [t("scan.connected", { sources: name }), ...facts].join(", ")
    : working
      ? t("signIn.joining", { source: name })
      : `${name}: ${t("welcome.notConnected")}`;
  // A short door (a small phone, big text) keeps a smaller logo, so the mark has its room under the name.
  const logo = height < 240 ? 36 : 44;
  const arch = {
    borderTopLeftRadius: width / 2,
    borderTopRightRadius: width / 2,
    borderBottomLeftRadius: shape.lg,
    borderBottomRightRadius: shape.lg,
  };
  const inside = {
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Math.min(space[8], Math.max(space[4], width * 0.2)),
    paddingBottom: FOOT,
    paddingHorizontal: space[2],
  } as const;
  const title = (color: string) => (
    <>
      <SourceLogo source={source} size={logo} />
      <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color, letterSpacing: -0.3 }}>
        {name}
      </Text>
    </>
  );
  return (
    <View testID={`door.${source}`} accessible accessibilityLabel={says} style={[{ flex: 1, backgroundColor: DOOR_REST[scheme] }, arch, inside]}>
      {/* The resting face: the name in white, and the line of light while the system connects. */}
      <View
        onLayout={(event: LayoutChangeEvent) => onName?.(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
        style={{ alignItems: "center", gap: space[2] }}
      >
        {title(STAGE_INK)}
      </View>
      <View style={{ height: TICK, justifyContent: "center" }}>
        <Animated.View style={[styles.light, lightStyle]} />
      </View>
      {/* The lit face, whole: the same logo and name in the same place, then what the system said, then the tick. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DOOR_LIT[scheme] }, arch, inside, litStyle]}>
        <View style={{ alignItems: "center", gap: space[2], alignSelf: "stretch" }}>
          {title(DOOR_INK[scheme][source])}
          <View style={{ alignSelf: "stretch", marginTop: -space[1] }}>
            {facts.map((fact) => (
              <Text key={fact} size="bodyMedium" weight="medium" tabular numberOfLines={2} style={{ color: DOOR_FACT, textAlign: "center" }}>
                {fact}
              </Text>
            ))}
          </View>
        </View>
        <Animated.View style={[{ height: TICK, justifyContent: "center" }, tickStyle]}>
          <Icons.CheckCircle size={TICK} weight="fill" color={DOOR_INK[scheme][source]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Indonesia or English, as a small chip: the phone's language picked it; a tap switches. Gone once the Student taps in. */
function LanguageChip() {
  const t = useT();
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
      android_ripple={{ color: "rgba(255,255,255,0.24)" }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [styles.chip, iosPressed(pressed)]}
    >
      <Icons.Globe size={18} color={STAGE_INK} />
      <Text size="labelLarge" style={{ color: STAGE_INK }}>
        {name[lang]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  curtain: { position: "absolute", top: 0, left: 0, right: 0, borderBottomLeftRadius: seam.edge, borderBottomRightRadius: seam.edge },
  face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 2, borderBottomLeftRadius: seam.edge, borderBottomRightRadius: seam.edge },
  strip: { position: "absolute", top: 0, left: 0, right: 0 },
  light: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: DOOR_LIGHT },
  button: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    overflow: "hidden",
  },
  badge: {
    borderWidth: 3,
    borderColor: MARK_INK,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    height: 32,
    paddingHorizontal: space[3],
    borderRadius: shape.sm,
    borderWidth: 1,
    borderColor: `rgba(255,255,255,${CHIP_EDGE_ALPHA})`,
    overflow: "hidden",
  },
});
