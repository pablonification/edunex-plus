// The phone's first minute: two doors, one room. Edunex and SIX are two places every ITB student signs in to, and the
// app is the one room behind both. The scene happens around what must happen anyway (one sign-in), so nothing is added
// to wait for and there's nothing to swipe or skip. Second by second (DESIGN.md, "The first minute"):
//
//   1. The stage is Edunex Plus's blue, full height, from the app's first frame (../welcome.tsx). On it: two doors in
//      the upper half, one per system, both the same; between them the app's mark with a glow, the stage's one
//      light, tight at rest and wider with each system in; the headline bottom-left; one button under the thumb.
//      Once drawn, nothing on it moves: no frame is drawn.
//   2. The tap: the button becomes the status in words, in place; the language chip and the note about signing in go
//      with it. A door's foot is empty until its system starts: then a ring is there, already turning, a bright half
//      on a dim track (the one thing that moves). Once the system is in, the door lights and its name, never absent,
//      turns from white to navy with it; the ring becomes a tick, the same size and colour on both doors; and what the
//      system just said comes under the name (the NIM under Edunex, the programme under SIX once SIX has
//      said it; no word that only repeats the tick). A haptic each.
//   3. The first system in with the name: the headline goes (fast) and then the greeting comes into the same spot
//      ("Pagi, Dimas.": Beranda has none, so it's said once), so it's read while the other system connects. Each door
//      steps to the mark as its own system comes in: the doors meet as the second tick lands, the mark answers with
//      one beat, and both ticks stand for half a second (MOMENT_MS: "both are in" is seen, not passed through) before
//      the stage lifts. A system still on its way is waited for (OTHER_WAIT_MS): the stage doesn't leave with its ring
//      still turning unless it's really slow. The lower half is never empty.
//   4. The hand-over: the whole stage lifts away like a curtain. The doors and the mark fade where they are as it
//      starts, gone before they reach the status bar; the stage and the greeting lift on. Under it the real Beranda
//      was there all along, filling as the first read brings it. A strip of the stage's blue holds the status bar
//      until the curtain's edge has gone under it, then fades where it is: nothing slides across the clock. The scene
//      leaves nothing on Beranda and knows nothing of its layout (./seam.ts).
//
// Nothing here waits for the read: the lift starts about a second after the second system is in (its door lighting,
// then the moment). Every move runs on the UI
// thread (Reanimated), on transforms and opacity only, each a timing that ends; the whole hand-over is set going in
// one go, so the first read's JavaScript can't hold a step of it up. Every colour is opaque (./colors.ts) and no shape
// is clipped, so a frame is a few flat fills; everything on the sheet is still by the time it lifts, so it lifts as one
// picture (a hardware texture), but for the doors' own picture fading on it as it starts. With Remove animations the
// same steps cross-fade and nothing moves.
// Loaded only when nobody is signed in (./gate.tsx).
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
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
import { useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
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
  DOOR_TICK,
  GLOW_ALPHA,
  HEM,
  LOGO_EDGE,
  MARK_COLOR,
  MARK_EDGE,
  MARK_INK,
  RING_TRACK,
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

/** The gap between the doors: each door steps half of it, to the mark, as its system comes in. */
const GAP = 20;
const SIDE = space[6];
/** The mark between the doors: as large as the room under the doors' words lets it be, between these. */
const BADGE = { min: 48, max: 104 } as const;
/** The glow behind the mark, by the mark's size: small and steep, so its steps can't show as bands on a dark stage. */
const GLOW = 1.7;
/** The glow's size with no system in, one, both: tight around the mark, out to the lit door, over both. */
const GLOW_GROWS = [0.8, 1, 1.24];
/** A door's tick and the ring it comes from (one size on both doors), and the room under it. */
const TICK = 32;
const RING = 28;
const FOOT = space[4];
/** What a system just learned: two lines of this height (sp) under its name, on both doors. */
const FACT_LINE = 20;
const FACT_LINES = 2;
/** A door lighting, start to end: it lights, its name and its ring turn into navy and a tick midway, its facts come. */
const LIT_MS = 420;
/** The status line's last words leaving once both systems are in: gone as the last ring has become its tick (midway
 *  through its door's lighting). */
const STATUS_OUT_MS = LIT_MS / 2;
/**
 * Both in: the two ticks, the doors met and the mark at rest stand this long before the stage moves. Without it the
 * second system's tick was never seen: its door lit as the stage was already leaving (the developer's iPhone, 11 Nov).
 */
const MOMENT_MS = 520;
/** From the hand-over to the instant the stage moves: the last door's lighting, then the moment with both in. With
 *  only one in there's no door to light and nothing to stand for: the lighting's length alone. */
const LEAD_MS = LIT_MS + MOMENT_MS;
const LEAD_ALONE_MS = LIT_MS;
/** The headline turning into the greeting, in place: the headline goes first and fast, and only then the greeting
 *  comes in, so two lines are never readable at once. */
const HELLO_OUT_MS = 120;
const HELLO_IN_MS = 260;
const HELLO_MS = HELLO_OUT_MS + HELLO_IN_MS;
/** Where in that turn the headline is gone and the greeting starts. */
const HELLO_TURN = HELLO_OUT_MS / HELLO_MS;
/**
 * One in and the other still trying (its ring turning, "Membawa SIX…"): this long for it to come along, so its tick is
 * seen and the doors meet; then the hand-over goes without it and it joins on Beranda. The other system's own sign-in
 * takes two or three seconds on a real phone (measured on an iPhone on 4G, 11 Nov), and its door lights as soon as the
 * first system is in (src/desktop/signin-both.ts: it used to wait for the first one's whole first read, half a minute
 * on mobile data, which is why SIX's ring was still turning as the stage left). The rest is room for a slow network.
 */
const OTHER_WAIT_MS = 8_000;
/** One in and the other stopped: this long to read why, before the hand-over (the line leaves with the stage). */
const OTHER_STOPPED_MS = 1_200;
/** A door stepping to the mark as its system comes in: over before its lighting is, so before the stage lifts. */
const JOIN_MS = 380;
/** The mark's one beat as the doors have met (its top as the last door has lit): up, then back, at rest through the
 *  moment before the stage lifts. */
const BEAT_UP_MS = 120;
const BEAT_DOWN_MS = 200;
/** The stage lifting off Beranda. */
const LIFT_MS = 700;
/** How far into the lift the curtain's edge is under the status bar's strip: its icons turn then. */
const CLEARS_TOP = 0.85;
/** With Remove animations: the greeting stays this long, then the stage cross-fades to Beranda. */
const STILL_HOLD_MS = 500;
/** Material's standard curve for the lift (a gentle start: the greeting is read as it rises), emphasized for the
 *  doors, the decelerate for what arrives. */
const LIFTING = Easing.bezier(0.4, 0, 0.2, 1);
const EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);
const ARRIVING = Easing.bezier(0.05, 0.7, 0.1, 1);
/** A letter's share of its font size, a little over (Inter, mixed case): how wide a line of words will run. */
const LETTER = 0.52;

/** Why a sign-in stopped: no way out to the network, or anything else. */
type Failure = { offline: boolean; text: string };

export function FirstMinute({ onDone }: { onDone(): void }) {
  const t = useT();
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
  const [failed, setFailed] = useState<Failure | null>(null);
  // Beranda's page shows at the top of the screen: the status bar's icons are its now.
  const [uncovered, setUncovered] = useState(false);
  // Where things are, once drawn: the room the doors have, and where a door's name ends.
  const [area, setArea] = useState<{ y: number; height: number } | null>(null);
  const [nameEnd, setNameEnd] = useState<number | null>(null);

  // A session saved while nothing could be reached isn't a system that's in: its door stays shut and the stage stays,
  // saying so, until the network is back (the app then reads by itself) or the Student tries again.
  const edunexDown = edunex === "offline" && account === undefined;
  const sixDown = six === "offline" && student === undefined;
  // Edunex is in once it has answered who this is (its first answer: the door lights with the name on it), not while
  // its session is only being checked; SIX as soon as its session is, unless Edunex just found nothing reachable.
  const edunexIn = account !== undefined || (edunex !== "signed-out" && edunex !== "connecting" && !edunexDown);
  const sixIn = student !== undefined || (six !== "signed-out" && !sixDown && !(six === "connecting" && edunexDown));
  const anyIn = edunexIn || sixIn;
  const bothIn = edunexIn && sixIn;
  // The tap is behind the Student: the button is the status now.
  const asked = busy !== null || anyIn;

  // One value per move, each on the UI thread and each a timing that ends: the headline turning into the greeting,
  // the doors closing, the mark's beat, the stage lifting off Beranda; and, where the phone asks for less motion, the
  // scene fading off it.
  const hello = useSharedValue(0);
  const beat = useSharedValue(0);
  const lift = useSharedValue(0);
  const out = useSharedValue(0);
  const light = useSharedValue(0);

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
  const handOver = useCallback(
    (met: boolean) => {
      setPhase("joining");
      // The whole hand-over is set going here, in one go, on the UI thread: the first read's JavaScript can't hold a
      // step of it up. The last door lights (and steps to the mark, by itself), both ticks stand a moment, and the
      // stage lifts (LEAD_MS); with one system only (`met` false) there's no door to light: it lifts sooner. The
      // greeting is up already, or comes now. The timers after it only tell the screen reader, the touch layer, the
      // phone's bars and the haptics where it is.
      const lead = met ? LEAD_MS : LEAD_ALONE_MS;
      if (still) {
        // The same beats as fades: the greeting, then the stage cross-fades to Beranda. Nothing moves, nothing cuts.
        const fade = LIT_MS + STILL_HOLD_MS;
        out.value = withDelay(fade, withTiming(1, { duration: motion.duration.long }));
        later(() => {
          setPhase("lifting");
          haptic.confirm();
        }, fade);
        later(() => setUncovered(true), fade + motion.duration.long / 2);
        later(() => done.current(), fade + motion.duration.long + 40);
        return;
      }
      lift.value = withDelay(lead, withTiming(1, { duration: LIFT_MS, easing: LIFTING }));
      // The mark's beat, its top as the last door has lit and the doors have met; then everything on the sheet is at
      // rest (through the moment, when both are in) and it lifts with nothing on it still changing.
      const beatAt = Math.max(0, Math.min(LIT_MS, lead - BEAT_DOWN_MS) - BEAT_UP_MS);
      beat.value = withDelay(beatAt, withSequence(withTiming(1, { duration: BEAT_UP_MS }), withTiming(0, { duration: BEAT_DOWN_MS })));
      // One haptic, at the beat's top (each system in already gave its own).
      later(() => haptic.tick(), beatAt + BEAT_UP_MS);
      later(() => setPhase("lifting"), lead);
      later(() => setUncovered(true), lead + LIFT_MS * CLEARS_TOP);
      later(() => done.current(), lead + LIFT_MS + 40);
    },
    [still, beat, lift, out, later],
  );

  // The other system, with one in: still on its way (the same sign-in is trying it), or stopped (it asked for the
  // Student, or failed): then Beranda has its own way to connect it.
  const otherStopped = anyIn && !bothIn && busy === null && (edunexIn ? sixStep : edunexStep) === null;

  // The greeting, as soon as a door has lit with the name (the name is known then): the headline becomes it in place,
  // so it's read while the other system connects, not in the instant before the stage leaves. Without a name, at the
  // hand-over, as the part of the day alone.
  const hour = new Date(now).getHours();
  const dayPart = hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "afternoon" : "evening";
  const called = account ? firstName(account.name) : student ? firstName(student.name) : "";
  const greeting = called ? t(`mobile.welcome.hello.${dayPart}`, { name: called }) : `${t(`time.greeting.${dayPart}`)}.`;
  const greeted = anyIn && (called !== "" || phase !== "doors");
  const wasGreeted = useRef(false);
  useEffect(() => {
    if (greeted === wasGreeted.current) return;
    wasGreeted.current = greeted;
    hello.value = withTiming(greeted ? 1 : 0, { duration: HELLO_MS, easing: Easing.linear });
  }, [greeted, hello]);

  // The stage's one light grows with each system in: tight around the mark at rest, out to the first lit door, then
  // over both. A scale on the one small glow, over a door's lighting, so it's done before the stage lifts.
  const systemsIn = (edunexIn ? 1 : 0) + (sixIn ? 1 : 0);
  const shone = useRef(0);
  useEffect(() => {
    if (still || systemsIn === shone.current) return;
    shone.current = systemsIn;
    light.value = withTiming(systemsIn, { duration: LIT_MS, easing: EMPHASIZED });
  }, [systemsIn, still, light]);

  // Each door steps to the mark as its own system comes in (useStepIn, below): Edunex's first, SIX's with the mark's
  // beat when SIX connects, so the doors have met only once both are in. A system that never came keeps its door
  // where it is. With less motion asked for, the doors stay where they are.
  const edunexStepIn = useStepIn(edunexIn, still);
  const sixStepIn = useStepIn(sixIn, still);
  // Both in: the hand-over starts at once (the second door lights, both ticks stand a moment, the stage lifts). One
  // in: once the other has come along, or after a moment to read why it stopped, or without it if it's really slow
  // (it joins on Beranda).
  useEffect(() => {
    if (phase !== "doors" || !anyIn) return;
    if (bothIn) return handOver(true);
    const timer = setTimeout(() => handOver(false), otherStopped ? OTHER_STOPPED_MS : OTHER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [phase, anyIn, bothIn, otherStopped, handOver]);

  // The sign-in didn't hold after all (the first read refused it): back to the doors, where the reason is said.
  useEffect(() => {
    if (phase === "doors" || anyIn) return;
    clearTimers();
    for (const value of [hello, beat, lift, out]) {
      cancelAnimation(value);
      value.value = 0;
    }
    wasGreeted.current = false;
    setUncovered(false);
    setPhase("doors");
  }, [phase, anyIn, clearTimers, hello, beat, lift, out]);

  const signIn = async (source: Source) => {
    setFailed(null);
    setBusy(source);
    try {
      // Edunex on Microsoft's page; SIX tries the same session out of sight right after (signInToBoth).
      await bridge.invoke("auth.signIn", { source });
    } catch (error) {
      // No way out to the network is its own thing to say (and to fix); anything else is "try again".
      const key = errorKey(error, "welcome.signInFailed");
      setFailed({ offline: key === "error.offline", text: t(key === "error.offline" ? "mobile.welcome.offline" : key) });
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
  const factsRoom = Math.round(FACT_LINES * FACT_LINE * fontScale);
  const wordsEnd = (nameEnd ?? 0) + space[1] + factsRoom;
  const tickTop = doorHeight - FOOT - TICK;
  const badge = Math.max(BADGE.min, Math.min(BADGE.max, tickTop - wordsEnd - space[4]));
  const markY = Math.max(wordsEnd + badge / 2, (wordsEnd + tickTop) / 2);
  const glow = Math.round(badge * GLOW);
  // The curtain is the screen and its rounded lower edge, which waits under the screen until the lift.
  const curtain = size.height + seam.edge;
  const top = insets.top;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  // The curtain's lower edge, from the top of the screen. Once it's under the strip that holds the status bar, the
  // curtain is out of sight for good and the strip fades where it is: no edge, line or door crosses the clock.
  const curtainStyle = useAnimatedStyle(() => {
    const edge = curtain * (1 - lift.value);
    return { transform: [{ translateY: top > 0 && edge < top ? -curtain - top : -lift.value * curtain }] };
  });
  const stripStyle = useAnimatedStyle(() => ({ opacity: top > 0 ? Math.min(1, Math.max(0, (curtain * (1 - lift.value)) / top)) : 0 }));
  // The headline is gone (fast) before the greeting starts in: never two lines readable at once.
  const headlineStyle = useAnimatedStyle(() => ({ opacity: interpolate(hello.value, [0, HELLO_TURN], [1, 0], Extrapolation.CLAMP) }));
  // Then the greeting comes up into the headline's place, slowing as it lands (a fade alone where the phone asks for
  // less motion).
  const rise = still ? 0 : motion.nudge;
  const helloStyle = useAnimatedStyle(() => {
    const left = 1 - interpolate(hello.value, [HELLO_TURN, 1], [0, 1], Extrapolation.CLAMP);
    const landed = 1 - left * left;
    return { opacity: landed, transform: [{ translateY: (1 - landed) * rise }] };
  });
  const leftDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (edunexStepIn.value * GAP) / 2 }] }));
  const rightDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (-sixStepIn.value * GAP) / 2 }] }));
  // The doors and the mark are gone, in place, before their tops reach the strip that holds the status bar (about the
  // first third of the lift's time, as it starts gently): nothing is ever cut flat under the clock. What lifts on
  // from there is the stage and the greeting.
  const doorsGone = Math.max(0.05, (doorsTop - top) / curtain);
  const doorsStyle = useAnimatedStyle(() => ({ opacity: interpolate(lift.value, [0, doorsGone], [1, 0], Extrapolation.CLAMP) }));
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: still ? 1 : interpolate(light.value, [0, 1, 2], GLOW_GROWS) }] }));
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
  // What each system just said, for its door, one thing each in two lines' room: Edunex the NIM (the name is in the
  // greeting: said once); SIX the programme. Nothing until it has said it: the tick alone says it's connected.
  const learned = (source: Source): [string?, string?] => (source === "edunex" ? [undefined, account?.nim] : [student?.program ?? undefined]);

  // What the button became: where the sign-in is, in words. Nothing once both are in: the doors say that.
  const sourceName = (source: Source) => t(`source.${source}`);
  const other = (source: Source) => {
    const step = stepOf(source);
    if (step === "slow") return t("signIn.slow", { source: sourceName(source) });
    // On its way while the one sign-in still runs (it tries the other right after); stopped, it's for later.
    if (step || busy !== null) return t("welcome.bringingAlong", { source: sourceName(source) });
    return t(source === "six" ? "welcome.sixLater" : "welcome.edunexLater");
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
  // Why the sign-in stopped, if it did: nothing could be reached (now, or when it was tried), or the page failed.
  const stopped: Failure | null = !anyIn && (edunexDown || sixDown) ? { offline: true, text: t("mobile.welcome.offline") } : failed;
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
      {/* White icons on the stage, in both themes ("light" names the icons, for both bars: ../../../app/_layout.tsx).
          The status bar's turn once the stage's edge is under its strip; the three buttons' as the lift starts, when
          its lower edge leaves them. An iPhone has no such buttons: there the line is nothing. */}
      <StatusBar style={uncovered ? seam.statusBar(scheme) : "light"} />
      <NavigationBar style={lifting ? seam.statusBar(scheme) : "light"} />

      {/* The stage and everything on it, one sheet: it lifts as one at the hand-over (a transform on this one view). */}
      <Animated.View
        // Lifting, nothing on the sheet changes any more: it's kept as one picture, so each frame of the lift moves
        // that picture instead of drawing the doors, the mark's glow and the words again.
        renderToHardwareTextureAndroid={lifting && !still}
        shouldRasterizeIOS={lifting && !still}
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
          {/* The headline, the button and the mark are simply there from the first frame, with no entrance of their own: an
              entrance still waiting its turn is dropped when the whole tree draws again (a theme set a moment after the
              start did that on CI's emulator), and the stage was left with its doors and nothing to sign in with. */}
          <Animated.View style={{ paddingHorizontal: SIDE, paddingTop: space[4] }}>
            {/* The desktop's headline, broken where it breathes: each half keeps to its one line at any font size. Once
                a door lights with the name it becomes the greeting, in the same spot and size, and leaves with the stage. */}
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={greeted ? greeting : headline.join(" ")}
              style={{ height: headlineRoom, justifyContent: "flex-end" }}
            >
              <Animated.View style={headlineStyle}>
                {headline.map((half) => (
                  <Headline key={half} size={headlineFont}>
                    {half}
                  </Headline>
                ))}
              </Animated.View>
              <Animated.View testID="text.firstMinuteHello" pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }, helloStyle]}>
                <Headline size={headlineFont}>{greeting}</Headline>
              </Animated.View>
            </View>
          </Animated.View>
          <Animated.View style={{ paddingHorizontal: SIDE, paddingTop: space[5], paddingBottom: space[5], gap: space[3] }}>
            {asked ? (
              // The button's place, now the status: words only, one line, swapped at once and at full strength. Its
              // height is fixed, so a new line of words moves nothing around it.
              <View testID="status.signIn" accessibilityLiveRegion="polite" style={{ height: BUTTON_HEIGHT, justifyContent: "center" }}>
                {/* Once both are in there's nothing to say: the last words go as the last ring gives way to its tick,
                    not a blink before it, in both themes. */}
                {status !== "" && (
                  <Animated.View exiting={FadeOut.duration(STATUS_OUT_MS)}>
                    <Text size="bodyLarge" weight="semibold" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: STAGE_INK }}>
                      {status}
                    </Text>
                  </Animated.View>
                )}
              </View>
            ) : (
              <Tap onPress={() => void signIn("edunex")} testID="action.signIn" style={[styles.button, { backgroundColor: BUTTON.bg[scheme] }]}>
                <Text size="bodyLarge" weight="semibold" style={{ color: BUTTON.ink, textAlign: "center" }}>
                  {t("mobile.welcome.signIn")}
                </Text>
              </Tap>
            )}
            {stopped && !asked ? (
              // The sign-in stopped: why, in the note's place under the button, which is the way to try again. White
              // on the stage like every other word here, with a mark for which kind it is; nothing else moves.
              <View
                testID={stopped.offline ? "status.signInOffline" : "status.signInFailed"}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.failed}
              >
                {stopped.offline ? <Icons.WifiOff size={20} color={STAGE_INK} /> : <Icons.Info size={20} weight="fill" color={STAGE_INK} />}
                <Text size="bodyMedium" weight="semibold" style={{ color: STAGE_INK, flex: 1 }}>
                  {stopped.text}
                </Text>
              </View>
            ) : (
              !tight && (
                // About signing in: it leaves with the button, its room kept so nothing above it moves at the tap.
                <Text
                  size="bodySmall"
                  style={{ color: STAGE_INK, opacity: asked ? 0 : 1 }}
                  accessibilityElementsHidden={asked}
                  importantForAccessibility={asked ? "no" : "auto"}
                >
                  {t("welcome.connectLead")}
                </Text>
              )
            )}
          </Animated.View>
        </View>

        {/* The doors and the mark between them: the screen's one picture. Nothing on them is a control. */}
        {area !== null && (
          <Animated.View
            pointerEvents="none"
            // Faded as one picture (not each part through the next), from its own texture while the stage lifts.
            needsOffscreenAlphaCompositing
            renderToHardwareTextureAndroid={lifting && !still}
            style={[{ position: "absolute", left: SIDE, top: doorsTop, width: rowWidth, height: doorHeight }, doorsStyle]}
          >
            <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
              {(["edunex", "six"] as const).map((source, index) => {
                const [first, second] = learned(source);
                return (
                  <Animated.View key={source} entering={enter(index)} style={{ flex: 1 }}>
                    <Animated.View style={[{ flex: 1 }, index === 0 ? leftDoor : rightDoor]}>
                      <Door
                        source={source}
                        state={doorState(source)}
                        // Seen only once Microsoft's page has stepped aside: nothing turns under it.
                        turning={stepOf(source) !== null}
                        first={first}
                        second={second}
                        factsRoom={factsRoom}
                        width={doorWidth}
                        height={doorHeight}
                        scheme={scheme}
                        onName={index === 0 ? setNameEnd : undefined}
                      />
                    </Animated.View>
                  </Animated.View>
                );
              })}
            </View>
            {/* The app's mark, there from the start (once the doors know where their names end): the doors close onto
                it, and it leaves with the stage. */}
            {nameEnd !== null && (
              <Animated.View
                style={{ position: "absolute", left: rowWidth / 2 - glow / 2, top: markY - glow / 2, width: glow, height: glow }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Animated.View style={glowStyle}>
                  <Glow size={glow} scheme={scheme} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, markStyle]}>
                  {/* A thin edge in the stage's own blue around the white ring: unseen on the stage, and what keeps the
                      ring whole where it crosses a lit door. */}
                  <View
                    style={[
                      styles.badgeEdge,
                      { width: badge + EDGE * 2, height: badge + EDGE * 2, borderRadius: badge / 2 + EDGE, backgroundColor: MARK_EDGE[scheme] },
                    ]}
                  >
                    <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: MARK_COLOR[scheme] }]}>
                      <Image
                        source={require("../../../assets/android-icon-monochrome.png")}
                        style={{ width: badge * 1.5, height: badge * 1.5, tintColor: MARK_INK }}
                        accessibilityIgnoresInvertColors
                      />
                    </View>
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* The stage's blue held over the status bar from the hand-over on: the doors pass under it, not across the
          clock, and once the curtain's edge is under it too, it fades where it is. */}
      {phase !== "doors" && top > 0 && (
        <Animated.View pointerEvents="none" style={[styles.strip, { height: top, backgroundColor: STAGE[scheme] }, stripStyle]} />
      )}
    </Animated.View>
  );
}

/**
 * A door's step to the mark, 0 to 1, on the UI thread: taken once, when its system comes in, and taken back at once if
 * the sign-in didn't hold. Never where the phone asks for less motion.
 */
function useStepIn(isIn: boolean, still: boolean) {
  const step = useSharedValue(0);
  const was = useRef(false);
  useEffect(() => {
    if (isIn === was.current) return;
    was.current = isIn;
    if (isIn && !still) step.value = withTiming(1, { duration: JOIN_MS, easing: EMPHASIZED });
    else if (!isIn) {
      cancelAnimation(step);
      step.value = 0;
    }
  }, [isIn, still, step]);
  return step;
}

/** The sign-in button's height, and the status line's that takes its place: nothing under it moves at the tap. */
const BUTTON_HEIGHT = 52;
/** The edge around the mark's white ring. */
const EDGE = 1.5;

/** The headline's size at its largest (sp), and its line's height by its size. */
const HEADLINE = 32;
const LINE = 1.22;

/**
 * The headline's two halves at one size: the largest at which the longer half keeps to its one line on this screen at
 * this font size, so no word is left alone on a line and the halves never differ. In dp, at font size 1.3: on a 411 dp
 * screen (363 dp of line) 22.4 sp, so letters 29 dp tall on two 35 dp lines; on a 360 dp screen (312 dp of line)
 * 19.2 sp, so 25 dp letters on two 30 dp lines. At font size 1 both get the full 32 sp only from 400 dp of line up.
 */
function headlineSize(width: number, halves: readonly string[]): number {
  const scale = PixelRatio.getFontScale();
  const longest = Math.max(...halves.map((half) => half.length));
  return Math.min(HEADLINE, width / (longest * LETTER) / scale);
}

/** One line of the headline, or the greeting it becomes (a hair smaller rather than broken, should it run wide). */
function Headline({ size, children }: { size: number; children: string }) {
  return (
    <Text
      size="headlineLarge"
      face="display"
      weight="bold"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={{ color: STAGE_INK, fontSize: size, lineHeight: Math.round(size * LINE), letterSpacing: -0.4 }}
    >
      {children}
    </Text>
  );
}

/**
 * The glow behind the mark: the stage's one light, drawn once (it grows by a scale as each system comes in, and is
 * still otherwise). Small, and falling off along a
 * curve in six steps rather than a straight line in two: on a dark stage a wide, faint gradient showed its steps.
 */
const Glow = memo(function Glow({ size, scheme }: { size: number; scheme: Scheme }) {
  const alpha = GLOW_ALPHA[scheme];
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="firstMinuteGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor={DOOR_LIGHT} stopOpacity={alpha} />
          <Stop offset="0.65" stopColor={DOOR_LIGHT} stopOpacity={alpha * 0.72} />
          <Stop offset="0.75" stopColor={DOOR_LIGHT} stopOpacity={alpha * 0.42} />
          <Stop offset="0.85" stopColor={DOOR_LIGHT} stopOpacity={alpha * 0.18} />
          <Stop offset="0.93" stopColor={DOOR_LIGHT} stopOpacity={alpha * 0.06} />
          <Stop offset="1" stopColor={DOOR_LIGHT} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#firstMinuteGlow)" />
    </Svg>
  );
});

/**
 * A system as a door: its logo and its name on an arch. Nothing on it is a control, and both doors are the same until
 * a system moves: at rest a door's foot is empty (a ring there read as something to pick). When its sign-in starts, a
 * ring is there already turning, a bright half on a dim track, the brightest thing on the door: the scene's one
 * endless move, a rotation of one small view on the UI thread, stopped the moment the system is in. Once it's in, one
 * value lights the door: the door's fill first, and midway, in a few frames, the name turns from white to navy where
 * it stands (the navy laid over the white, so it's never absent and never thin) while the ring gives way to the tick
 * in the same spot; then what the system said comes under the name. The white name is on the door while it's still
 * more blue than white, the navy one once it's more white than blue. The logo is drawn once and never changes; the
 * door's size never changes, and the two lines of what it learned have their room from the start. With less motion
 * asked for, the ring is still and nothing turns or grows.
 */
const Door = memo(function Door({
  source,
  state,
  turning,
  first,
  second,
  factsRoom,
  width,
  height,
  scheme,
  onName,
}: {
  source: Source;
  state: DoorState;
  /** The ring may turn (the stage is in view). */
  turning: boolean;
  /** What the system just said about the Student, if it has: one line that may run to two, or two lines of one. */
  first?: string;
  second?: string;
  /** The two lines' room (dp). */
  factsRoom: number;
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
  // The ring is on the door from the moment its system starts until the tick has taken its place; a door that was
  // never seen working goes straight to its tick.
  const ringed = useRef(false);
  if (working) ringed.current = true;
  else if (state === "rest") ringed.current = false;
  // The door's light, 0 to 1 (everything about being in comes from it), and the ring's turn.
  const lit = useSharedValue(isIn ? 1 : 0);
  const turn = useSharedValue(0);
  useEffect(() => {
    lit.value = withTiming(isIn ? 1 : 0, { duration: LIT_MS, easing: Easing.linear });
  }, [isIn, lit]);
  useEffect(() => {
    // Not through useLoopWhileShown: that rests whatever the stage covers, and this is on the stage.
    if (!working || !turning || still) return;
    turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    return () => {
      cancelAnimation(turn);
      turn.value = 0;
    };
  }, [working, turning, still, turn]);
  // The fill; the turn of the ink (name and tick) midway through it; what the system said, last.
  const lightStyle = useAnimatedStyle(() => ({ opacity: interpolate(lit.value, [0, 0.7], [0, 1], Extrapolation.CLAMP) }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: interpolate(lit.value, INK, [0, 1], Extrapolation.CLAMP) }));
  // The white name stays whole under the navy one until that has fully come, then goes.
  const restStyle = useAnimatedStyle(() => ({ opacity: lit.value > INK[1] ? 0 : 1 }));
  const ringFade = useAnimatedStyle(() => ({ opacity: interpolate(lit.value, INK, [1, 0], Extrapolation.CLAMP) }));
  const tickStyle = useAnimatedStyle(() => {
    const ink = interpolate(lit.value, INK, [0, 1], Extrapolation.CLAMP);
    return { opacity: ink, transform: [{ scale: still ? 1 : 0.7 + ink * 0.3 }] };
  });
  const factStyle = useAnimatedStyle(() => ({ opacity: interpolate(lit.value, [INK[1], 1], [0, 1], Extrapolation.CLAMP) }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const name = t(`source.${source}`);
  const says = isIn
    ? [t("scan.connected", { sources: name }), first, second].filter(Boolean).join(", ")
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
  // The name under the logo's place (the logo itself is drawn once, over both faces).
  const title = (color: string) => (
    <>
      <View style={{ height: logo }} />
      <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color, letterSpacing: -0.3 }}>
        {name}
      </Text>
    </>
  );
  return (
    <View testID={`door.${source}`} accessible accessibilityLabel={says} style={[{ flex: 1, backgroundColor: DOOR_REST[scheme] }, arch]}>
      {/* The door's light. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: DOOR_LIT[scheme] }, arch, lightStyle]} />
      {/* The resting face: the name in white, and at the foot nothing, or the ring once the system has started. */}
      <View style={[StyleSheet.absoluteFill, inside]}>
        <Animated.View
          onLayout={(event: LayoutChangeEvent) => onName?.(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
          style={[styles.name, restStyle]}
        >
          {title(STAGE_INK)}
        </Animated.View>
        <Animated.View style={[styles.foot, ringFade]}>
          {ringed.current && <Animated.View style={[styles.ring, { borderColor: RING_TRACK[scheme] }, styles.ringBright, ringStyle]} />}
        </Animated.View>
      </View>
      {/* The lit face: the same name in the same place in navy, what the system said in its two lines' room, the tick. */}
      <View style={[StyleSheet.absoluteFill, inside]}>
        <View style={[styles.name, { alignSelf: "stretch" }]}>
          <Animated.View style={[styles.name, inkStyle]}>{title(DOOR_INK[scheme][source])}</Animated.View>
          <Animated.View style={[{ alignSelf: "stretch", height: factsRoom, marginTop: -space[1], justifyContent: "center" }, factStyle]}>
            {first !== undefined && (
              <Text size="bodyMedium" weight="medium" numberOfLines={second ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.fact}>
                {first}
              </Text>
            )}
            {second !== undefined && (
              <Text size="bodyMedium" weight="medium" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.fact}>
                {second}
              </Text>
            )}
          </Animated.View>
        </View>
        <Animated.View style={[styles.foot, tickStyle]}>
          <Icons.CheckCircle size={TICK} weight="fill" color={DOOR_TICK} />
        </Animated.View>
      </View>
      {/* The logo, once, over both faces. */}
      <View style={[StyleSheet.absoluteFill, inside, { justifyContent: "flex-start" }]}>
        <View>
          <SourceLogo source={source} size={logo} />
          {/* Edunex's logo is a white tile: a hairline keeps its shape on a lit, white door. */}
          {source === "edunex" && <View style={[StyleSheet.absoluteFill, { borderRadius: logo * 0.24, borderWidth: 1, borderColor: LOGO_EDGE }]} />}
        </View>
      </View>
    </View>
  );
});

/** Where in a door's lighting its ink turns (the name white to navy, the ring to the tick): a fifth of it, about five
 *  frames, with the door 43% lit before (white reads on it) and 71% after (navy does). */
const INK = [0.3, 0.5];

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
  foot: { height: TICK, alignItems: "center", justifyContent: "center" },
  name: { alignItems: "center", gap: space[2] },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3 },
  ringBright: { borderTopColor: DOOR_LIGHT, borderRightColor: DOOR_LIGHT },
  fact: { color: DOOR_FACT, textAlign: "center" },
  failed: { flexDirection: "row", alignItems: "flex-start", gap: space[2] },
  button: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    overflow: "hidden",
  },
  badgeEdge: { alignItems: "center", justifyContent: "center" },
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
