// The guide on screen, loaded at its first use (./host.tsx): the invitation, then the tour.
//
// The invitation is a quiet card over Beranda's foot, above the tabs, as the report's question is: "Kenalan dulu
// dengan Edunex Plus", with "Mulai panduan" and "Lewati panduan". It waits its turn (./steps.ts, `guideTurn`): never
// with a snackbar up ("Semua siap"), the report's question, or a system still signing in. It's no wall: Beranda works
// under it, and it goes when the Student goes elsewhere.
//
// The tour, step by step: its tab opens, that tab's page goes back to its top, the step's words are there at once,
// and the real part (the view its screen handed over, ./state.ts) is measured once it has stopped moving. The screen
// is dimmed around the part (four panes around the spotlight, and a ring on it), all moved on the UI thread
// (Reanimated, the kit's standard curve; in place at once with Remove animations). The caption is one card with one
// place for the whole tour, the foot of the screen above the tabs: where it is in the tour and "Lewati panduan" first,
// the part's name and one line, then Kembali and Lanjut (Selesai on the last). A part as tall as its page is pointed
// at by its top, above the caption, so every step has a ring. The screen under it waits; Android's Back is Kembali,
// and leaves on the first step.
import { router, usePathname } from "expo-router";
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../../src/app/i18n";
import { useBridge, useDataset, useStatus, useStore } from "../../../../src/app/store";
import { toast, useToasts } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { useReduceMotion } from "../../ui/motion";
import { moves } from "../../ui/moves";
import { tabBarHeight } from "../../ui/page-end";
import { scrollPagesTo } from "../../ui/scroll-top";
import { Text } from "../../ui/text";
import { motion, radius, space, useTheme } from "../../ui/theme";
import { endGuide, guidePartView, type Measurable, startGuide } from "./state";
import { type Box, CAPTION_GAP, GUIDE_STEPS, guideAfter, guideSpot, guideTurn, OFFER_AFTER_MS, SPOT_PAD } from "./steps";

const STANDARD = Easing.bezier(...motion.easing.standard);
/** How long a step waits for its part after its tab opens (a tab draws for the first time on its turn), and between looks. */
const PART_WAIT_MS = 4_000;
const PART_LOOK_MS = 80;

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

/** Where a view is in the window, or null when it doesn't answer (a view that just went never does). */
const measure = (view: Measurable) =>
  new Promise<Box | null>((resolve) => {
    const late = setTimeout(() => resolve(null), MEASURE_MS);
    view.measureInWindow((x, y, width, height) => {
      clearTimeout(late);
      resolve({ x, y, width, height });
    });
  });
const MEASURE_MS = 400;
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const same = (a: Box, b: Box) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** How often, and how many times, a part's place is looked at after its ring first shows: a page still drawing or
 *  reading its data moves its parts, and the ring follows. */
const FOLLOW_EVERY_MS = 140;
const FOLLOW_LOOKS = 10;
/** A page asked to go somewhere is there after this long. */
const SCROLLED_MS = 60;
/** A part that doesn't answer where it is (a busy phone) is asked again this many times before the step goes without a ring. */
const FIRST_LOOKS = 8;

/**
 * What's on screen for a step: which one, where its part is (null until it's found, or when its page doesn't show it:
 * the step's words are there either way), and where the tour's own frame is (window coordinates).
 */
interface Shown {
  at: number;
  part: Box | null;
  root: Box;
}

/** The tour itself, from its first step. */
export function GuideTour() {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const root = useRef<ComponentRef<typeof View>>(null);
  const said = useRef<ComponentRef<typeof View>>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [captionHeight, setCaptionHeight] = useState(0);
  // Each look for a step has a number: an older one that answers late (a step the Student already left) is dropped.
  const look = useRef(0);
  const at = useRef(0);
  const window = useWindowDimensions();
  const size = useRef(window);
  size.current = window;
  // The room a part has, in window coordinates: from under a page's own bar to above the caption (once it's measured).
  const rooms = useRef<{ ceiling: number; floor: number } | null>(null);

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

  /**
   * Opens step `to`. In this order, every time: its tab; that tab's page back at its top (the parts the tour points
   * at sit there, and a page the Student had scrolled left it pointing at nothing); the step's words, at once, so the
   * tap is answered; then the part's place once it has stopped moving, and the ring goes there. Every "Lanjut" moves
   * exactly one step, whatever the page under it is doing.
   */
  const seek = useCallback(
    async (to: number | "end") => {
      const mine = ++look.current;
      const alive = () => mine === look.current;
      if (to === "end") return finish(false);
      const step = GUIDE_STEPS[to]!;
      // From a screen over the tabs (Settings): back to the tabs first.
      if (router.canDismiss()) router.dismissAll();
      router.navigate(step.tab);
      at.current = to;
      const frame = root.current as unknown as Measurable | null;
      const rootBox = (frame ? await measure(frame) : null) ?? { x: 0, y: 0, width: size.current.width, height: size.current.height };
      if (!alive()) return;
      // The words now, the ring away until the part's new place is known: it never points at the step before.
      setShown({ at: to, part: null, root: rootBox });
      const view = await partSoon(step.part);
      if (!alive()) return;
      scrollPagesTo(0);
      if (!view) return;
      // The page is at its top a frame or two after it's asked: the part is looked for then.
      await pause(SCROLLED_MS);
      if (!alive()) return;
      // The part's place, as soon as it answers: the ring is there at once, not once the page has gone quiet.
      const seen = async (): Promise<Box | null> => {
        for (let tries = 0; tries < FIRST_LOOKS; tries += 1) {
          const box = await measure(view);
          if (!alive()) return null;
          if (box && box.width > 0 && box.height > 0) return box;
          await pause(FOLLOW_EVERY_MS);
        }
        return null;
      };
      let part = await seen();
      if (!part || !alive()) return;
      // A part that ends under the caption is brought up into the room above it, when the page can be scrolled that
      // far without taking the part's own top out of sight (Beranda's services, Kuliah's list).
      const room = rooms.current;
      if (room) {
        const over = part.y + part.height + SPOT_PAD - room.floor;
        if (over > 0 && part.y - over >= room.ceiling) {
          scrollPagesTo(over);
          await pause(SCROLLED_MS);
          if (!alive()) return;
          part = await seen();
          if (!part || !alive()) return;
        }
      }
      setShown({ at: to, part, root: rootBox });
      // Then it's followed for a moment: a page still drawing or reading its data moves its parts, and the ring goes
      // with them.
      for (let looks = 0; looks < FOLLOW_LOOKS; looks += 1) {
        await pause(FOLLOW_EVERY_MS);
        if (!alive()) return;
        const now = await measure(view);
        if (!alive()) return;
        if (now && now.width > 0 && now.height > 0 && !same(now, part)) {
          part = now;
          setShown({ at: to, part, root: rootBox });
        }
      }
    },
    [finish],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the tour opens
  useEffect(() => {
    void seek(0);
    return () => {
      look.current += 1;
    };
  }, []);

  // Android's Back is Kembali; on the first step it leaves the tour.
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (at.current === 0) finish(true);
      else void seek(guideAfter(at.current, "back"));
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
  const placed = useRef(false);

  let captionTop: number | null = null;
  let spot: Box | null = null;
  if (shown && step) {
    const { root: r } = shown;
    const top = insets.top;
    // The tabs' bar's top: the phone's own bar (or the home indicator), then the tabs' bar's height. One figure for
    // the whole tour, so the caption's place never changes while it runs.
    const foot = r.height - insets.bottom - tabBarHeight(Platform.OS) - space[2];
    const frame = { x: 0, y: top, width: r.width, height: Math.max(0, foot - top) };
    const part = shown.part ? { x: shown.part.x - r.x, y: shown.part.y - r.y, width: shown.part.width, height: shown.part.height } : null;
    const place = guideSpot(part, frame, captionHeight);
    spot = captionHeight > 0 ? place.spot : null;
    captionTop = place.captionTop;
    rooms.current = captionHeight > 0 ? { ceiling: r.y + top + PAGE_BAR, floor: r.y + place.captionTop - CAPTION_GAP } : null;
  }
  const sx = spot?.x ?? 0;
  const sy = spot?.y ?? 0;
  const sw = spot?.width ?? 0;
  const sh = spot?.height ?? 0;
  const has = spot !== null;
  const ready = shown !== null;
  useEffect(() => {
    if (!ready) return;
    const ease = (value: number) => (still ? value : withTiming(value, { duration: motion.duration.medium, easing: STANDARD }));
    if (!has) {
      // No ring: the screen is dimmed whole (the panes close over where the ring was).
      lit.value = ease(0);
      return;
    }
    // The first ring is simply there; after that it travels from the part before to this one.
    const to = placed.current ? ease : (value: number) => value;
    x.value = to(sx);
    y.value = to(sy);
    w.value = to(sw);
    h.value = to(sh);
    lit.value = ease(1);
    placed.current = true;
  }, [ready, sx, sy, sw, sh, has, still, x, y, w, h, lit]);

  // Four panes around the spotlight. With no ring they meet (the hole closes as the ring fades), so the screen is
  // dimmed whole and nothing un-dimmed is left where the last part was.
  const above = useAnimatedStyle(() => ({ height: y.value + (1 - lit.value) * h.value }));
  const below = useAnimatedStyle(() => ({ top: y.value + h.value }));
  const before = useAnimatedStyle(() => ({ top: y.value + (1 - lit.value) * h.value, height: lit.value * h.value, width: x.value }));
  const after = useAnimatedStyle(() => ({ top: y.value + (1 - lit.value) * h.value, height: lit.value * h.value, left: x.value + w.value }));
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
        // One card in one place for the whole tour (the frame's foot): its words change, it doesn't move or come
        // again. Measured first, shown once its height is known.
        <Animated.View
          testID={`card.guide.${step.id}`}
          entering={still ? undefined : moves.arrive}
          onLayout={(event) => setCaptionHeight(Math.round(event.nativeEvent.layout.height))}
          style={{
            position: "absolute",
            left: space[4],
            right: space[4],
            top: captionTop ?? 0,
            opacity: captionHeight > 0 ? 1 : 0,
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
            {/* Room for three lines whatever the step says: the card keeps its height, so nothing under it moves. */}
            <Text size="bodyMedium" tone="muted" style={{ marginTop: space[1], minHeight: BODY_LINES * 20 }}>
              {t(step.body)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space[2], marginTop: space[3] }}>
            {guideAfter(shown.at, "back") !== shown.at && (
              <Button variant="ghost" onPress={() => void seek(guideAfter(shown.at, "back"))} testID="action.guideBack">
                {t("action.back")}
              </Button>
            )}
            <Button variant="primary" onPress={() => void seek(guideAfter(shown.at, "next"))} testID="action.guideNext">
              {t(last ? "guide.done" : "guide.next")}
            </Button>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
/** A page's own bar under the status bar (a tab's title row, Beranda's search row): a part isn't scrolled up under it. */
const PAGE_BAR = 64;
/** The lines a step's words are given room for (the longest takes three at the usual font size). */
const BODY_LINES = 3;

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
