// How each source is doing: one quiet status control in the top bar (it opens
// each source in words, with its fix), and a banner under the top bar, on
// every screen, when something needs the Student.
import { type ReactNode, useCallback, useState, useSyncExternalStore } from "react";
import type { SourceId, SourceState } from "../../core/models";
import { type Bridge, errorKey } from "../bridge";
import { useFormat, useT } from "../i18n";
import { useBridge, useDataset, useSignInStep, useStatus } from "../store";
import { SourceLogo } from "../ui/brand";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta } from "../ui/layout";
import { Popover, toast } from "../ui/overlays";

/** Opens the sign-in window for a source; resolves when it closes. */
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
 * What a sign-in says once the Student's part in its window is over: it's
 * finishing out of sight, or it's slow and its window is shown again.
 */
export function useSignInNote(source: SourceId): { text: string; hint: string | null; slow: boolean } | null {
  const t = useT();
  const step = useSignInStep(source === "six" ? "six" : "edunex");
  if (source === "itb" || !step) return null;
  const name = t(`source.${source}`);
  return step === "slow"
    ? { text: t("signIn.slow", { source: name }), hint: t("signIn.slowHint"), slow: true }
    : { text: t("signIn.finishing", { source: name }), hint: null, slow: false };
}

// The sources a refresh is reading right now, whoever asked (the panel, ⌘R,
// ⌘K, a "Coba lagi", coming back online), so the top bar and the panel say
// what's still being read instead of each button keeping its own idea.
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

/** The sources a refresh is reading right now. */
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

function StateMark({ state, busy }: { state: SourceState; busy: boolean }) {
  if (busy || state === "connecting") return <Icons.Loader className="size-3.5 animate-spin text-faint" />;
  switch (state) {
    case "live":
      return <span aria-hidden className="size-2 rounded-full bg-live" />;
    case "offline":
      return <Icons.WifiOff className="size-3.5 text-faint" />;
    case "expired":
      return <span aria-hidden className="size-2 rounded-full bg-meter-warning" />;
    case "changed":
      return <Icons.AlertTriangle className="size-3.5 text-danger-fg" />;
    default:
      return <span aria-hidden className="size-2 rounded-full border border-faint" />;
  }
}

/** The worst thing going on across the signed-in sources, for the top bar's one status control. */
function overall(states: SourceState[]): "changed" | "expired" | "offline" | "connecting" | "live" | "signed-out" {
  for (const state of ["changed", "expired", "offline", "connecting", "live"] as const) if (states.includes(state)) return state;
  return "signed-out";
}

/**
 * The top bar's data status: quiet when everything is fresh ("Diperbarui
 * 5 mnt lalu"), named when a source needs the Student. It opens a small panel
 * with each source in words and the one fix (sign in again, try again), and
 * "Perbarui sekarang".
 */
export function SyncStatus() {
  const t = useT();
  const f = useFormat();
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const itb = useStatus("itb");
  const bridge = useBridge();
  const now = useReading();
  const signedIn = [edunex, six].filter((status) => status.state !== "signed-out");
  const busy = now.length > 0;
  // SIX is read at human pace, so a refresh takes a while: say which source is still going,
  // and keep a known problem named while it runs.
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

  return (
    <Popover
      label={t("sync.title")}
      className="w-[340px] p-1.5"
      trigger={
        <button
          type="button"
          aria-label={`${t("sync.title")}: ${text}`}
          // Whole while the search field and the back button can give up room. Zoomed in (the sidebar a rail), it gives
          // up its words too before anything goes past the window, down to its mark: they stay in its name and panel.
          className={cx(
            "focus-ring no-drag inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-small font-medium transition-colors duration-150 max-[52rem]:min-w-11 max-[52rem]:shrink",
            state === "changed"
              ? "bg-danger-bg text-danger-fg"
              : state === "expired"
                ? "bg-warning-bg text-warning-fg"
                : "text-muted hover:bg-hover hover:text-fg",
          )}
        >
          <span className="flex shrink-0">
            <StateMark state={state === "signed-out" ? "signed-out" : state} busy={state === "connecting"} />
          </span>
          {/* Room for "Diperbarui 25 menit yang lalu" whole. */}
          <span className="max-w-[220px] min-w-0 truncate">{text}</span>
        </button>
      }
    >
      <p className="px-2.5 pt-2 pb-1.5 text-caption font-semibold text-faint">{t("sync.title")}</p>
      <ul>
        {[edunex, six, itb].map((status) => (
          <SourceRow key={status.source} source={status.source} />
        ))}
      </ul>
      <div className="mt-1 border-t border-line p-1.5 pt-2.5">
        <Button
          className="w-full"
          busy={busy}
          disabled={!signedIn.length}
          icon={<Icons.RefreshCw className="size-3.5" />}
          onClick={() => void refreshNow(bridge)}
        >
          {busy ? t("sync.checking") : t("sync.refreshNow")}
        </Button>
      </div>
    </Popover>
  );
}

/** One source in the status panel: its state in words, when it last updated, and its fix. */
function SourceRow({ source }: { source: SourceId }) {
  const t = useT();
  const f = useFormat();
  const status = useStatus(source);
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh } = useRefresh();
  const refreshing = useReading().includes(source);
  const name = t(`source.${source}`);
  const needsSignIn = source !== "itb" && (status.state === "expired" || status.state === "signed-out");
  const note = useSignInNote(source);
  const hint = needsSignIn && note ? note.text : refreshing ? t("sync.checking") : hintFor(status.state, name, t);
  const word = status.state === "changed" ? t("status.changedShort") : t(`status.${status.state}`);
  return (
    <li className="flex items-start gap-3 rounded-lg px-2.5 py-2">
      {/* The logo says which system; the mark on its corner, how it's doing. */}
      <span className="relative mt-0.5 shrink-0">
        <SourceLogo source={source} className="size-8" />
        <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-raised">
          <StateMark state={status.state} busy={refreshing || signingIn} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">
          <Meta>
            {name}
            <span className={cx("font-normal", status.state === "expired" ? "text-warning-fg" : status.state === "changed" ? "text-danger-fg" : "text-muted")}>
              {word}
            </span>
          </Meta>
        </p>
        <p className="text-small text-muted">
          {hint ?? (status.updatedAt ? t("status.updated", { when: f.fromNow(status.updatedAt) }) : t("status.neverUpdated"))}
        </p>
      </div>
      {needsSignIn ? (
        <Button size="sm" variant={status.state === "expired" ? "primary" : "secondary"} busy={signingIn} onClick={() => void signIn(source)}>
          {status.state === "expired" ? t("action.signInAgain") : t("action.signInTo", { source: name })}
        </Button>
      ) : status.state === "changed" || status.state === "offline" ? (
        <Button size="sm" busy={refreshing} onClick={() => void refresh(source)}>
          {t("action.tryAgain")}
        </Button>
      ) : null}
    </li>
  );
}

function hintFor(state: SourceState, source: string, t: ReturnType<typeof useT>): string | null {
  if (state === "expired") return t("status.expiredHint", { source });
  if (state === "changed") return t("status.changedHint", { source });
  if (state === "offline") return t("status.offlineHint", { source });
  return null;
}

/**
 * Under the top bar, on every screen: a session that ended, saved data with no
 * session, a source that changed something, or no connection at all. What
 * happened, that the last data is still here, and the one thing to do.
 */
export function ProblemBanner() {
  const t = useT();
  const f = useFormat();
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const edunexNote = useSignInNote("edunex");
  const sixNote = useSignInNote("six");
  const has = { edunex: account !== undefined, six: student !== undefined };
  const problem =
    [edunex, six].find((status) => status.state === "changed") ??
    [edunex, six].find((status) => status.state === "expired" || (status.state === "signed-out" && has[status.source as "edunex" | "six"])) ??
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
  const lastUpdate = Math.max(0, ...[edunex, six].map((status) => status.updatedAt ?? 0));
  const title = offline
    ? t("banner.offline")
    : problem.state === "expired"
      ? t("banner.expired", { source: name })
      : problem.state === "signed-out"
        ? t("banner.signedOut", { source: name })
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
        : t("banner.keptHint");
  // Announced through the live region the shell keeps around it (shell.tsx): one mounted already holding its text isn't read reliably.
  return (
    <div
      className={cx(
        "flex items-center gap-3 border-b px-6 py-2 text-small motion-safe:animate-slide-down",
        problem.state === "changed"
          ? "border-danger-fg/15 bg-danger-bg text-danger-fg"
          : offline
            ? "border-line bg-fill text-fg"
            : "border-warning-fg/15 bg-warning-bg text-warning-fg",
      )}
    >
      {offline ? (
        <Icons.WifiOff className="size-4 shrink-0" />
      ) : needsSignIn ? (
        <Icons.Lock className="size-4 shrink-0" />
      ) : (
        <Icons.AlertTriangle className="size-4 shrink-0" />
      )}
      {/* Wraps rather than cuts: the detail is when the data was last fresh, or the one thing to do. */}
      <p className="min-w-0 flex-1 text-pretty">
        <span className="font-semibold">{title}</span>
        {detail && <span> {detail}</span>}
      </p>
      {needsSignIn ? (
        <Button size="sm" variant="primary" busy={signingIn} onClick={() => void signIn(problem.source)}>
          {problem.state === "expired" ? t("action.signInAgain") : t("action.signInTo", { source: name })}
        </Button>
      ) : (
        <Button size="sm" busy={refreshing} onClick={() => void refresh(offline ? undefined : problem.source)}>
          {t("action.tryAgain")}
        </Button>
      )}
      {!offline && (
        <IconButton size="sm" label={t("action.close")} onClick={() => setDismissed(key)} className="-mr-1 text-current hover:text-current">
          <Icons.X className="size-3.5" />
        </IconButton>
      )}
    </div>
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
        <Button size="sm" variant="primary" busy={busy} onClick={() => void signIn("six")}>
          {t("action.signInTo", { source: "SIX" })}
        </Button>
      )}
    </EmptyState>
  );
}
