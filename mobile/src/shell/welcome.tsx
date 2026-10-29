// The first run on the phone (and after signing out of everything): the desktop's welcome
// (src/app/shell/welcome.tsx) told the same way on a phone's dark stage. A credit, the promise, then
// connecting Edunex and SIX on ITB's own pages (one Microsoft sign-in, the other system comes along by
// itself when it can), then reading the semester until Beranda has what it shows
// (src/core/first-scan.ts homeReady). "Buka Edunex Plus" asks for notifications first, saying why.
// The desktop's light and sound stay on the desktop: a soft glow behind the mark is enough here.
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useT } from "../../../src/app/i18n";
import { displayName, firstName } from "../../../src/app/names";
import { useSaved } from "../../../src/app/saved";
import { useBridge, useDataset, useSignInStep, useStatus } from "../../../src/app/store";
import { firstRead, homeReady, scanSummary } from "../../../src/core/first-scan";
import type { DatasetName } from "../../../src/core/models";
import { Text } from "../ui/text";
import { radius, space } from "../ui/theme";
import { useSignIn } from "./source-status";

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
const STAGE = { bg: "#04050a", fg: "#f2f2f5", muted: "#a5a7b3", faint: "#7c7e8a", accent: "#2f6feb", live: "#2fbf6c", line: "rgba(255,255,255,0.12)" };

const isConnected = (state: string) => state !== "signed-out" && state !== "expired";

type Step = "opening" | "hello" | "connect" | "reading";

export function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("opening");
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="screen.welcome"
      style={[StyleSheet.absoluteFill, { backgroundColor: STAGE.bg, paddingTop: insets.top, paddingBottom: insets.bottom, zIndex: 50 }]}
    >
      <Glow />
      {step === "opening" && <Credit onDone={() => setStep("hello")} />}
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
    </View>
  );
}

/** One light behind the mark, from the top of the stage. */
function Glow() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="30%" rx="70%" ry="45%">
          <Stop offset="0" stopColor="#2f6feb" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#2f6feb" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
    </Svg>
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

function Mark({ size }: { size: number }) {
  return <Image source={require("../../assets/icon.png")} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}

/** The mark, the promise and "Mulai" at the bottom, within reach of a thumb. */
function Hello({ onNext }: { onNext: () => void }) {
  const t = useT();
  const mark = useFadeIn(0);
  const words = useFadeIn(250);
  const button = useFadeIn(500);
  return (
    <View style={styles.page}>
      <View style={styles.center}>
        <Animated.View style={mark}>
          <Mark size={96} />
        </Animated.View>
        <Animated.View style={[{ marginTop: space[8], alignItems: "center" }, words]}>
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
      </View>
      <Animated.View style={button}>
        <Pill label={t("welcome.start")} onPress={onNext} testID="action.start" />
      </Animated.View>
    </View>
  );
}

/** Edunex and SIX, each with its state; one big button that connects the next one, then "Lanjut". */
function Connect({ onNext }: { onNext: () => void }) {
  const t = useT();
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
      <View style={[styles.center, { alignItems: "stretch" }]}>
        <View style={{ alignItems: "center" }}>
          <Mark size={64} />
        </View>
        <Text size="heading" weight="bold" style={[styles.headline, { marginTop: space[6] }]}>
          {title}
        </Text>
        <Text size="lead" style={{ color: STAGE.muted, textAlign: "center", marginTop: space[3], minHeight: 46 }}>
          {lead}
        </Text>
        <View style={[styles.sources, { marginTop: space[6] }]}>
          <SourceLine
            source="edunex"
            on={edunex}
            who={account ? `${displayName(account.name)} · ${account.nim}` : null}
            busy={(signIns.edunex.busy && !edunex) || (steps.edunex !== null && !edunex)}
          />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: STAGE.line }} />
          <SourceLine
            source="six"
            on={six}
            who={student ? (student.program ?? student.nim) : null}
            busy={(signIns.six.busy && !six) || (steps.six !== null && !six)}
            onConnect={!connected ? () => connect("six") : undefined}
          />
        </View>
        <Text size="caption" style={{ color: STAGE.faint, textAlign: "center", marginTop: space[4] }}>
          {t("welcome.readOnly")}
        </Text>
      </View>
      <View style={{ gap: space[3] }}>
        {waiting && (
          <Text size="small" style={{ color: STAGE.faint, textAlign: "center" }}>
            {t("mobile.welcome.waitingHint")}
          </Text>
        )}
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
        {connected && offer && (
          <Pressable onPress={onNext} accessibilityRole="button" style={{ alignSelf: "center", padding: space[3] }} testID="action.skip">
            <Text size="body" weight="medium" style={{ color: STAGE.muted }}>
              {t("welcome.skipSource", { source: t(`source.${offer}`) })}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function SourceLine({
  source,
  on,
  who,
  busy,
  onConnect,
}: {
  source: "edunex" | "six";
  on: boolean;
  who: string | null;
  busy: boolean;
  onConnect?: () => void;
}) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] }} testID={`welcome.${source}`}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: on ? STAGE.live : "transparent",
          borderWidth: on ? 0 : 1.5,
          borderColor: STAGE.faint,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text size="body" weight="semibold" style={{ color: STAGE.fg }}>
          {t(`source.${source}`)}
        </Text>
        <Text size="small" style={{ color: on ? STAGE.muted : STAGE.faint }} numberOfLines={1}>
          {on ? (who ?? t("welcome.connected")) : t("welcome.notConnected")}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={STAGE.muted} />
      ) : onConnect ? (
        <Pressable onPress={onConnect} accessibilityRole="button" hitSlop={8} testID={`action.connectLine.${source}`}>
          <Text size="small" weight="semibold" style={{ color: "#7aa2ff" }}>
            {t("welcome.connect")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Reading the semester: the counts as they come in, then "Buka Edunex Plus". */
function Reading({ onDone }: { onDone: () => void }) {
  const t = useT();
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
  const open = async () => {
    // Android asks once; the reminders on the phone are why the app is here.
    await Notifications.requestPermissionsAsync().catch(() => undefined);
    onDone();
  };
  return (
    <Animated.View style={[styles.page, fade]} testID={ready ? "screen.welcome.ready" : undefined}>
      <View style={styles.center}>
        <Mark size={72} />
        <Text size="heading" weight="bold" style={[styles.headline, { marginTop: space[8] }]} accessibilityLiveRegion="polite">
          {title}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: space[6], marginTop: space[6] }}>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[5], minHeight: 20 }}>
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
      </View>
      <View style={{ minHeight: 96, gap: space[3] }}>
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
  page: { flex: 1, paddingHorizontal: space[6], paddingBottom: space[6], justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headline: { color: STAGE.fg, textAlign: "center", letterSpacing: -0.5 },
  sources: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STAGE.line,
    paddingHorizontal: space[4],
    backgroundColor: "rgba(255,255,255,0.03)",
  },
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
