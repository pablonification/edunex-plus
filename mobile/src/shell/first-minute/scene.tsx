// The phone's first minute: two doors, one room. Edunex and SIX are two places every ITB student signs in to, and the
// app is the one room behind both. The scene happens around what must happen anyway (one sign-in), so nothing is added
// to wait for and there's nothing to swipe or skip. Second by second (DESIGN.md, "The first minute"):
//
//   1. The stage is Edunex Plus's blue, full height, from the app's first frame (../welcome.tsx). On it: two doors in
//      the upper half, one per system, both the same; the headline bottom-left; one button under the thumb.
//   2. The tap: the button becomes the status in words, in place, and the language chip goes. A door breathes, a line
//      of light under it, while its system signs in, and lights with a tick once it's in, a haptic each. Three honest
//      states, nothing measured. With the first system in, the headline becomes the greeting, by first name.
//   3. The doors close up and the app's mark lands on the seam between them.
//   4. The hand-over, at once: the whole stage (doors, mark, greeting) lifts away like a curtain. Under it the real
//      Beranda was there all along, its own blocks in their places and filling as the first read brings them. The
//      scene leaves nothing on Beranda and knows nothing of its layout (./seam.ts).
//
// Nothing here waits for the read: the scene ends about a second after the systems are in. Every move runs on the UI
// thread (Reanimated), on transforms and opacity only, and the hand-over is one transform on one view. With Remove
// animations the same steps cross-fade and nothing moves. Loaded only when nobody is signed in (./gate.tsx).
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorKey } from "../../../../src/app/bridge";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useBridge, useDataset, useSettings, useSignInStep, useSourceState } from "../../../../src/app/store";
import { SourceLogo } from "../../ui/brand";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { useReduceMotion } from "../../ui/motion";
import { moves, Tap } from "../../ui/moves";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../../ui/theme";
import { CHIP_EDGE_ALPHA, DOOR_BREATH, DOOR_INK, DOOR_LIT, DOOR_REST_ALPHA, FAILED, MARK_COLOR, MARK_INK, STAGE, STAGE_INK } from "./colors";
import { setFirstMinuteStageUp } from "./gate";
import { seam } from "./seam";

type Source = "edunex" | "six";
type Scheme = "light" | "dark";
/** A door's three states, each one true: nothing yet, its system signing in, its system in. */
type DoorState = "rest" | "working" | "in";
/** The doors on the stage; the doors closing up under the mark; the stage lifting off Beranda. */
type Phase = "doors" | "joining" | "lifting";

/** The gap between the doors, closed as they join. */
const GAP = 14;
const SIDE = space[6];
/** The mark's badge on the seam. */
const BADGE = 52;
/** A door's tick, and the room under it. */
const TICK = 24;
const FOOT = space[4];
/** Both in: this long to see the second door light before they join. */
const BOTH_HOLD_MS = 250;
/** One in: this long for the other to come along on the same sign-in; then the hand-over goes without it. */
const OTHER_WAIT_MS = 2_000;
/** The doors closing up and the mark landing, before the stage moves. */
const JOIN_MS = 520;
/** The stage lifting off Beranda. */
const LIFT_MS = 600;
/** Material's emphasized curve, for the lift. */
const EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);

export function FirstMinute({ onDone }: { onDone(): void }) {
  const t = useT();
  const lang = useLang();
  const now = useNow();
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

  // One value per move, each on the UI thread: the doors closing up, the mark landing, the stage lifting off Beranda;
  // and, where the phone asks for less motion, the scene fading off it instead.
  const join = useSharedValue(0);
  const mark = useSharedValue(0);
  const lift = useSharedValue(0);
  const out = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((run: () => void, ms: number) => void timers.current.push(setTimeout(run, ms)), []);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // The stage is up while the doors are: a sign-in page with nothing left for the Student steps aside for it.
  useEffect(() => {
    setFirstMinuteStageUp(phase === "doors");
    return () => setFirstMinuteStageUp(false);
  }, [phase]);

  // A system is in: felt, once each.
  const was = useRef({ edunexIn, sixIn });
  useEffect(() => {
    if ((edunexIn && !was.current.edunexIn) || (sixIn && !was.current.sixIn)) haptic.confirm();
    was.current = { edunexIn, sixIn };
  }, [edunexIn, sixIn]);

  const done = useRef(onDone);
  done.current = onDone;
  const handOver = useCallback(() => {
    setPhase("joining");
    if (still) {
      // The same steps as fades: the mark, then straight to Beranda's shapes.
      mark.value = withTiming(1, { duration: motion.duration.short });
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
    // The timers after it only tell the screen reader, the touch layer, the status bar and the haptics where it is.
    join.value = withSpring(1, motion.spatialDefault);
    mark.value = withDelay(120, withSpring(1, motion.expressive));
    lift.value = withDelay(JOIN_MS, withTiming(1, { duration: LIFT_MS, easing: EMPHASIZED }));
    later(() => haptic.tick(), 160);
    later(() => {
      setPhase("lifting");
      haptic.confirm();
    }, JOIN_MS);
    // The curtain's last part to go is the top: the status bar's icons turn as it clears them.
    later(() => setUncovered(true), JOIN_MS + LIFT_MS * 0.8);
    later(() => done.current(), JOIN_MS + LIFT_MS + 40);
  }, [still, join, mark, lift, out, later]);

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
    for (const value of [join, mark, lift, out]) {
      cancelAnimation(value);
      value.value = 0;
    }
    setUncovered(false);
    setPhase("doors");
  }, [phase, anyIn, clearTimers, join, mark, lift, out]);

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

  // Where the doors stand: the upper part of the screen, as tall as the room over the headline lets them be.
  const rowWidth = size.width - SIDE * 2;
  const doorWidth = (rowWidth - GAP) / 2;
  const room = area?.height ?? size.height * 0.4;
  const doorHeight = Math.max(120, Math.min(room - space[2], doorWidth * 2.25));
  const doorsTop = (area?.y ?? insets.top + TOUCH + space[2]) + Math.max(0, room - doorHeight) * 0.35;
  // The mark lands on the seam between a door's name and its tick, touching neither.
  const markY = ((nameEnd ?? doorHeight * 0.45) + doorHeight - FOOT - TICK) / 2;
  // The curtain is the screen and its rounded lower edge, which waits under the screen until the lift.
  const curtain = size.height + seam.edge;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const curtainStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * curtain }] }));
  const leftDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (join.value * GAP) / 2 }] }));
  const rightDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (-join.value * GAP) / 2 }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, mark.value), transform: [{ scale: still ? 1 : mark.value }] }));

  // Each part comes up a beat after the one before (a fade where the phone asks for less motion).
  const enter = (step: number) =>
    still
      ? FadeIn.delay(step * 60)
      : FadeInDown.delay(step * 80)
          .springify()
          .damping(18)
          .stiffness(180);

  const doorState = (source: Source): DoorState => {
    const isIn = source === "edunex" ? edunexIn : sixIn;
    const step = source === "edunex" ? edunexStep : sixStep;
    return isIn ? "in" : step !== null || busy === source ? "working" : "rest";
  };

  // What the button became: where the sign-in is, in words.
  const sourceName = (source: Source) => t(`source.${source}`);
  const other = (source: Source, step: typeof sixStep) =>
    step === "slow"
      ? t("signIn.slow", { source: sourceName(source) })
      : step
        ? t("welcome.bringingAlong", { source: sourceName(source) })
        : t("scan.connected", { sources: sourceName(source === "six" ? "edunex" : "six") });
  const busyStep = busy === "six" ? sixStep : edunexStep;
  const status = bothIn
    ? t("welcome.bothConnected")
    : edunexIn
      ? other("six", sixStep)
      : sixIn
        ? other("edunex", edunexStep)
        : busyStep === "slow"
          ? t("signIn.slow", { source: sourceName(busy ?? "edunex") })
          : busyStep === "finishing"
            ? t("signIn.finishing", { source: sourceName(busy ?? "edunex") })
            : t("welcome.waitingShort");

  // The headline, until the app knows who came in: then the greeting, in its place. It leaves with the stage.
  const name = account?.name ?? student?.name;
  const hello = anyIn && name ? t(`mobile.first.hello.${partOfDay(new Date(now).getHours(), lang)}`, { name: firstName(name) }) : null;
  const headline = [t("welcome.headline1"), t("welcome.headline2")];
  const headlineFont = headlineSize(rowWidth, headline);
  const headlineRoom = 2 * Math.round(headlineFont * LINE) * PixelRatio.getFontScale();
  const lifting = phase === "lifting";
  // Big text or a small phone: the note under the button goes before the doors lose their room.
  const tight = size.height < 700 && PixelRatio.getFontScale() > 1.15;

  return (
    <Animated.View
      testID="screen.firstMinute"
      onLayout={(event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      // Lifting, Beranda under it is the Student's to touch and to hear; the scene only finishes leaving.
      pointerEvents={lifting ? "none" : "auto"}
      accessibilityViewIsModal={!lifting}
      accessibilityElementsHidden={lifting}
      importantForAccessibility={lifting ? "no-hide-descendants" : "auto"}
      style={[StyleSheet.absoluteFill, { zIndex: 60 }, rootStyle]}
    >
      {/* White icons on the stage, in both themes, until the stage has cleared the top of Beranda's page. */}
      <StatusBar style={uncovered ? seam.statusBar(scheme) : "light"} />

      {/* The stage and everything on it, one sheet: it lifts as one at the hand-over. */}
      <Animated.View
        // Lifting, it's one picture moved by the GPU: nothing on it is drawn again frame by frame.
        renderToHardwareTextureAndroid={lifting}
        shouldRasterizeIOS={lifting}
        style={[styles.curtain, { height: curtain, backgroundColor: STAGE[scheme] }, curtainStyle]}
      >
        {/* What's said on the stage: the headline bottom-left, the one button under the thumb. */}
        <View testID="screen.welcome" style={{ height: size.height, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space[4], minHeight: TOUCH + space[2], alignItems: "center" }}>
            {!asked && <LanguageChip />}
          </View>
          {/* The doors' room: they're drawn over it (below), at a size worked out from it. */}
          <View
            onLayout={(event: LayoutChangeEvent) => setArea({ y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height })}
            style={{ flex: 1, minHeight: 140 }}
          />
          <Animated.View entering={enter(2)} style={{ paddingHorizontal: SIDE, paddingTop: space[4] }}>
            <View accessible accessibilityRole="header" style={{ minHeight: headlineRoom, justifyContent: "flex-end" }}>
              {hello ? (
                <Animated.View key="hello" entering={still ? FadeIn.duration(motion.duration.medium) : moves.arrive}>
                  <Headline size={headlineFont}>{hello}</Headline>
                </Animated.View>
              ) : (
                // The desktop's headline, broken where it breathes: each half keeps to its one line at any font size.
                headline.map((half) => (
                  <Headline key={half} size={headlineFont}>
                    {half}
                  </Headline>
                ))
              )}
            </View>
          </Animated.View>
          <Animated.View entering={enter(3)} style={{ paddingHorizontal: SIDE, paddingTop: space[5], paddingBottom: space[5], gap: space[3] }}>
            {failed && !asked && (
              <View style={{ borderRadius: shape.md, backgroundColor: FAILED.bg, padding: space[3] }} accessibilityLiveRegion="polite">
                <Text size="bodyMedium" style={{ color: FAILED.ink }}>
                  {failed}
                </Text>
              </View>
            )}
            {asked ? (
              // The button's place, now the status: words only, one line that changes as the sign-in moves.
              <View testID="status.signIn" accessibilityLiveRegion="polite" style={{ minHeight: BUTTON, justifyContent: "center" }}>
                <Animated.View key={status} entering={FadeIn.duration(motion.duration.short)}>
                  <Text size="bodyLarge" weight="semibold" style={{ color: STAGE_INK }}>
                    {status}
                  </Text>
                </Animated.View>
              </View>
            ) : (
              <Tap onPress={() => void signIn("edunex")} testID="action.signIn" style={[styles.button, { backgroundColor: DOOR_LIT[scheme] }]}>
                <Text size="bodyLarge" weight="semibold" style={{ color: DOOR_INK.edunex, textAlign: "center" }}>
                  {t("mobile.welcome.signIn")}
                </Text>
              </Tap>
            )}
            {!tight && (
              <Text size="bodySmall" style={{ color: STAGE_INK }}>
                {t("welcome.connectLead")}
              </Text>
            )}
          </Animated.View>
        </View>

        {/* The doors: the screen's one picture. Nothing on them is a control. */}
        {area !== null && (
          <View pointerEvents="none" style={{ position: "absolute", left: SIDE, top: doorsTop, width: rowWidth, height: doorHeight }}>
            <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
              <Animated.View entering={enter(0)} style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1 }, leftDoor]}>
                  <Door source="edunex" state={doorState("edunex")} width={doorWidth} height={doorHeight} scheme={scheme} onName={setNameEnd} />
                </Animated.View>
              </Animated.View>
              <Animated.View entering={enter(1)} style={{ flex: 1 }}>
                <Animated.View style={[{ flex: 1 }, rightDoor]}>
                  <Door source="six" state={doorState("six")} width={doorWidth} height={doorHeight} scheme={scheme} />
                </Animated.View>
              </Animated.View>
            </View>
            {/* The app's mark, landing on the seam where the two doors meet. It leaves with the stage. */}
            <Animated.View style={[styles.badge, { left: rowWidth / 2 - BADGE / 2, top: markY - BADGE / 2 }, markStyle]}>
              <Image
                source={require("../../../assets/android-icon-monochrome.png")}
                style={{ width: BADGE * 1.5, height: BADGE * 1.5, tintColor: MARK_INK }}
                accessibilityIgnoresInvertColors
                accessibilityElementsHidden
              />
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** The sign-in button's height, and the status line's that takes its place: nothing under it moves at the tap. */
const BUTTON = 52;

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

/** One line of the headline, or the greeting in its place (a hair smaller rather than broken, should it run wide). */
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

/**
 * The part of the day the greeting names ("Pagi", "Siang", "Sore", "Malam"), as each language splits it; night until
 * 04:00, so 01:30 says "Malam". The scene's own: Beranda has no greeting to share it with.
 */
function partOfDay(hour: number, lang: "id" | "en"): "morning" | "midday" | "afternoon" | "evening" {
  if (hour < 4) return "evening";
  if (lang === "id") return hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "afternoon" : "evening";
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/**
 * A system as a door: its logo and its name on an arch. Nothing on it is a control, and both doors are the same until
 * a system moves: at rest a faint light; while its sign-in runs the light breathes, with a line of it under the door;
 * once it's in the door is lit, its name in its own colour and a tick at its foot. Its size never changes. With less
 * motion asked for, the light fades between the three and nothing breathes.
 */
function Door({
  source,
  state,
  width,
  height,
  scheme,
  onName,
}: {
  source: Source;
  state: DoorState;
  width: number;
  height: number;
  scheme: Scheme;
  /** Where the name ends, from the door's top. */
  onName?: (y: number) => void;
}) {
  const t = useT();
  const still = useReduceMotion();
  const isIn = state === "in";
  // How lit the door is, 0 to 1, and the tick coming in.
  const lit = useSharedValue(isIn ? 1 : 0);
  const tick = useSharedValue(isIn ? 1 : 0);
  useEffect(() => {
    cancelAnimation(lit);
    if (state === "in") {
      lit.value = withTiming(1, { duration: motion.duration.medium });
      tick.value = still ? withTiming(1, { duration: motion.duration.short }) : withDelay(100, withSpring(1, motion.expressive));
    } else if (state === "working") {
      tick.value = 0;
      lit.value = still
        ? withTiming(DOOR_BREATH.high, { duration: motion.duration.short })
        : withRepeat(withSequence(withTiming(DOOR_BREATH.high, { duration: 700 }), withTiming(DOOR_BREATH.low, { duration: 700 })), -1);
    } else {
      tick.value = 0;
      lit.value = withTiming(0, { duration: motion.duration.medium });
    }
  }, [state, still, lit, tick]);
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  // The light under the door: there as soon as the door's light stirs, so "working" shows in a still picture too.
  const floorStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, lit.value / DOOR_BREATH.high) }));
  const tickStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, tick.value), transform: [{ scale: still ? 1 : tick.value }] }));
  const name = t(`source.${source}`);
  const says = isIn
    ? t("scan.connected", { sources: name })
    : state === "working"
      ? t("signIn.joining", { source: name })
      : `${name}: ${t("welcome.notConnected")}`;
  // A short door (a small phone, big text) keeps a smaller logo, so the mark has its room under the name.
  const logo = height < 240 ? 36 : 44;
  return (
    <View
      testID={`door.${source}`}
      accessible
      accessibilityLabel={says}
      style={{
        flex: 1,
        borderTopLeftRadius: width / 2,
        borderTopRightRadius: width / 2,
        borderBottomLeftRadius: shape.lg,
        borderBottomRightRadius: shape.lg,
        backgroundColor: `rgba(255,255,255,${DOOR_REST_ALPHA[scheme]})`,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: Math.min(space[8], Math.max(space[4], width * 0.2)),
        paddingBottom: FOOT,
        paddingHorizontal: space[2],
      }}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DOOR_LIT[scheme] }, litStyle]} />
      <Animated.View pointerEvents="none" style={[styles.floor, { backgroundColor: DOOR_LIT[scheme] }, floorStyle]} />
      <View
        onLayout={(event: LayoutChangeEvent) => onName?.(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
        style={{ alignItems: "center", gap: space[2] }}
      >
        <SourceLogo source={source} size={logo} />
        <Text
          size="titleLarge"
          face="display"
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ color: isIn ? DOOR_INK[source] : STAGE_INK, letterSpacing: -0.3 }}
        >
          {name}
        </Text>
      </View>
      {/* The tick: nothing here until the system is in. */}
      <Animated.View style={[{ height: TICK, justifyContent: "center" }, tickStyle]}>
        <Icons.Check size={TICK} weight="bold" color={DOOR_INK[source]} />
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
  floor: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6 },
  button: {
    minHeight: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    borderColor: MARK_INK,
    backgroundColor: MARK_COLOR,
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
