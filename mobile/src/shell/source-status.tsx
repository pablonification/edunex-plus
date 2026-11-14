// Where each system stands, on the phone: the desktop's src/app/shell/source-status.tsx, its hooks
// copied as they are (that file draws DOM too), its status line and panel as the tab header's quiet
// line and a sheet, its banner as a card under the header. Pull to refresh is "Perbarui sekarang".

import { router } from "expo-router";
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { type Bridge, errorKey } from "../../../src/app/bridge";
import { useFormat, useNow, useT } from "../../../src/app/i18n";
import { useSaved } from "../../../src/app/saved";
import { useBridge, useDataset, useSettings, useSignInStep, useStatus } from "../../../src/app/store";
import type { SignInStep } from "../../../src/core/contract";
import { firstRead } from "../../../src/core/first-scan";
import type { DatasetName, SourceId, SourceState, SourceStatus } from "../../../src/core/models";
import { handInDays, isHandInMove } from "../../../src/core/schedule";
import { useSettling } from "../host/settling";
import { ReportButton } from "../parts/report";
import { useReadStatuses } from "../screens/first-scan/scan";
import { toast } from "../swaps/overlays";
import { SourceLogo } from "../ui/brand";
import { Button, IconButton } from "../ui/controls";
import { EmptyState, LiveDot, Spinner } from "../ui/display";
import { Icons } from "../ui/icons";
import { useTopInset } from "../ui/insets";
import { Meta } from "../ui/layout";
import { Sheet } from "../ui/sheet";
import { slop } from "../ui/sizes";
import { Text } from "../ui/text";
import { radius, space, TOUCH, useTheme } from "../ui/theme";
import { BAR_HEIGHT, BarSurface } from "../ui/top-bar";

/** Data older than this says so under the tab's title. */
const STALE = 60 * 60_000;

/** Opens the sign-in page for a source; resolves when it closes. */
export function useSignIn() {
  const bridge = useBridge();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const signIn = useCallback(
    async (source: SourceId) => {
      setBusy(true);
      try {
        await bridge.invoke("auth.signIn", { source });
      } catch (error) {
        toast(t(errorKey(error, "welcome.signInFailed")), "danger");
      } finally {
        setBusy(false);
      }
    },
    [bridge, t],
  );
  return { signIn, busy };
}

/**
 * Signs out of everything, for an account that isn't a student's: a sign-out of one system keeps Microsoft's sign-in, so
 * signing in again would come straight back as the same account. Nothing of a Student's is lost: none was read.
 */
function useSignOut() {
  const bridge = useBridge();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await bridge.invoke("auth.signOut", {});
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    } finally {
      setBusy(false);
    }
  }, [bridge, t]);
  return { signOut, busy };
}

/** What a sign-in says while the Student has nothing to do in it: joining, finishing out of sight, or slow. */
export function useSignInNote(source: SourceId): { step: SignInStep; text: string; hint: string | null; slow: boolean } | null {
  const t = useT();
  const step = useSignInStep(source === "six" ? "six" : "edunex");
  if (source === "itb" || !step) return null;
  const name = t(`source.${source}`);
  if (step === "slow") return { step, text: t("signIn.slow", { source: name }), hint: t("signIn.slowHint"), slow: true };
  return { step, text: t(step === "joining" ? "signIn.joining" : "signIn.finishing", { source: name }), hint: null, slow: false };
}

// The sources a refresh is reading right now, whoever asked (pull to refresh, the panel, "Coba lagi").
const reading = new Map<SourceId, number>();
let readingNow: readonly SourceId[] = [];
const readingWatchers = new Set<() => void>();
const EVERY_SOURCE: readonly SourceId[] = ["edunex", "six", "itb"];

function noteReading(source: SourceId, step: 1 | -1): void {
  const count = (reading.get(source) ?? 0) + step;
  if (count > 0) reading.set(source, count);
  else reading.delete(source);
  readingNow = [...reading.keys()];
  for (const watcher of readingWatchers) watcher();
}

/** Reads sources again now (every source without one), each on its own so the panel can show which is still going. */
export async function refreshNow(bridge: Bridge, source?: SourceId): Promise<void> {
  await Promise.all(
    (source ? [source] : EVERY_SOURCE).map(async (one) => {
      noteReading(one, 1);
      try {
        await bridge.invoke("sync.refresh", { source: one });
      } catch {
        // The source's status already says what went wrong.
      } finally {
        noteReading(one, -1);
      }
    }),
  );
}

export function useReading(): readonly SourceId[] {
  return useSyncExternalStore(
    (watcher) => {
      readingWatchers.add(watcher);
      return () => void readingWatchers.delete(watcher);
    },
    () => readingNow,
  );
}

/** `busy` while a source this one asked for is still being read. */
export function useRefresh() {
  const bridge = useBridge();
  const now = useReading();
  const [asked, setAsked] = useState<readonly SourceId[]>([]);
  const refresh = useCallback(
    async (source?: SourceId) => {
      setAsked(source ? [source] : EVERY_SOURCE);
      try {
        await refreshNow(bridge, source);
      } finally {
        setAsked([]);
      }
    },
    [bridge],
  );
  return { refresh, busy: asked.some((source) => now.includes(source)) };
}

/** Pull to refresh for a page: every source, the spinner while the pull's own read runs. */
export function usePullToRefresh(): { onRefresh: () => void; refreshing: boolean } {
  const { refresh, busy } = useRefresh();
  const [pulled, setPulled] = useState(false);
  return {
    onRefresh: () => {
      setPulled(true);
      void refresh().finally(() => setPulled(false));
    },
    refreshing: pulled && busy,
  };
}

function overall(states: SourceState[]): "changed" | "expired" | "offline" | "connecting" | "live" | "signed-out" {
  for (const state of ["changed", "expired", "offline", "connecting", "live"] as const) if (states.includes(state)) return state;
  return "signed-out";
}

/** The status line's state and words, as the desktop's top bar says them. */
function useSyncLine() {
  const t = useT();
  const f = useFormat();
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const now = useReading();
  const signedIn = [edunex, six].filter((status) => status.state !== "signed-out");
  const going = signedIn.filter((status) => now.includes(status.source));
  const worst = overall(signedIn.map((status) => status.state));
  const state = going.length > 0 && (worst === "live" || worst === "signed-out") ? "connecting" : worst;
  const troubled = signedIn.find((status) => status.state === state && (state === "changed" || state === "expired"));
  const unreachable = signedIn.filter((status) => status.state === "offline");
  const updatedAt = Math.max(0, ...signedIn.map((status) => status.updatedAt ?? 0)) || null;
  let text: string;
  if (state === "connecting")
    text = going.length === 1 && signedIn.length > 1 ? t("sync.checkingOne", { source: t(`source.${going[0]!.source}`) }) : t("sync.checking");
  else if (troubled)
    text =
      state === "expired" ? t("sync.expired", { source: t(`source.${troubled.source}`) }) : t("status.changed", { source: t(`source.${troubled.source}`) });
  else if (state === "offline")
    text = unreachable.length < signedIn.length ? t("sync.offlineOne", { source: t(`source.${unreachable[0]!.source}`) }) : t("status.offline");
  else text = updatedAt ? t("status.updated", { when: f.fromNow(updatedAt) }) : t("status.neverUpdated");
  return { state, text, signedIn: signedIn.length > 0, busy: now.length > 0, updatedAt };
}

function StateMark({ state, busy }: { state: SourceState; busy: boolean }) {
  const theme = useTheme();
  if (busy || state === "connecting") return <Spinner size={14} color={theme.color.muted} />;
  if (state === "live") return <LiveDot />;
  if (state === "changed") return <Icons.AlertTriangle size={14} color={theme.color.dangerFg} weight="bold" />;
  if (state === "expired") return <Icons.Lock size={14} color={theme.color.warningFg} weight="bold" />;
  if (state === "offline") return <Icons.WifiOff size={14} color={theme.color.muted} />;
  return <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: theme.color.faint }} />;
}

/**
 * A tab's top bar (Material 3's small top app bar), the same on all five tabs (round 3): the tab's name with the data's
 * status as one quiet line under it (tap: each source and "Perbarui sekarang"), then the tab's own one or two actions
 * (`actions`: an icon button, ⋮), then the three every tab ends with, in the same places (`TabActions`): Search and the
 * bell (the Student, the account and Settings are the Profil tab). Just the bar: no big title under it to collapse. A banner follows when
 * something needs the Student. `v4`: on round 2's v4 page (DESIGN.md "v4"): the bar in the page's grey, the tab's name
 * in Plus Jakarta Sans.
 */
export function TabHeader({ title, actions, v4 = false }: { title: string; actions?: ReactNode; v4?: boolean }) {
  const t = useT();
  const top = useTopInset();
  const line = useSyncLine();
  const [panel, setPanel] = useState(false);
  return (
    <BarSurface v4={v4}>
      <View style={{ marginTop: top, flexDirection: "row", alignItems: "center", paddingLeft: space.page, paddingRight: space[1], minHeight: BAR_HEIGHT }}>
        <Pressable
          testID="action.syncStatus"
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${t("sync.title")}: ${line.text}`}
          onPress={() => setPanel(true)}
          style={{ flex: 1, minWidth: 0, minHeight: TOUCH, justifyContent: "center" }}
        >
          {/* Every tab's name in the one size and face, as Beranda's greeting and every screen's bar title. */}
          <Text
            size="titleLarge"
            numberOfLines={1}
            accessibilityRole="header"
            {...(v4 ? ({ face: "display", weight: "bold", style: { letterSpacing: -0.3 } } as const) : {})}
          >
            {title}
          </Text>
          <StatusLine />
        </Pressable>
        {actions}
        <TabActions />
      </View>
      <ProblemBanner />
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </BarSurface>
  );
}

/**
 * What every tab's bar ends with, in this order: Search, the bell (a dot while something new is unread). The account
 * and Settings are the Profil tab's. `color`: on a coloured bar (Beranda's blue), the icons' colour and the dot's (`dot`).
 */
export function TabActions({ color, dot }: { color?: string; dot?: string }) {
  const t = useT();
  const theme = useTheme();
  const ink = color ?? theme.color.onSurfaceVariant;
  return (
    <>
      <IconButton label={t("search.open")} onPress={() => router.push("/search")} testID="action.search">
        <Icons.Search size={24} color={ink} />
      </IconButton>
      <Bell color={ink} dot={dot ?? theme.color.error} />
    </>
  );
}

/** The sources' state in words, for a title's spoken name ("Beranda. Data: Diperbarui 2 menit yang lalu"). */
export function useSyncText(): string {
  return useSyncLine().text;
}

/**
 * The data's status under a screen's title, only when it says something to act on (one title per screen, no
 * "Diperbarui baru saja"): a problem, offline, the first read, the demo still reading, or data older than an hour.
 * `color`: on a coloured header (Beranda's blue), every word and mark in it.
 */
export function StatusLine({ color }: { color?: string }) {
  const line = useSyncLine();
  // The first read after signing in: which part it's reading, until Beranda has what it shows (W15). Once it's in,
  // nothing until there's something to act on: no "Diperbarui baru saja" beside the "Semua siap" card.
  const firstReading = useFirstReadRunning() && line.signedIn;
  const now = useNow();
  const stale = line.updatedAt !== null && now - line.updatedAt > STALE;
  const settling = useSettling();
  // Something to act on: a problem, offline, never read, or older than an hour. Never "Diperbarui baru saja".
  const worth = line.state === "changed" || line.state === "expired" || line.state === "offline" || (line.signedIn && (line.updatedAt === null || stale));
  if (!settling && !firstReading && !worth) return null;
  const tone = line.state === "changed" ? "danger" : line.state === "expired" ? "warning" : "muted";
  const status = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}>
      {color ? (
        line.state === "connecting" ? (
          <Spinner size={14} color={color} />
        ) : null
      ) : (
        <StateMark state={line.state === "signed-out" ? "signed-out" : line.state} busy={line.state === "connecting"} />
      )}
      <Text size="bodySmall" tone={tone} numberOfLines={1} style={[{ flexShrink: 1 }, color ? { color } : null]}>
        {line.text}
      </Text>
    </View>
  );
  if (settling)
    return (
      <View testID="status.settling">
        <FirstReadLine always color={color}>
          {status}
        </FirstReadLine>
      </View>
    );
  // The first read with no part left to name (one that can't be read, a source not signed in): the status only when
  // it's worth saying, never a fresh "Diperbarui baru saja" (the real phone showed it under Beranda's greeting).
  return firstReading ? <FirstReadLine color={color}>{worth ? status : null}</FirstReadLine> : status;
}

const FIRST_READ: readonly DatasetName[] = [
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

/**
 * Whether the Student's first read is still running (what "Membaca …" says): the first scan not seen yet, and not
 * everything it reads in. Beranda's two cards hold their shape meanwhile, picked from half the data they swapped.
 */
export function useFirstReadRunning(): boolean {
  const done = useSettings().firstScanDone;
  const saved = useSaved(FIRST_READ);
  const statuses = useReadStatuses();
  return !done && firstRead(saved, statuses).progress < 1;
}

/** "Membaca Edunex · Tugas…" while the first read runs, a calm line with a spinner; once in, the usual line. */
function FirstReadLine({ children, always = false, color }: { children: ReactNode; always?: boolean; color?: string }) {
  const t = useT();
  const theme = useTheme();
  const saved = useSaved(FIRST_READ);
  const read = firstRead(saved, useReadStatuses());
  const part = read.progress < 1 ? read.next : null;
  if (!part && !always) return children;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }} testID="status.firstRead">
      <Spinner size={14} color={color ?? theme.color.onSurfaceVariant} />
      <Text size="bodySmall" tone="muted" numberOfLines={1} style={[{ flexShrink: 1 }, color ? { color } : null]} accessibilityLiveRegion="polite">
        {part ? t("mobile.home.reading", { part: `${t(`source.${part.source}`)} · ${t(`scan.part.${part.part}`)}` }) : t("welcome.readingWait")}
      </Text>
    </View>
  );
}

/**
 * How many alerts came since the Student last marked them read ("Tandai semua dibaca"): the rows Notifikasi dots, so
 * the bell and the list say the same. One the list never shows (SIX's copy of a Task's hand-in window "moving") isn't
 * counted either.
 */
export function useUnreadAlerts(): number {
  const history = useDataset("app.alerts");
  const presence = useDataset("edunex.presence");
  return useMemo(() => {
    const unread = (history?.items ?? []).filter((item) => item.at > (history?.readAt ?? 0));
    if (!unread.some((item) => item.kind === "scheduleChanged")) return unread.length;
    const handIn = handInDays(presence);
    return unread.filter((item) => !isHandInMove(item, handIn)).length;
  }, [history, presence]);
}

/** The bell, with a small calm dot while something new is unread (how many is said to TalkBack and on the list). */
function Bell({ color, dot }: { color: string; dot: string }) {
  const t = useT();
  const unread = useUnreadAlerts();
  return (
    <View>
      <IconButton label={unread > 0 ? t("alerts.open", { count: unread }) : t("alerts.title")} onPress={() => router.push("/alerts")} testID="action.alerts">
        <Icons.Bell size={24} color={color} />
      </IconButton>
      {unread > 0 && (
        <View
          pointerEvents="none"
          testID="badge.alerts"
          style={{ position: "absolute", top: 12, right: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: dot }}
        />
      )}
    </View>
  );
}

export function SyncPanel({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const bridge = useBridge();
  const line = useSyncLine();
  return (
    <Sheet open={open} onClose={onClose} title={t("sync.title")} testID="sheet.sync">
      {(["edunex", "six", "itb"] as const).map((source) => (
        <SourceRow key={source} source={source} onClose={onClose} />
      ))}
      <Button
        style={{ marginTop: space[3], marginBottom: space[2] }}
        busy={line.busy}
        disabled={!line.signedIn}
        icon={<Icons.RefreshCw size={16} />}
        onPress={() => void refreshNow(bridge)}
        testID="action.refreshNow"
      >
        {line.busy ? t("sync.checking") : t("sync.refreshNow")}
      </Button>
    </Sheet>
  );
}

function hintFor({ state, asks }: SourceStatus, source: string, t: ReturnType<typeof useT>): string | null {
  if (state === "action-needed" && asks === "student") return t("status.notStudentHint");
  if (state === "expired") return t("status.expiredHint", { source });
  if (state === "changed") return t("status.changedHint", { source });
  if (state === "offline") return t("status.offlineHint", { source });
  return null;
}

function SourceRow({ source, onClose }: { source: SourceId; onClose(): void }) {
  const t = useT();
  const theme = useTheme();
  const f = useFormat();
  const status = useStatus(source);
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh } = useRefresh();
  const { signOut, busy: signingOut } = useSignOut();
  const refreshing = useReading().includes(source);
  const name = t(`source.${source}`);
  const needsSignIn = source !== "itb" && (status.state === "expired" || status.state === "signed-out");
  const notStudent = status.state === "action-needed" && status.asks === "student";
  const note = useSignInNote(source);
  const hint = needsSignIn && note ? note.text : refreshing ? t("sync.checking") : hintFor(status, name, t);
  const word = status.state === "changed" ? t("status.changedShort") : t(`status.${status.state}`);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] }}>
      {/* The logo says which system; the mark on its corner, how it's doing (the desktop's). */}
      <View>
        <SourceLogo source={source} size={36} />
        <View
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: theme.color.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StateMark state={status.state} busy={refreshing || signingIn} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Meta tone="fg" size="small">
          {name}
          {word}
        </Meta>
        <Text size="small" tone="muted">
          {hint ?? (status.updatedAt ? t("status.updated", { when: f.fromNow(status.updatedAt) }) : t("status.neverUpdated"))}
        </Text>
        {/* The report opens as its own screen: the sheet closes first so it isn't left over it. */}
        {status.state === "changed" && source !== "itb" && (
          <View style={{ marginTop: space[2], flexDirection: "row" }}>
            <ReportButton about={{ source }} onOpen={onClose} />
          </View>
        )}
      </View>
      {needsSignIn ? (
        <Button size="sm" variant={status.state === "expired" ? "primary" : "secondary"} busy={signingIn} onPress={() => void signIn(source)}>
          {status.state === "expired" ? t("action.signInAgain") : t("action.signInTo", { source: name })}
        </Button>
      ) : notStudent ? (
        <Button size="sm" variant="primary" busy={signingOut} onPress={() => void signOut()}>
          {t("action.signOut")}
        </Button>
      ) : status.state === "changed" || status.state === "offline" ? (
        <Button size="sm" busy={refreshing} onPress={() => void refresh(source)}>
          {t("action.tryAgain")}
        </Button>
      ) : null}
    </View>
  );
}

/**
 * Under the header, on every tab and on Nilai and Rencana studi (the desktop shows it on every
 * page): a session that ended, saved data with no session, a change, or no connection. `belowBar`:
 * under a stack screen's top bar, which has a line under it, so the banner keeps a gap from it.
 */
export function ProblemBanner({ belowBar = false }: { belowBar?: boolean }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  const { signOut, busy: signingOut } = useSignOut();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const edunexNote = useSignInNote("edunex");
  const sixNote = useSignInNote("six");
  const has = { edunex: account !== undefined, six: student !== undefined };
  const problem =
    [edunex, six].find((status) => status.state === "changed") ??
    [edunex, six].find((status) => status.state === "expired" || (status.state === "signed-out" && has[status.source as "edunex" | "six"])) ??
    [edunex, six].find((status) => status.state === "action-needed" && status.asks === "student") ??
    ([edunex, six].filter((status) => status.state !== "signed-out").every((status) => status.state === "offline") &&
    [edunex, six].some((status) => status.state === "offline")
      ? [edunex, six].find((status) => status.state === "offline")
      : undefined);
  if (!problem) return null;
  const key = `${problem.source}:${problem.state}`;
  if (dismissed === key) return null;
  const name = t(`source.${problem.source}`);
  const offline = problem.state === "offline";
  const needsSignIn = problem.state === "expired" || problem.state === "signed-out";
  const notStudent = problem.state === "action-needed";
  const lastUpdate = Math.max(0, ...[edunex, six].map((status) => status.updatedAt ?? 0));
  const title = offline
    ? t("banner.offline")
    : problem.state === "expired"
      ? t("banner.expired", { source: name })
      : problem.state === "signed-out"
        ? t("banner.signedOut", { source: name })
        : notStudent
          ? t("banner.notStudent", { source: name })
          : t("banner.changed", { source: name });
  const note = needsSignIn ? (problem.source === "six" ? sixNote : edunexNote) : null;
  const detail = note
    ? note.text
    : offline
      ? lastUpdate
        ? t("banner.offlineHint", { time: f.time(lastUpdate) })
        : null
      : problem.state === "changed"
        ? t("status.changedHint", { source: name })
        : notStudent
          ? t("status.notStudentHint")
          : t("banner.keptHint");
  const [bg, fg] =
    problem.state === "changed"
      ? [theme.color.dangerBg, theme.color.dangerFg]
      : offline
        ? [theme.color.fill, theme.color.fg]
        : [theme.color.warningBg, theme.color.warningFg];
  const Glyph = offline ? Icons.WifiOff : needsSignIn ? Icons.Lock : Icons.AlertTriangle;
  return (
    <View
      testID="banner.problem"
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: space.page,
        marginTop: belowBar ? space[2] : 0,
        marginBottom: space[2],
        borderRadius: radius.xl,
        backgroundColor: bg,
        padding: space[3],
        gap: space[2],
      }}
    >
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 2 }}>
          <Glyph size={16} color={fg} />
        </View>
        <Text size="small" style={{ color: fg, flex: 1 }}>
          <Text size="small" weight="semibold" style={{ color: fg }}>
            {title}
          </Text>
          {detail ? ` ${detail}` : ""}
        </Text>
        {!offline && (
          <Pressable accessibilityRole="button" accessibilityLabel={t("action.close")} onPress={() => setDismissed(key)} hitSlop={slop(16)}>
            <Icons.X size={16} color={fg} />
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {needsSignIn ? (
          <Button size="sm" variant="primary" busy={signingIn} onPress={() => void signIn(problem.source)} testID="action.signInAgain">
            {problem.state === "expired" ? t("action.signInAgain") : t("action.signInTo", { source: name })}
          </Button>
        ) : notStudent ? (
          <Button size="sm" variant="primary" busy={signingOut} onPress={() => void signOut()} testID="action.signOut">
            {t("action.signOut")}
          </Button>
        ) : (
          <Button size="sm" busy={refreshing} onPress={() => void refresh(offline ? undefined : problem.source)} testID="action.tryAgain">
            {t("action.tryAgain")}
          </Button>
        )}
        {problem.state === "changed" && <ReportButton about={{ source: problem.source as "edunex" | "six" }} />}
      </View>
    </View>
  );
}

/** Where a screen's data comes from before SIX has given it, with a way in while signed out. */
export function SixEmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <EmptyState icon={icon} title={title}>
      {status.state === "signed-out" && (
        <Button variant="primary" busy={busy} onPress={() => void signIn("six")}>
          {t("action.signInTo", { source: "SIX" })}
        </Button>
      )}
    </EmptyState>
  );
}
