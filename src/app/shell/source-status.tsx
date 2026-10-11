// How each source is doing, always visible: a chip in the top bar (click to
// refresh, or to sign in again when the session ended) and, on Home, a notice
// when something needs the Student.
import { useCallback, useState, type ReactNode } from "react";
import type { SourceId, SourceState } from "../../core/models";
import { ActionError } from "../bridge";
import { useFormat, useT } from "../i18n";
import { useBridge, useStatus } from "../store";
import { Button } from "../ui/controls";
import { Card, EmptyState } from "../ui/display";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
import { Tooltip, toast } from "../ui/overlays";

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

export function SourceStatusChip({ source }: { source: SourceId }) {
  const status = useStatus(source);
  const t = useT();
  const f = useFormat();
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  const name = t(`source.${source}`);
  const label = status.state === "changed" ? t("status.changed", { source: name }) : t(`status.${status.state}`);
  const needsSignIn = status.state === "expired" || status.state === "signed-out";
  const hint = hintFor(status.state, name, t);
  const updated = status.updatedAt ? t("status.updated", { when: f.fromNow(status.updatedAt) }) : t("status.neverUpdated");

  return (
    <Tooltip
      content={
        <span className="block space-y-0.5">
          {hint && <span className="block">{hint}</span>}
          {status.state === "changed" && status.detail && <span className="block font-mono opacity-80">{status.detail}</span>}
          <span className="block opacity-80">{needsSignIn ? t("action.signInAgain") : updated}</span>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => void (needsSignIn ? signIn(source) : refresh(source))}
        className={cx(
          "focus-ring no-drag inline-flex h-7 items-center gap-2 rounded-full border border-edge bg-surface px-2.5 text-small font-medium transition-colors duration-150 hover:bg-hover",
          status.state === "changed" && "border-transparent bg-danger-bg text-danger-fg hover:bg-danger-bg",
          status.state === "expired" && "border-transparent bg-warning-bg text-warning-fg hover:bg-warning-bg",
        )}
      >
        <StateMark state={status.state} busy={refreshing || signingIn} />
        <span>{name}</span>
        <span className={cx(status.state !== "changed" && status.state !== "expired" && "text-muted")}>{refreshing ? t("status.refreshing") : label}</span>
      </button>
    </Tooltip>
  );
}

function hintFor(state: SourceState, source: string, t: ReturnType<typeof useT>): string | null {
  if (state === "expired") return t("status.expiredHint", { source });
  if (state === "changed") return t("status.changedHint", { source });
  if (state === "offline") return t("status.offlineHint", { source });
  return null;
}

/**
 * On Home: a session that ended, saved data with no session (signed out, or a
 * computer that can't keep sessions), or a vendor change, said plainly with
 * the one thing to do.
 */
export function SourceNotice({ source, hasData }: { source: SourceId; hasData: boolean }) {
  const status = useStatus(source);
  const t = useT();
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  const name = t(`source.${source}`);
  const signedOut = status.state === "signed-out" && hasData;
  if (status.state !== "expired" && status.state !== "changed" && !signedOut) return null;
  const needsSignIn = status.state === "expired" || signedOut;
  let action: ReactNode;
  if (needsSignIn)
    action = (
      <Button variant="primary" busy={signingIn} onClick={() => void signIn(source)}>
        {signedOut ? t("action.signIn") : t("action.signInAgain")}
      </Button>
    );
  else
    action = (
      <Button busy={refreshing} onClick={() => void refresh(source)}>
        {t("action.tryAgain")}
      </Button>
    );
  return (
    <Card className={cx("mt-6 flex items-center gap-3.5 px-4 py-3.5", needsSignIn ? "border-transparent bg-warning-bg" : "border-transparent bg-danger-bg")}>
      <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg bg-surface/70", needsSignIn ? "text-warning-fg" : "text-danger-fg")}>
        {needsSignIn ? <Icons.Lock className="size-4" /> : <Icons.AlertTriangle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">
          {signedOut ? t("status.signed-out") : needsSignIn ? t("status.expired") : t("status.changed", { source: name })}
        </p>
        <p className="mt-0.5 text-small text-muted">{signedOut ? t("status.signedOutHint", { source: name }) : hintFor(status.state, name, t)}</p>
      </div>
      {action}
    </Card>
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
          {t("action.signIn")}
        </Button>
      )}
    </EmptyState>
  );
}
