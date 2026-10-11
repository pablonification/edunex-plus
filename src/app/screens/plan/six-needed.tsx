// What a part of Nilai or Rencana studi needs SIX for, said where the part
// would be: what signing in unlocks and the button that does it ("Masuk ke
// SIX"). While SIX is connecting, a calm line instead; when the session or
// the connection is the problem, the shell's banner already says so.
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { useSignIn } from "../../shell/source-status";
import { useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";

export function SixNeeded({ icon, title, body, action, className }: { icon: ReactNode; title: string; body: string; action?: ReactNode; className?: string }) {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  const signedOut = status.state === "signed-out";
  const connecting = status.state === "connecting" || status.state === "live";
  return (
    <div className={cx("flex items-start gap-4 rounded-xl border border-edge bg-surface px-5 py-4 shadow-card", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fill text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{title}</p>
        <p className="mt-0.5 text-small text-muted">{connecting ? t("plan.loading") : signedOut ? body : t("plan.needSixWait")}</p>
        {(signedOut || action) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {signedOut && (
              <Button variant="primary" busy={busy} onClick={() => void signIn("six")}>
                {t("plan.signInSix")}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
