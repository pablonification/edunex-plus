// How each source is doing: one quiet status control in the top bar (it opens
// each source in words, with its fix), and a banner under the top bar, on
// every screen, when something needs the Student.
import { useCallback, useState, type ReactNode } from "react";
import type { SourceId, SourceState } from "../../core/models";
import { ActionError } from "../bridge";
import { useFormat, useT } from "../i18n";
import { useBridge, useDataset, useStatus } from "../store";
import { Button, IconButton } from "../ui/controls";
import { EmptyState } from "../ui/display";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
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
        toast(error instanceof ActionError && error.kind !== "Failed" ? t("error.action", { message: error.message }) : t("welcome.signInFailed"), "danger");
      } finally {
        setBusy(false);
      }
    },
    [bridge, t],
  );
  return { signIn, busy };
}

export function useRefresh() {
  const bridge = useBridge();
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async (source?: SourceId) => {
      setBusy(true);
      try {
        await bridge.invoke("sync.refresh", source ? { source } : {});
      } catch {
        // The source's status already says what went wrong.
      } finally {
        setBusy(false);
      }
    },
    [bridge],
  );
  return { refresh, busy };
}

function StateMark({ state, busy }: { state: SourceState; busy: boolean }) {
  if (busy || state === "connecting") return <Icons.Loader className="size-3.5 animate-spin text-faint" />;
  switch (state) {
    case "live":
      return <span aria-hidden className="size-2 rounded-full bg-live" />;
    case "offline":
      return <Icons.WifiOff className="size-3.5 text-faint" />;
    case "expired":
      return <span aria-hidden className="size-2 rounded-full bg-warning-fg" />;
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
  const { refresh, busy } = useRefresh();
  const signedIn = [edunex, six].filter((status) => status.state !== "signed-out");
  // A refresh can take minutes (SIX is read at human pace): a known problem stays named while it runs.
  const worst = overall(signedIn.map((status) => status.state));
  const state = busy && (worst === "live" || worst === "signed-out") ? "connecting" : worst;
  const troubled = signedIn.find((status) => status.state === state && (state === "changed" || state === "expired"));
  const updatedAt = Math.max(0, ...signedIn.map((status) => status.updatedAt ?? 0)) || null;
  let text: string;
  if (state === "connecting") text = t("sync.checking");
  else if (troubled) text = state === "expired" ? t("sync.expired", { source: t(`source.${troubled.source}`) }) : t("status.changed", { source: t(`source.${troubled.source}`) });
  else if (state === "offline") text = t("status.offline");
  else text = updatedAt ? t("status.updated", { when: f.fromNow(updatedAt) }) : t("status.neverUpdated");

  return (
    <Popover
      label={t("sync.title")}
      className="w-[340px] p-1.5"
      trigger={
        <button
          type="button"
          aria-label={`${t("sync.title")}: ${text}`}
          className={cx(
            "focus-ring no-drag inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-small font-medium transition-colors duration-150",
            state === "changed" ? "bg-danger-bg text-danger-fg" : state === "expired" ? "bg-warning-bg text-warning-fg" : "text-muted hover:bg-hover hover:text-fg",
          )}
        >
          <StateMark state={state === "signed-out" ? "signed-out" : state} busy={state === "connecting"} />
          <span className="max-w-[180px] truncate">{text}</span>
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
        <Button className="w-full" busy={busy} disabled={!signedIn.length} icon={<Icons.RefreshCw className="size-3.5" />} onClick={() => void refresh()}>
          {t("sync.refreshNow")}
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
  const { refresh, busy: refreshing } = useRefresh();
  const name = t(`source.${source}`);
  const needsSignIn = source !== "itb" && (status.state === "expired" || status.state === "signed-out");
  const hint = hintFor(status.state, name, t);
  const word = status.state === "changed" ? t("status.changedShort") : t(`status.${status.state}`);
  return (
    <li className="flex items-start gap-3 rounded-lg px-2.5 py-2">
      <span className="mt-1.5 grid size-3.5 place-items-center">
        <StateMark state={status.state} busy={refreshing || signingIn} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">
          {name} <span className={cx("font-normal", status.state === "expired" ? "text-warning-fg" : status.state === "changed" ? "text-danger-fg" : "text-muted")}>· {word}</span>
        </p>
        <p className="text-small text-muted">{hint ?? (status.updatedAt ? t("status.updated", { when: f.fromNow(status.updatedAt) }) : t("status.neverUpdated"))}</p>
      </div>
      {needsSignIn ? (
        <Button size="sm" variant={status.state === "expired" ? "primary" : "secondary"} busy={signingIn} onClick={() => void signIn(source)}>
          {status.state === "expired" ? t("action.signInAgain") : t("action.signIn")}
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
  const has = { edunex: account !== undefined, six: student !== undefined };
  const problem =
    [edunex, six].find((status) => status.state === "changed") ??
    [edunex, six].find((status) => status.state === "expired" || (status.state === "signed-out" && has[status.source as "edunex" | "six"])) ??
    ([edunex, six].filter((status) => status.state !== "signed-out").every((status) => status.state === "offline") && [edunex, six].some((status) => status.state === "offline")
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
  const detail = offline
    ? lastUpdate
      ? t("banner.offlineHint", { time: f.time(lastUpdate) })
      : null
    : problem.state === "changed"
      ? t("status.changedHint", { source: name })
      : t("banner.keptHint");
  return (
    <div
      role="status"
      className={cx(
        "flex shrink-0 items-center gap-3 border-b px-6 py-2 text-small motion-safe:animate-slide-down",
        problem.state === "changed" ? "border-danger-fg/15 bg-danger-bg text-danger-fg" : offline ? "border-line bg-fill text-fg" : "border-warning-fg/15 bg-warning-bg text-warning-fg",
      )}
    >
      {offline ? <Icons.WifiOff className="size-4 shrink-0" /> : needsSignIn ? <Icons.Lock className="size-4 shrink-0" /> : <Icons.AlertTriangle className="size-4 shrink-0" />}
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{title}</span>
        {detail && <span className="opacity-85"> {detail}</span>}
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
