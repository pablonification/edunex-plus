// The phone's first minute: two doors, one room. Edunex and SIX are two places every ITB student signs in to, and the
// app is the one room behind both. The scene happens around what must happen anyway (one sign-in), so nothing is added
// to wait for and there's nothing to swipe or skip. Second by second (DESIGN.md, "The first minute"):
//
//   1. The stage is Beranda's header colour, full height, from the app's first frame (../welcome.tsx). On it: two
//      doors in the upper half, one per system, both the same; the headline bottom-left; one button under the thumb.
//   2. The tap: the button becomes the status in words, in place, and the language chip goes. A door breathes while its
//      system signs in and lights with a tick once it's in, a haptic each. Three honest states, nothing measured.
//   3. The doors close up and the app's mark lands on the seam between them.
//   4. The hand-over, at once: the stage draws up into Beranda's header and is the header (./seam.ts), the greeting
//      written where Beranda's is, the doors flown small beside one status line where Beranda's status line lives, in
//      its words ("Membaca Edunex · Tugas…"). Under
//      it the real Beranda was there all along, its own cards filling in place as the first read brings them.
//   5. A moment later the scene fades off the header and is gone. The first read carries on in Beranda's own line.
//
// Nothing here waits for the read: the scene ends about a second after the systems are in. Every move runs on the UI
// thread (Reanimated), on transforms and opacity only. With Remove animations the same steps cross-fade and nothing
// moves. Loaded only when nobody is signed in (./gate.tsx).
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, type LayoutChangeEvent, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
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
import { firstRead, SCAN_PARTS } from "../../../../src/core/first-scan";
import type { DatasetName } from "../../../../src/core/models";
import { useReadStatuses } from "../../screens/first-scan/scan";
import { partOfDay } from "../../screens/home/greeting";
import { SourceLogo } from "../../ui/brand";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { useReduceMotion } from "../../ui/motion";
import { Tap } from "../../ui/moves";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { motion, shape, space, TOUCH, useTheme } from "../../ui/theme";
import { CHIP_EDGE_ALPHA, DOOR_INK, DOOR_LIT, DOOR_REST_ALPHA, MARK_COLOR, MARK_INK } from "./colors";
import { setFirstMinuteStageUp } from "./gate";
import { seam } from "./seam";

type Source = "edunex" | "six";
/** A door's three states, each one true: nothing yet, its system signing in, its system in. */
type DoorState = "rest" | "working" | "in";
/** The doors on the stage; the doors closing up under the mark; the stage settled into Beranda's header. */
type Phase = "doors" | "joining" | "settled";

/** The gap between the doors, closed as they join. */
const GAP = 14;
const SIDE = space[6];
/** The mark's badge on the seam. */
const BADGE = 52;
/** A door's tick, and the room under it. */
const TICK = 24;
const FOOT = space[4];
/** A door in the header, after the hand-over: this high. */
const SMALL = 16;
/** Both in: this long to see the second door light before they join. */
const BOTH_HOLD_MS = 250;
/** One in: this long for the other to come along on the same sign-in; then the hand-over goes without it. */
const OTHER_WAIT_MS = 2_000;
/** The doors closing up and the mark landing, before the stage moves. */
const JOIN_MS = 520;
/** The stage drawing up into the header. */
const SETTLE_MS = 560;
/** Material's emphasized curve, for the stage settling. */
const EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);

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

  const [phase, setPhase] = useState<Phase>("doors");
  const [busy, setBusy] = useState<Source | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Where things are, once drawn: the room the doors have, where a door's name ends, where the header's status line is.
  const [area, setArea] = useState<{ y: number; height: number } | null>(null);
  const [nameEnd, setNameEnd] = useState<number | null>(null);
  const [lineY, setLineY] = useState<number | null>(null);

  const edunexIn = edunex !== "signed-out" || account !== undefined;
  const sixIn = six !== "signed-out" || student !== undefined;
  const anyIn = edunexIn || sixIn;
  const bothIn = edunexIn && sixIn;
  // The tap is behind the Student: the button is the status now.
  const asked = busy !== null || anyIn;

  // One value per move, each on the UI thread: the doors closing up, the mark landing, the stage settling into
  // Beranda's header, the scene fading off Beranda.
  const join = useSharedValue(0);
  const mark = useSharedValue(0);
  const settle = useSharedValue(0);
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
      later(() => {
        setPhase("settled");
        haptic.confirm();
        out.value = withTiming(1, { duration: motion.duration.long });
        later(() => done.current(), motion.duration.long + 40);
      }, JOIN_MS);
      return;
    }
    // The whole hand-over is set going here, on the UI thread: the first read's JavaScript can't hold a step of it up.
    // The timers after it only tell the screen reader, the touch layer and the haptics where it is.
    const gone = JOIN_MS + SETTLE_MS + seam.holdMs;
    join.value = withSpring(1, motion.spatialDefault);
    mark.value = withDelay(120, withSpring(1, motion.expressive));
    settle.value = withDelay(JOIN_MS, withTiming(1, { duration: SETTLE_MS, easing: EMPHASIZED }));
    out.value = withDelay(gone, withTiming(1, { duration: motion.duration.medium }));
    later(() => haptic.tick(), 160);
    later(() => {
      setPhase("settled");
      haptic.confirm();
    }, JOIN_MS);
    later(() => done.current(), gone + motion.duration.medium + 40);
  }, [still, join, mark, settle, out, later]);

  // A system is in: the hand-over starts once the other has come along, or soon after without it (its door then
  // lights in the header if it makes it, and Beranda has its own way to connect it if it doesn't).
  useEffect(() => {
    if (phase !== "doors" || !anyIn) return;
    const timer = setTimeout(handOver, bothIn ? BOTH_HOLD_MS : OTHER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [phase, anyIn, bothIn, handOver]);

  // The sign-in didn't hold after all (the first read refused it): back to the doors, where the reason is said.
  useEffect(() => {
    if (phase === "doors" || anyIn) return;
    clearTimers();
    for (const value of [join, mark, settle, out]) {
      cancelAnimation(value);
      value.value = 0;
    }
    setPhase("doors");
  }, [phase, anyIn, clearTimers, join, mark, settle, out]);

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
  const doorHeight = Math.max(120, Math.min(room - space[2], doorWidth * 2.1));
  const doorsTop = (area?.y ?? insets.top + TOUCH + space[2]) + Math.max(0, room - doorHeight) * 0.35;
  // The mark lands on the seam between a door's name and its tick, touching neither.
  const tickTop = doorHeight - FOOT - TICK;
  const markY = ((nameEnd ?? doorHeight * 0.45) + tickTop) / 2;
  // Where the doors fly to: small, at the start of the header's status line.
  const small = SMALL / doorHeight;
  const flyX = seam.greeting.inset + (rowWidth * small) / 2 - size.width / 2;
  const flyY = (lineY ?? insets.top + seam.greeting.height / 2 + 14) - (doorsTop + doorHeight / 2);
  const travel = size.height - seam.restHeight(insets);
  const toHeader = seam.greeting.shown;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -settle.value * travel }] }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, settle.value * 3.5),
    transform: [{ translateY: -settle.value * 56 }],
  }));
  const doorsStyle = useAnimatedStyle(() => ({
    opacity: toHeader ? 1 : 1 - Math.min(1, settle.value * 3.5),
    transform: [{ translateX: settle.value * flyX }, { translateY: settle.value * flyY }, { scale: 1 - settle.value * (1 - small) }],
  }));
  const leftDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (join.value * GAP) / 2 }] }));
  const rightDoor = useAnimatedStyle(() => ({ transform: [{ translateX: (-join.value * GAP) / 2 }] }));
  // The mark goes as the stage starts to move: nothing of it is left floating.
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, mark.value) * (1 - Math.min(1, settle.value * 5)),
    transform: [{ scale: still ? 1 : mark.value }],
  }));
  // The greeting writes in where Beranda's is, as the stage comes to rest.
  const headerStyle = useAnimatedStyle(() => {
    const shown = Math.min(1, Math.max(0, (settle.value - 0.3) / 0.5));
    return { opacity: shown, transform: [{ translateY: (1 - shown) * 6 }] };
  });

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

  const name = account?.name ?? student?.name;
  const part = partOfDay(new Date(now).getHours(), lang);
  const hello = name ? t(`mobile.home.hello.${part}`, { name: firstName(name) }) : t(`time.greeting.${part}`);
  const ink = seam.ink(v);
  const headline = [t("welcome.headline1"), t("welcome.headline2")];
  const headlineFont = headlineSize(rowWidth, headline);
  const light = theme.scheme === "dark" ? "dark" : "light";
  const settled = phase === "settled";
  // Big text or a small phone: the lead goes before the doors lose their room.
  const tight = size.height < 700 && PixelRatio.getFontScale() > 1.15;

  return (
    <Animated.View
      testID="screen.firstMinute"
      onLayout={(event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      // Settled, Beranda under it is the Student's to touch and to hear; the scene only finishes drawing.
      pointerEvents={settled ? "none" : "auto"}
      accessibilityViewIsModal={!settled}
      accessibilityElementsHidden={settled}
      importantForAccessibility={settled ? "no-hide-descendants" : "auto"}
      style={[StyleSheet.absoluteFill, { zIndex: 60 }, rootStyle]}
    >
      {/* The stage is Beranda's header colour, light and dark: the status bar's icons are white on it from the first
          frame to the last. */}
      <StatusBar style="light" />
      {/* The stage: one sheet of Beranda's header colour, which draws up at the hand-over and is the header. */}
      <Animated.View pointerEvents="none" style={[styles.stage, { height: size.height, backgroundColor: seam.color(v) }, stageStyle]} />

      {/* What's said on the stage: the headline bottom-left, the one button under the thumb. */}
      <Animated.View testID="screen.welcome" style={[StyleSheet.absoluteFill, { paddingTop: insets.top, paddingBottom: insets.bottom }, wordsStyle]}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space[4], minHeight: TOUCH + space[2], alignItems: "center" }}>
          {!asked && <LanguageChip ink={ink} />}
        </View>
        {/* The doors' room: they're drawn over it (below), so they can leave it at the hand-over. */}
        <View
          onLayout={(event: LayoutChangeEvent) => setArea({ y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height })}
          style={{ flex: 1, minHeight: 140 }}
        />
        <Animated.View entering={enter(2)} style={{ paddingHorizontal: SIDE, paddingTop: space[4] }} accessible accessibilityRole="header">
          {/* The desktop's headline, broken where it breathes: each half keeps to its one line at any font size. */}
          {headline.map((half) => (
            <Headline key={half} ink={ink} size={headlineFont}>
              {half}
            </Headline>
          ))}
        </Animated.View>
        <Animated.View entering={enter(3)} style={{ paddingHorizontal: SIDE, paddingTop: space[5], paddingBottom: space[5], gap: space[3] }}>
          {failed && !asked && (
            <View style={{ borderRadius: shape.md, backgroundColor: v.redBg, padding: space[3] }} accessibilityLiveRegion="polite">
              <Text size="bodyMedium" style={{ color: v.redFg }}>
                {failed}
              </Text>
            </View>
          )}
          {asked ? (
            // The button's place, now the status: words only, one line that changes as the sign-in moves.
            <View testID="status.signIn" accessibilityLiveRegion="polite" style={{ minHeight: BUTTON, justifyContent: "center" }}>
              <Animated.View key={status} entering={FadeIn.duration(motion.duration.short)}>
                <Text size="bodyLarge" weight="semibold" style={{ color: ink }}>
                  {status}
                </Text>
              </Animated.View>
            </View>
          ) : (
            <Tap
              onPress={() => void signIn("edunex")}
              testID="action.signIn"
              style={{
                minHeight: BUTTON,
                borderRadius: BUTTON / 2,
                backgroundColor: light === "light" ? DOOR_LIT.light : v.brand,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: space[4],
                paddingVertical: space[2],
                overflow: "hidden",
              }}
            >
              <Text size="bodyLarge" weight="semibold" style={{ color: light === "light" ? DOOR_INK.edunex : v.onBrand, textAlign: "center" }}>
                {t("mobile.welcome.signIn")}
              </Text>
            </Tap>
          )}
          {!tight && (
            <Text size="bodySmall" style={{ color: ink }}>
              {t("welcome.connectLead")}
            </Text>
          )}
        </Animated.View>
      </Animated.View>

      {/* The doors: the screen's one picture. At the hand-over they fly, small, to the header's status line. */}
      {area !== null && (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility={phase === "doors" ? "auto" : "no-hide-descendants"}
          style={[{ position: "absolute", left: SIDE, top: doorsTop, width: rowWidth, height: doorHeight }, doorsStyle]}
        >
          <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
            <Animated.View entering={enter(0)} style={{ flex: 1 }}>
              <Animated.View style={[{ flex: 1 }, leftDoor]}>
                <Door source="edunex" state={doorState("edunex")} width={doorWidth} height={doorHeight} scheme={light} away={settle} onName={setNameEnd} />
              </Animated.View>
            </Animated.View>
            <Animated.View entering={enter(1)} style={{ flex: 1 }}>
              <Animated.View style={[{ flex: 1 }, rightDoor]}>
                <Door source="six" state={doorState("six")} width={doorWidth} height={doorHeight} scheme={light} away={settle} />
              </Animated.View>
            </Animated.View>
          </View>
          {/* The app's mark, landing on the seam where the two doors meet. */}
          <Animated.View style={[styles.badge, { left: rowWidth / 2 - BADGE / 2, top: markY - BADGE / 2 }, markStyle]}>
            <Image
              source={require("../../../assets/android-icon-monochrome.png")}
              style={{ width: BADGE * 1.5, height: BADGE * 1.5, tintColor: MARK_INK }}
              accessibilityIgnoresInvertColors
              accessibilityElementsHidden
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* The header the stage becomes: the greeting where Beranda's own is, and one status line under it, the doors
          (small) at its start. Drawn from the moment a system is in, unseen, so it's measured before anything moves. */}
      {anyIn && toHeader && !still && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: insets.top,
              left: seam.greeting.inset,
              right: seam.greeting.end,
              height: seam.greeting.height,
              justifyContent: "center",
            },
            headerStyle,
          ]}
        >
          <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} style={{ color: ink, letterSpacing: -0.3 }}>
            {hello}
          </Text>
          <View
            onLayout={(event: LayoutChangeEvent) => setLineY(insets.top + event.nativeEvent.layout.y + event.nativeEvent.layout.height / 2)}
            style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2, minHeight: SMALL }}
          >
            <View style={{ width: rowWidth * small, height: SMALL }} />
            <HeaderLine ink={ink} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** The sign-in button's height, and the status line's that takes its place: nothing under it moves at the tap. */
const BUTTON = 52;

/** The headline's size at its largest (sp), and a letter's share of it in the display face, bold (a little over). */
const HEADLINE = 32;
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

/** One half of the headline, on its one line (a hair smaller rather than broken, should a face run wide). */
function Headline({ ink, size, children }: { ink: string; size: number; children: string }) {
  return (
    <Text
      size="headlineLarge"
      face="display"
      weight="bold"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={{ color: ink, fontSize: size, lineHeight: Math.round(size * 1.22), letterSpacing: -0.4 }}
    >
      {children}
    </Text>
  );
}

/** What the header's status line reads from: what Beranda's own line reads (the first read's parts). */
const READ: readonly DatasetName[] = ["six.student", ...SCAN_PARTS.edunex, ...SCAN_PARTS.six, ...SCAN_PARTS.itb];

/**
 * The header's one status line while the scene is still on it: what's being read now, in the words Beranda's own
 * status line says under it ("Membaca Edunex · Tugas…"), so nothing changes when the scene goes.
 */
function HeaderLine({ ink }: { ink: string }) {
  const t = useT();
  const read = firstRead(useSaved(READ), useReadStatuses());
  const part = read.progress < 1 ? read.next : null;
  return (
    <Text testID="firstMinute.status" size="bodySmall" numberOfLines={1} style={{ color: ink, flexShrink: 1 }}>
      {part ? t("mobile.home.reading", { part: `${t(`source.${part.source}`)} · ${t(`scan.part.${part.part}`)}` }) : t("welcome.readingWait")}
    </Text>
  );
}

/**
 * A system as a door: its logo and its name on an arch. Nothing on it is a control, and both doors are the same until
 * a system moves: at rest a faint light; while its sign-in runs the light breathes; once it's in the door is lit, its
 * name in its own colour and a tick at its foot. Its size never changes. With less motion asked for, the light fades
 * between the three and nothing breathes. `away` (0 to 1) fades what's written as the door flies to the header.
 */
function Door({
  source,
  state,
  width,
  height,
  scheme,
  away,
  onName,
}: {
  source: Source;
  state: DoorState;
  width: number;
  height: number;
  scheme: "light" | "dark";
  away: SharedValue<number>;
  /** Where the name ends, from the door's top. */
  onName?: (y: number) => void;
}) {
  const t = useT();
  const v = useTheme().v4;
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
        ? withTiming(0.3, { duration: motion.duration.short })
        : withRepeat(withSequence(withTiming(0.42, { duration: 700 }), withTiming(0.1, { duration: 700 })), -1);
    } else {
      tick.value = 0;
      lit.value = withTiming(0, { duration: motion.duration.medium });
    }
  }, [state, still, lit, tick]);
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, away.value * 4) }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, tick.value) * (1 - Math.min(1, away.value * 4)),
    transform: [{ scale: still ? 1 : tick.value }],
  }));
  const name = t(`source.${source}`);
  const says = isIn
    ? t("scan.connected", { sources: name })
    : state === "working"
      ? t("signIn.joining", { source: name })
      : `${name}: ${t("welcome.notConnected")}`;
  const fg = isIn ? DOOR_INK[source] : seam.ink(v);
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
      <Animated.View
        onLayout={(event: LayoutChangeEvent) => onName?.(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
        style={[{ alignItems: "center", gap: space[2] }, wordsStyle]}
      >
        <SourceLogo source={source} size={logo} />
        <Text
          size="titleLarge"
          face="display"
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ color: fg, letterSpacing: -0.3 }}
        >
          {name}
        </Text>
      </Animated.View>
      {/* The tick: nothing here until the system is in. */}
      <Animated.View style={[{ height: TICK, justifyContent: "center" }, tickStyle]}>
        <Icons.Check size={TICK} weight="bold" color={DOOR_INK[source]} />
      </Animated.View>
    </View>
  );
}

/** Indonesia or English, as a small chip: the phone's language picked it; a tap switches. Gone once the Student taps in. */
function LanguageChip({ ink }: { ink: string }) {
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
      <Icons.Globe size={18} color={ink} />
      <Text size="labelLarge" style={{ color: ink }}>
        {name[lang]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { position: "absolute", top: 0, left: 0, right: 0 },
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
