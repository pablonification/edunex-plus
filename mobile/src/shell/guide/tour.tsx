// The guide on screen, loaded at its first use (./host.tsx): the invitation, then the tour.
//
// The invitation is a quiet card over Beranda's foot, above the tabs, as the report's question is: "Kenalan dulu
// dengan Edunex Plus", with "Mulai panduan" and "Lewati panduan". It waits its turn (./steps.ts, `guideTurn`): never
// with a snackbar up ("Semua siap"), the report's question, or a system still signing in. It's no wall: Beranda works
// under it, and it goes when the Student goes elsewhere.
//
// The tour opens each step's tab, finds the real part (the view its screen handed over, ./state.ts), measures where it
// is in the window, and dims the screen around it: four panes around the spotlight and a ring on it, all moved on the
// UI thread (Reanimated, the kit's standard curve; in place at once with Remove animations). The caption is a card
// near the part: where it is in the tour and "Lewati panduan" first, the part's name and one line, then Kembali and
// Lanjut (Selesai on the last). The screen under it waits; Android's Back is Kembali, and leaves on the first step.
// A part its page doesn't show is passed over; one scrolled out of sight is said without a spotlight.
import { router, usePathname } from "expo-router";
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../../src/app/i18n";
import { useBridge, useDataset, useStatus, useStore } from "../../../../src/app/store";
import { toast, useToasts } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { useTabsBottom } from "../../ui/insets";
import { useReduceMotion } from "../../ui/motion";
import { moves } from "../../ui/moves";
import { tabBarHeight } from "../../ui/page-end";
import { Text } from "../../ui/text";
import { motion, radius, space, useTheme } from "../../ui/theme";
import { endGuide, guidePartView, type Measurable, startGuide } from "./state";
import { type Box, GUIDE_STEPS, guideAfter, guideOnScreen, guidePlace, guideTurn, OFFER_AFTER_MS } from "./steps";

const STANDARD = Easing.bezier(...motion.easing.standard);
/** How long a step waits for its part after its tab opens (a tab draws for the first time on its turn), and between looks. */
const PART_WAIT_MS = 1_500;
const PART_LOOK_MS = 80;
/**
 * A part is measured again once its page has settled: a tab's parts rise in as it's first shown, and a screen closing
 * over the tabs (Settings, where the tour is taken again) slides away over them.
 */
const SETTLED_MS = [450, 1_000] as const;
/** A tab just opened is measured after this long: its page is in place by then. */
const TAB_SHOWN_MS = 150;

/** The invitation, on its turn. */
export function GuideOffer() {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const store = useStore();
  const path = usePathname();
  const toasts = useToasts().length;
  const reports = useDataset("app.reports");
  const asking = Boolean(store.relay && reports?.asking);
  const edunex = useStatus("edunex").state;
  const six = useStatus("six").state;
  const turn = guideTurn({ path, toasts, asking, sources: [edunex, six] });
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!turn) return setShown(false);
    const timer = setTimeout(() => setShown(true), OFFER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [turn]);
  if (!shown) return null;
  const skip = () => {
    void bridge.invoke("settings.update", { guideDone: true }).catch(() => undefined);
    toast(t("guide.later"));
  };
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: space[3], right: space[3], bottom: insets.bottom + tabBarHeight(Platform.OS) + space[3] }}
    >
      <Animated.View
        testID="card.guide"
        accessibilityLabel={t("mobile.guide.offer")}
        accessibilityLiveRegion="polite"
        entering={still ? undefined : moves.arrive}
        style={{
          borderRadius: radius.xxl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.color.edge,
          backgroundColor: theme.color.raised,
          padding: space[4],
          elevation: 8,
          shadowColor: "#101828",
        }}
      >
        <Text size="body" weight="semibold" accessibilityRole="header">
          {t("guide.intro.title")}
        </Text>
        <Text size="small" tone="muted" style={{ marginTop: space[1] }}>
          {t("mobile.guide.intro.body")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
          <Button variant="primary" onPress={startGuide} testID="action.guideStart">
            {t("guide.start")}
          </Button>
          <Button variant="ghost" onPress={skip} testID="action.guideSkip">
            {t("guide.skip")}
          </Button>
        </View>
      </Animated.View>
    </View>
  );
}

const measure = (view: Measurable) => new Promise<Box>((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));

/** What's on screen for a step: which one, where its part is, and where the tour's own frame is (window coordinates). */
interface Shown {
  at: number;
  part: Box;
  root: Box;
}

/** The tour itself, from its first step that shows. */
export function GuideTour() {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const tabsBottom = useTabsBottom();
  const root = useRef<ComponentRef<typeof View>>(null);
  const said = useRef<ComponentRef<typeof View>>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [captionHeight, setCaptionHeight] = useState(0);
  // Each look for a step has a number: an older one that answers late (a step the Student already left) is dropped.
  const look = useRef(0);
  const at = useRef(0);
  const tab = useRef<string | null>(null);

  const finish = useCallback(
    (skipped: boolean) => {
      look.current += 1;
      void bridge.invoke("settings.update", { guideDone: true }).catch(() => undefined);
      endGuide();
      // Back where the Student's day starts, as the desktop's guide ends.
      router.navigate("/");
      if (skipped) toast(t("guide.later"));
    },
    [bridge, t],
  );

  /** Opens the step at `from`, or the next one in the direction `by` whose part is on its page. */
  const seek = useCallback(
    async (from: number | "end", by: 1 | -1) => {
      const mine = ++look.current;
      const origin = at.current;
      let i = from;
      while (i !== "end") {
        const step = GUIDE_STEPS[i]!;
        // From a screen over the tabs (Settings): back to the tabs first.
        if (router.canDismiss()) router.dismissAll();
        router.navigate(step.tab);
        const moved = tab.current !== step.tab;
        tab.current = step.tab;
        const view = await partSoon(step.part);
        // Another tab: its page is laid out a moment after it's shown.
        if (view && moved) await new Promise((done) => setTimeout(done, TAB_SHOWN_MS));
        if (mine !== look.current) return;
        if (view) {
          const frame = root.current as unknown as Measurable | null;
          const see = async () => {
            const [part, rootBox] = await Promise.all([measure(view), frame ? measure(frame) : Promise.resolve({ x: 0, y: 0, width: 0, height: 0 })]);
            if (mine !== look.current) return;
            at.current = i as number;
            setShown({ at: i as number, part, root: rootBox });
          };
          await see();
          for (const later of SETTLED_MS) setTimeout(() => void see(), later);
          return;
        }
        const next = guideAfter(i, by === 1 ? "next" : "back");
        // Nothing before this one shows: stay on the step the Student was on.
        if (next === i) return void seek(origin, 1);
        i = next;
      }
      finish(false);
    },
    [finish],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the tour opens
  useEffect(() => {
    void seek(0, 1);
    return () => {
      look.current += 1;
    };
  }, []);

  // Android's Back is Kembali; on the first step it leaves the tour.
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (at.current === 0) finish(true);
      else void seek(guideAfter(at.current, "back"), -1);
      return true;
    });
    return () => back.remove();
  }, [finish, seek]);

  // A screen reader lands on the step's words as each one shows.
  const step = shown ? GUIDE_STEPS[shown.at]! : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per step, when its caption is placed
  useEffect(() => {
    if (!step || captionHeight === 0 || !said.current) return;
    AccessibilityInfo.sendAccessibilityEvent(said.current as never, "focus");
  }, [step?.id, captionHeight > 0]);

  // The spotlight, in the tour's own coordinates: where it is now, moved on the UI thread.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const lit = useSharedValue(0);
  const first = useRef(true);

  let captionTop: number | null = null;
  let spot: Box | null = null;
  if (shown && step) {
    const { root: r } = shown;
    const top = insets.top;
    // The tabs' bar's top: where the tabs' pages end on Android (they report it), the floating bar's on an iPhone.
    const foot = (Platform.OS !== "ios" && tabsBottom > 0 ? tabsBottom - r.y : r.height - insets.bottom - tabBarHeight(Platform.OS)) - space[2];
    const frame = { x: 0, y: top, width: r.width, height: Math.max(0, foot - top) };
    const part = { x: shown.part.x - r.x, y: shown.part.y - r.y, width: shown.part.width, height: shown.part.height };
    const placed = guidePlace(part, frame, captionHeight);
    if (guideOnScreen(part, frame)) {
      spot = placed.spot;
      captionTop = placed.captionTop;
    } else captionTop = Math.max(frame.y, frame.y + frame.height - captionHeight - space[3]);
  }
  const sx = spot?.x ?? 0;
  const sy = spot?.y ?? 0;
  const sw = spot?.width ?? 0;
  const sh = spot?.height ?? 0;
  const has = spot !== null;
  const ready = shown !== null;
  useEffect(() => {
    if (!ready) return;
    const to = (value: number) => (still || first.current ? value : withTiming(value, { duration: motion.duration.medium, easing: STANDARD }));
    x.value = to(sx);
    y.value = to(sy);
    w.value = to(sw);
    h.value = to(sh);
    lit.value = to(has ? 1 : 0);
    first.current = false;
  }, [ready, sx, sy, sw, sh, has, still, x, y, w, h, lit]);

  const above = useAnimatedStyle(() => ({ height: y.value }));
  const below = useAnimatedStyle(() => ({ top: y.value + h.value }));
  const before = useAnimatedStyle(() => ({ top: y.value, height: h.value, width: x.value }));
  const after = useAnimatedStyle(() => ({ top: y.value, height: h.value, left: x.value + w.value }));
  const ring = useAnimatedStyle(() => ({ left: x.value, top: y.value, width: w.value, height: h.value, opacity: lit.value }));

  const dim = { position: "absolute", backgroundColor: theme.color.scrim } as const;
  const last = shown ? guideAfter(shown.at, "next") === "end" : false;
  const count = t("guide.step", { step: (shown?.at ?? 0) + 1, count: GUIDE_STEPS.length });
  return (
    <View
      ref={root}
      testID="screen.guide"
      // The screen under the tour waits: every touch stops here, and a screen reader stays on the tour.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={StyleSheet.absoluteFill}
    >
      {ready && (
        <>
          <Animated.View pointerEvents="none" style={[dim, { top: 0, left: 0, right: 0 }, above]} />
          <Animated.View pointerEvents="none" style={[dim, { left: 0, right: 0, bottom: 0 }, below]} />
          <Animated.View pointerEvents="none" style={[dim, { left: 0 }, before]} />
          <Animated.View pointerEvents="none" style={[dim, { right: 0 }, after]} />
          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", borderRadius: radius.lg, borderWidth: 2, borderColor: theme.color.accent }, ring]}
          />
        </>
      )}
      {shown && step && (
        <View
          // Measured first, shown once it's placed: the caption never jumps.
          onLayout={(event) => setCaptionHeight(Math.round(event.nativeEvent.layout.height))}
          style={{ position: "absolute", left: space[4], right: space[4], top: captionTop ?? 0, opacity: captionHeight > 0 ? 1 : 0 }}
        >
          <Animated.View
            key={step.id}
            testID={`card.guide.${step.id}`}
            entering={still ? undefined : moves.arrive}
            style={{
              borderRadius: radius.xxl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.color.edge,
              backgroundColor: theme.color.raised,
              paddingHorizontal: space[4],
              paddingBottom: space[3],
              elevation: 8,
              shadowColor: "#101828",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginRight: -space[2] }}>
              <Text size="small" tone="muted" tabular testID="label.guideStep">
                {count}
              </Text>
              <Button variant="ghost" onPress={() => finish(true)} testID="action.guideSkip">
                {t("guide.skip")}
              </Button>
            </View>
            <View ref={said} accessible accessibilityLabel={`${t(step.title)}. ${t(step.body)} ${count}`}>
              <Text size="body" weight="semibold" accessibilityRole="header">
                {t(step.title)}
              </Text>
              <Text size="bodyMedium" tone="muted" style={{ marginTop: space[1] }}>
                {t(step.body)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space[2], marginTop: space[3] }}>
              {guideAfter(shown.at, "back") !== shown.at && (
                <Button variant="ghost" onPress={() => void seek(guideAfter(shown.at, "back"), -1)} testID="action.guideBack">
                  {t("action.back")}
                </Button>
              )}
              <Button variant="primary" onPress={() => void seek(guideAfter(shown.at, "next"), 1)} testID="action.guideNext">
                {t(last ? "guide.done" : "guide.next")}
              </Button>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/** The part's view once its page has drawn it, or undefined if it doesn't come (its page doesn't show it now). */
function partSoon(id: string): Promise<Measurable | undefined> {
  return new Promise((resolve) => {
    const began = Date.now();
    const lookNow = () => {
      const view = guidePartView(id);
      if (view || Date.now() - began >= PART_WAIT_MS) resolve(view);
      else setTimeout(lookNow, PART_LOOK_MS);
    };
    lookNow();
  });
}
