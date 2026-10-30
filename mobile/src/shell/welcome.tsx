// The first run on the phone (and after signing out of everything): the desktop's welcome
// (src/app/shell/welcome.tsx) told the same way on a phone's dark stage. A credit, the promise, then
// connecting Edunex and SIX on ITB's own pages (one Microsoft sign-in, the other system comes along by
// itself when it can), then reading the semester until Beranda has what it shows
// (src/core/first-scan.ts homeReady). "Buka Edunex Plus" asks for notifications first, saying why.
// As on the desktop: the app's mark stays in one place from the promise to connecting, with Edunex
// and SIX either side of it, each linking to it as it connects; reading shows the Student's own
// Beranda, small, coming in as the read does; three dots say which step this is; the language is in
// the corner. The desktop's light and sound stay on the desktop: a soft glow behind the mark is enough here.
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from "react-native-svg";
import { useT } from "../../../src/app/i18n";
import { displayName, firstName } from "../../../src/app/names";
import { useSaved } from "../../../src/app/saved";
import { useBridge, useDataset, useSettings, useSignInStep, useStatus } from "../../../src/app/store";
import { firstRead, homeReady, scanSummary } from "../../../src/core/first-scan";
import type { DatasetName } from "../../../src/core/models";
import { Home } from "../screens/home";
import { SourceLogo } from "../ui/brand";
import { Icons } from "../ui/icons";
import { Text } from "../ui/text";
import { radius, space, useTheme } from "../ui/theme";
import { useSignIn, useSignInNote } from "./source-status";

/** What the reading step counts, and what decides it's done: the desktop's list. */
const READ: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  "six.skipped",
  "six.schedule",
  "six.scheduleMonths",
  "six.transcript",
  "edunex.courses",
  "edunex.tasks",
  "edunex.outline",
  "edunex.materials",
  "edunex.presence",
  "edunex.announcements",
  "edunex.exams",
  "itb.calendar",
];

/** The reading step never holds the Student longer than this. */
const READ_PATIENCE = 20_000;
/** The opening credit, in ms: "dari" turns to "untuk", then the promise comes. */
const CREDIT = { turn: 1300, done: 2600 } as const;

/** The welcome's own dark stage, the desktop's (--stage), whatever the phone's theme. */
const STAGE = {
  bg: "#04050a",
  fg: "#f2f2f5",
  muted: "#a5a7b3",
  faint: "#7c7e8a",
  accent: "#2f6feb",
  link: "#5b8cff",
  live: "#2fbf6c",
  warning: "#e8b94a",
  line: "rgba(255,255,255,0.12)",
};

/** The app's mark, the same size and place from the promise to connecting. */
const MARK = 80;
/** Edunex's and SIX's logos either side of it, and the column each stands in. */
const LOGO = 56;
/**
 * The column each stands in, as wide as half the row allows (up to TILE_MAX): wide enough for SIX's
 * program on two lines ("Sistem dan Teknologi / Informasi"). The link to the mark runs over the column's
 * empty sides, from the logo's edge, so the logos keep their place.
 */
const TILE_MAX = 152;
const tileWidth = (screen: number) => {
  const row = screen - space[5] * 2 + space[1] * 2;
  // Two columns side by side with a gap, and room left on a small phone for each link's shortest line (16, and 4 at
  // each end) between the logo and the mark.
  return Math.min(TILE_MAX, Math.floor((row - space[2]) / 2), row - MARK - 2 * (space[4] + space[1] * 2) - LOGO);
};
/** Room kept at the top for the language switch, and at the bottom for the step dots. */
const TOP_BAR = 56;
const DOTS = 40;
/** How far down the stage the mark sits, as a share of its height. */
const MARK_AT = 0.14;

const isConnected = (state: string) => state !== "signed-out" && state !== "expired";

type Step = "opening" | "hello" | "connect" | "reading";

/** Where the mark sits on this phone, from the top of a step's page, and the stage's height. */
function useStage() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const room = height - insets.top - insets.bottom - TOP_BAR - DOTS;
  return { room, markTop: Math.max(space[4], Math.round(room * MARK_AT)), glowAt: (insets.top + TOP_BAR + room * MARK_AT + MARK / 2) / height };
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("opening");
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  const { glowAt } = useStage();
  return (
    <View
      testID="screen.welcome"
      style={[StyleSheet.absoluteFill, { backgroundColor: STAGE.bg, paddingTop: insets.top, paddingBottom: insets.bottom, zIndex: 50 }]}
    >
      <Glow at={glowAt} />
      {step === "opening" ? (
        <Credit onDone={() => setStep("hello")} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
            {step === "hello" && <Hello onNext={() => setStep("connect")} />}
            {step === "connect" && (
              <Connect
                onNext={() => {
                  // Microsoft's session in the sign-in pages goes now, as on the desktop.
                  void bridge.invoke("auth.signInDone", {}).catch(() => undefined);
                  setStep("reading");
                }}
              />
            )}
            {step === "reading" && <Reading onDone={onDone} />}
          </ScrollView>
          <View style={{ position: "absolute", top: insets.top + space[2], right: space[4] }}>
            <LanguageSwitch />
          </View>
          <StepDots step={step} />
        </>
      )}
    </View>
  );
}

/** One light behind the mark. */
function Glow({ at }: { at: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy={`${Math.round(at * 100)}%`} rx="70%" ry="40%">
          <Stop offset="0" stopColor="#2f6feb" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#2f6feb" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

/** Which of the three steps this is, as on the desktop: the current one a short bar. */
function StepDots({ step }: { step: Exclude<Step, "opening"> }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + space[4], flexDirection: "row", justifyContent: "center", gap: space[1.5] }}
    >
      {(["hello", "connect", "reading"] as const).map((one) => (
        <View
          key={one}
          style={{
            height: 6,
            width: one === step ? 20 : 6,
            borderRadius: 3,
            backgroundColor: one === step ? "rgba(242,242,245,0.85)" : "rgba(242,242,245,0.25)",
          }}
        />
      ))}
    </View>
  );
}

function useFadeIn(delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [value, delay]);
  return { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
}

/** "dari MAHASISWA ITB", the little word turning to "untuk". A tap skips it. */
function Credit({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [turned, setTurned] = useState(false);
  const fade = useFadeIn(150);
  useEffect(() => {
    const turn = setTimeout(() => setTurned(true), CREDIT.turn);
    const done = setTimeout(onDone, CREDIT.done);
    return () => {
      clearTimeout(turn);
      clearTimeout(done);
    };
  }, [onDone]);
  return (
    <Pressable style={styles.center} onPress={onDone} accessibilityRole="button" accessibilityLabel={t("welcome.start")}>
      <Animated.View style={[{ flexDirection: "row", alignItems: "baseline", gap: 8 }, fade]}>
        <Text size="lead" style={{ color: STAGE.faint, fontStyle: "italic", fontFamily: "serif" }}>
          {turned ? t("welcome.credit.for") : t("welcome.credit.from")}
        </Text>
        <Text size="small" style={{ color: STAGE.fg, letterSpacing: 3, fontFamily: "serif" }}>
          {t("welcome.credit.who")}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function Mark() {
  return <Image source={require("../../assets/icon.png")} style={{ width: MARK, height: MARK }} accessibilityIgnoresInvertColors />;
}

/** The mark, the promise and "Mulai" right under it, as on the desktop. */
function Hello({ onNext }: { onNext: () => void }) {
  const t = useT();
  const { markTop } = useStage();
  const mark = useFadeIn(0);
  const words = useFadeIn(250);
  const button = useFadeIn(500);
  return (
    <View style={styles.page}>
      <View style={{ height: markTop }} />
      <Animated.View style={[{ alignItems: "center" }, mark]}>
        <Mark />
      </Animated.View>
      <Animated.View style={[{ marginTop: space[10] + space[6], alignItems: "center" }, words]}>
        <Text size="display" weight="bold" style={styles.headline}>
          {t("welcome.headline1")}
        </Text>
        <Text size="display" weight="bold" style={styles.headline}>
          {t("welcome.headline2")}
        </Text>
        <Text size="lead" style={{ color: STAGE.muted, textAlign: "center", marginTop: space[4], maxWidth: 340 }}>
          {t("welcome.pitch")}
        </Text>
      </Animated.View>
      <Animated.View style={[{ marginTop: space[8] }, button]}>
        <Pill label={t("welcome.start")} onPress={onNext} testID="action.start" />
      </Animated.View>
    </View>
  );
}

/**
 * Indonesia or English, in the stage's corner on every step as on the desktop. The phone's language
 * picked it at first; Settings has it later.
 */
function LanguageSwitch() {
  const t = useT();
  const bridge = useBridge();
  const { lang } = useSettings();
  const options = [
    { value: "id", label: "Indonesia" },
    { value: "en", label: "English" },
  ] as const;
  return (
    <View
      testID="action.welcomeLanguage"
      accessibilityRole="radiogroup"
      accessibilityLabel={t("settings.language")}
      style={{ flexDirection: "row", gap: 2, padding: 3, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.06)" }}
    >
      {options.map((option) => {
        const on = option.value === lang;
        return (
          <Pressable
            key={option.value}
            testID={`action.welcomeLanguage.${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => void bridge.invoke("settings.update", { lang: option.value }).catch(() => undefined)}
            // 36 dp drawn, 48 dp to touch.
            hitSlop={{ top: 6, bottom: 6 }}
            style={{
              minHeight: 36,
              justifyContent: "center",
              paddingHorizontal: space[3],
              borderRadius: radius.full,
              backgroundColor: on ? "rgba(255,255,255,0.14)" : "transparent",
            }}
          >
            <Text size="small" weight={on ? "semibold" : "medium"} style={{ color: on ? STAGE.fg : STAGE.muted }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Edunex and SIX either side of the app, each linking to it as it connects; one big button that connects the next one, then "Lanjut". */
function Connect({ onNext }: { onNext: () => void }) {
  const t = useT();
  const { markTop } = useStage();
  const tile = tileWidth(useWindowDimensions().width);
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const edunex = isConnected(useStatus("edunex").state);
  const six = isConnected(useStatus("six").state);
  const signIns = { edunex: useSignIn(), six: useSignIn() };
  const steps = { edunex: useSignInStep("edunex"), six: useSignInStep("six") };
  const [sixAsked, setSixAsked] = useState(false);
  const fade = useFadeIn(0);
  const both = edunex && six;
  const connected = edunex || six;
  const isIn = { edunex, six };
  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const waiting = (["edunex", "six"] as const).some((source) => signIns[source].busy && !isIn[source]);
  const offer = !edunex ? "edunex" : !six ? "six" : null;
  const joining = offer !== null && connected && steps[offer] === "joining";
  const title = connected ? (name ? t("welcome.connectedTitle", { name }) : t("welcome.connectedTitlePlain")) : t("welcome.connectTitle");
  const lead = both
    ? t(sixAsked ? "welcome.bothConnected" : "welcome.sixCameAlong")
    : connected && !joining
      ? t(edunex ? "welcome.sixLater" : "welcome.edunexLater")
      : t("welcome.connectLead");
  const connect = (source: "edunex" | "six") => {
    if (source === "six") setSixAsked(true);
    void signIns[source].signIn(source);
  };
  return (
    // "Connected", for the flows: both in, with who it is (Edunex's account, SIX's program), as the desktop pictures it.
    <Animated.View style={[styles.page, fade]} testID={both && account && student ? "screen.welcome.connected" : undefined}>
      <View style={{ height: markTop }} />
      {/* Lined up on the mark, so it stays where the step before had it whatever the systems' lines say. */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginHorizontal: -space[1] }}>
        <SourceTile source="edunex" width={tile} who={account ? [displayName(account.name), account.nim] : null} />
        <Link on={edunex} side="left" tile={tile} />
        <Mark />
        <Link on={six} side="right" tile={tile} />
        {/* Before anything is in, SIX can be connected first (the big button is Edunex's). Its name is Edunex's,
            already said on the left: SIX says the program. */}
        <SourceTile
          source="six"
          width={tile}
          who={student ? [student.program ?? student.nim] : null}
          busy={waiting}
          onConnect={connected ? undefined : () => connect("six")}
        />
      </View>
      <Text size="display" weight="bold" style={[styles.headline, { marginTop: space[8] }]}>
        {title}
      </Text>
      <Text size="lead" style={{ color: STAGE.muted, textAlign: "center", marginTop: space[3], minHeight: 46 }}>
        {lead}
      </Text>
      <View style={{ marginTop: space[6], gap: space[2] }}>
        {offer ? (
          <Pill
            label={
              waiting
                ? t("welcome.waitingShort")
                : joining
                  ? t("welcome.bringingAlong", { source: t(`source.${offer}`) })
                  : t("welcome.connectSource", { source: t(`source.${offer}`) })
            }
            busy={waiting || joining}
            onPress={() => connect(offer)}
            testID={`action.connect.${offer}`}
          />
        ) : (
          <Pill label={t("welcome.continue")} onPress={onNext} testID="action.continue" />
        )}
        {waiting && (
          <Text size="small" style={{ color: STAGE.faint, textAlign: "center" }}>
            {t("mobile.welcome.waitingHint")}
          </Text>
        )}
        {connected && offer && (
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            style={{ alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: space[4] }}
            testID="action.skip"
          >
            <Text size="body" weight="medium" style={{ color: STAGE.muted }}>
              {t("welcome.skipSource", { source: t(`source.${offer}`) })}
            </Text>
          </Pressable>
        )}
      </View>
      <Text size="caption" style={{ color: STAGE.faint, textAlign: "center", marginTop: space[4] }}>
        {t("welcome.readOnly")}
      </Text>
    </Animated.View>
  );
}

/** A hairline from a system to the app: dashed while apart, drawn solid from the system's side when it connects. */
function Link({ on, side, tile }: { on: boolean; side: "left" | "right"; tile: number }) {
  // From the logo's edge (the tile's sides beside it are empty at this height) to the mark's.
  const over = (tile - LOGO) / 2;
  const drawn = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(drawn, { toValue: on ? 1 : 0, duration: 700, useNativeDriver: true }).start();
  }, [on, drawn]);
  return (
    // Level with the middle of the mark and of the logos beside it.
    <View
      style={{
        flex: 1,
        minWidth: space[4],
        height: 2,
        marginTop: MARK / 2 - 1,
        marginLeft: side === "left" ? space[1] - over : space[1],
        marginRight: side === "right" ? space[1] - over : space[1],
      }}
    >
      <Svg width="100%" height={2} style={StyleSheet.absoluteFill}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3 4" />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 1, backgroundColor: STAGE.link, transformOrigin: side === "left" ? "0% 50%" : "100% 50%", transform: [{ scaleX: drawn }] },
        ]}
      />
    </View>
  );
}

/** One system: its logo (a check once connected), its name, and where its sign-in stands or who is signed in. */
function SourceTile({
  source,
  width,
  who,
  busy = false,
  onConnect,
}: {
  source: "edunex" | "six";
  /** The column's width (tileWidth). */
  width: number;
  /** Who is signed in, a line each: Edunex's name and NIM, SIX's program. */
  who: readonly string[] | null;
  /** Connect's sign-in is under way. */
  busy?: boolean;
  /** Connects it here, when the big button is the other system's. */
  onConnect?: () => void;
}) {
  const t = useT();
  const status = useStatus(source);
  const note = useSignInNote(source);
  const name = t(`source.${source}`);
  const connected = isConnected(status.state);
  // The desktop's welcome: who once in, then the sign-in's own note while it finishes out of sight.
  let lines: readonly string[] = [t("welcome.notConnected")];
  let color = STAGE.faint;
  let hint: string | null = null;
  if (connected && who) {
    lines = who;
    color = STAGE.muted;
  } else if (connected) {
    lines = [t("welcome.readingName")];
    color = STAGE.muted;
  } else if (status.state === "connecting") {
    lines = [t("status.connecting")];
  } else if (note) {
    lines = [note.text];
    hint = note.hint;
    if (note.slow) color = STAGE.warning;
  }
  const logo = (
    <View style={{ marginTop: (MARK - LOGO) / 2 }}>
      <SourceLogo source={source} size={LOGO} />
      {connected && (
        <View
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: STAGE.live,
            borderWidth: 2,
            borderColor: STAGE.bg,
          }}
        >
          <Icons.Check size={11} color="#ffffff" weight="bold" />
        </View>
      )}
    </View>
  );
  return (
    <View style={{ width, alignItems: "center" }} testID={`welcome.${source}`}>
      {onConnect ? (
        <Pressable
          onPress={busy ? undefined : onConnect}
          accessibilityRole="button"
          accessibilityLabel={t("welcome.connectSource", { source: name })}
          accessibilityState={{ busy }}
        >
          {logo}
        </Pressable>
      ) : (
        logo
      )}
      <Text size="body" weight="semibold" style={{ color: STAGE.fg, marginTop: space[3] }}>
        {name}
      </Text>
      {lines.map((line) => (
        <Text key={line} size="small" style={{ color, textAlign: "center" }} numberOfLines={2}>
          {line}
        </Text>
      ))}
      {hint && (
        <Text size="caption" style={{ color: STAGE.faint, textAlign: "center", marginTop: space[1] }}>
          {hint}
        </Text>
      )}
      {/* While a sign-in runs the link waits out of sight (greyed, it read as broken), its room kept so nothing jumps. */}
      {onConnect && busy && <View style={{ minHeight: 48 }} />}
      {onConnect && !busy && (
        <Pressable
          onPress={onConnect}
          accessibilityRole="button"
          testID={`action.connectLine.${source}`}
          style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: space[3] }}
        >
          <Text size="small" weight="semibold" style={{ color: "#7aa2ff" }}>
            {t("welcome.connect")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Reading the semester: the Student's Beranda filling in, the counts as they come in, then "Buka Edunex Plus". */
function Reading({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { room } = useStage();
  const screen = useWindowDimensions();
  const saved = useSaved(READ);
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const itb = useStatus("itb");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const statuses = useMemo(() => [edunex, six, itb], [edunex, six, itb]);
  const ready = homeReady(saved, statuses);
  const summary = scanSummary(saved, statuses);
  const read = firstRead(saved, statuses);
  const [patience, setPatience] = useState(false);
  const fade = useFadeIn(0);
  useEffect(() => {
    const timer = setTimeout(() => setPatience(true), READ_PATIENCE);
    return () => clearTimeout(timer);
  }, []);
  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const title = ready ? (name ? t("welcome.readyTitle", { name }) : t("welcome.readyTitlePlain")) : t("welcome.readingTitle");
  const counts = [
    { key: "courses", count: summary.courses },
    { key: "tasks", count: summary.tasks },
    { key: "meetings", count: summary.meetings },
  ] as const;
  const part = read.next;
  // The window onto Beranda: a phone's screen scaled down, its top part, leaving the words below room.
  const width = Math.round(Math.min(screen.width * 0.62, 280));
  const height = Math.round(Math.min(room * 0.46, (width * screen.height) / screen.width));
  const open = async () => {
    // Android asks once; the reminders on the phone are why the app is here.
    await Notifications.requestPermissionsAsync().catch(() => undefined);
    onDone();
  };
  return (
    <Animated.View style={[styles.page, fade]} testID={ready ? "screen.welcome.ready" : undefined}>
      <Glimpse width={width} height={height} progress={ready ? 1 : read.progress} />
      <Text size="display" weight="bold" style={[styles.headline, { marginTop: space[6] }]} accessibilityLiveRegion="polite">
        {title}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: space[6], marginTop: space[4] }}>
        {counts.map((one) => (
          // Read out as one: "5 mata kuliah", as the desktop writes it.
          <View
            key={one.key}
            style={{ alignItems: "center" }}
            accessible
            accessibilityLabel={`${one.count} ${t(`welcome.count.${one.key}`, { count: one.count })}`}
          >
            <Text size="figure" weight="semibold" tabular style={{ color: STAGE.fg }}>
              {String(one.count)}
            </Text>
            <Text size="small" style={{ color: STAGE.muted }}>
              {t(`welcome.count.${one.key}`, { count: one.count })}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], marginTop: space[4], minHeight: 20 }}>
        {ready ? (
          <>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STAGE.live }} />
            <Text size="small" style={{ color: STAGE.muted }}>
              {t("welcome.readingDone")}
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={STAGE.faint} />
            <Text size="small" style={{ color: STAGE.faint }}>
              {part ? `${t(`source.${part.source}`)} · ${t(`scan.part.${part.part}`)}` : t("welcome.readingWait")}
            </Text>
          </>
        )}
      </View>
      {/* Its place is kept from the start, so nothing above moves when it comes. */}
      <View style={{ minHeight: 96, gap: space[3], marginTop: space[6] }}>
        {(ready || patience) && (
          <>
            <Pill label={t("welcome.open")} onPress={() => void open()} testID="action.open" />
            <Text size="small" style={{ color: STAGE.faint, textAlign: "center" }}>
              {t("mobile.welcome.notify")}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * The Student's own Beranda (src/screens/home), a phone's width scaled down into a small window that
 * can't be touched or read out: it fills in as the data arrives, and comes up from dim as more is read.
 * It runs nothing of its own; the data it shows is what the reading puts in.
 */
function Glimpse({ width, height, progress }: { width: number; height: number; progress: number }) {
  const theme = useTheme();
  const screen = useWindowDimensions();
  const scale = width / screen.width;
  const shown = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: progress, duration: 600, useNativeDriver: true }).start();
  }, [progress, shown]);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: "center",
        width,
        height,
        borderRadius: radius.xxl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: theme.color.canvas,
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: shown.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: screen.width,
            height: height / scale,
            paddingHorizontal: space.page,
            paddingTop: space[6],
            backgroundColor: theme.color.canvas,
            transformOrigin: "0% 0%",
            transform: [{ scale }],
          }}
        >
          <Home />
        </View>
      </Animated.View>
    </View>
  );
}

/** The welcome's own button: big, round, the app's blue. */
function Pill({ label, onPress, busy = false, testID }: { label: string; onPress: () => void; busy?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      onPress={busy ? undefined : onPress}
      android_ripple={{ color: "rgba(255,255,255,0.2)", foreground: true }}
      style={({ pressed }) => [styles.pill, { opacity: busy ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      {busy && <ActivityIndicator size="small" color="#ffffff" />}
      <Text size="body" weight="semibold" style={{ color: "#ffffff" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: TOP_BAR, paddingBottom: DOTS },
  page: { flexGrow: 1, paddingHorizontal: space[5] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headline: { color: STAGE.fg, textAlign: "center", letterSpacing: -0.5 },
  pill: {
    height: 54,
    borderRadius: radius.full,
    backgroundColor: STAGE.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    overflow: "hidden",
  },
});
