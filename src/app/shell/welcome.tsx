// First run (and after signing out): connect EduNex and SIX. Each sign-in
// happens in a window the app owns, on Microsoft's own page; right after the
// first, the second needs no password again. The screen stays until the
// Student moves on, which also wipes the sign-in windows' Microsoft session.
import type { SourceId } from "../../core/models";
import { useT } from "../i18n";
import { displayName } from "../names";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { Button, Segmented } from "../ui/controls";
import { Card } from "../ui/display";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
import { useSignIn } from "./source-status";

const MARK: Record<"edunex" | "six", string> = {
  edunex: "bg-(--source-edunex-bg) text-(--source-edunex-fg)",
  six: "bg-(--source-six-bg) text-(--source-six-fg)",
};

const isConnected = (state: string) => state !== "signed-out" && state !== "expired";

export function Welcome({ onDone }: { onDone: () => void }) {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  const settings = useSettings();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const edunex = isConnected(useStatus("edunex").state);
  const six = isConnected(useStatus("six").state);

  const done = () => {
    void bridge.invoke("auth.signInDone", {}).catch(() => undefined);
    onDone();
  };

  return (
    <div className="relative h-screen overflow-y-auto bg-welcome text-fg">
      {store.platform === "darwin" && <div className="drag absolute inset-x-0 top-0 h-[52px]" />}
      <div className="grid min-h-full place-items-center px-6 py-16">
        <div className="w-full max-w-[460px]">
          <div className="mx-auto grid size-14 place-items-center rounded-[16px] bg-gradient-to-b from-[#4c8bf7] to-[#2563eb] text-white shadow-[0_8px_24px_-8px_rgb(37_99_235/0.55)]">
            <Icons.GraduationCap className="size-7" strokeWidth={1.9} />
          </div>
          <h1 className="mt-5 text-center text-[24px] leading-8 font-semibold tracking-[-0.02em]">{t("welcome.title")}</h1>
          <p className="mx-auto mt-2 max-w-[400px] text-center text-lead text-muted">{t("welcome.lead")}</p>

          <Card className="mt-7 divide-y divide-line overflow-hidden">
            <SourceRow
              source="edunex"
              detail={t("welcome.edunexDetail")}
              who={account ? `${displayName(account.name)} · ${account.nim}` : null}
              primary={!edunex}
            />
            <SourceRow
              source="six"
              detail={t("welcome.sixDetail")}
              who={student ? `${displayName(student.name)} · ${student.program ?? student.nim}` : null}
              primary={edunex && !six}
            />
          </Card>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-small text-muted">
            <Icons.ShieldCheck className="size-3.5" />
            {t("welcome.passwordNote")}
          </p>
          <p className="mt-1 text-center text-caption text-faint">{t("welcome.readOnly")}</p>
          {store.vault === "memory" && <p className="mt-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-center text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>}

          <Button variant={edunex && six ? "primary" : "secondary"} size="lg" className="mt-7 w-full" disabled={!edunex && !six} onClick={done}>
            {t("welcome.continue")}
          </Button>

          <div className="mt-10 flex justify-center">
            <Segmented
              label={t("settings.language")}
              value={settings.lang}
              onChange={(lang) => void bridge.invoke("settings.update", { lang }).catch(() => undefined)}
              options={[
                { value: "id", label: "Indonesia" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ source, detail, who, primary }: { source: Extract<SourceId, "edunex" | "six">; detail: string; who: string | null; primary: boolean }) {
  const t = useT();
  const status = useStatus(source);
  const { signIn, busy } = useSignIn();
  const name = t(`source.${source}`);
  const connected = isConnected(status.state);
  let line = detail;
  if (status.state === "connecting") line = t("status.connecting");
  else if (busy) line = t("welcome.waiting");
  else if (connected && who) line = who;

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className={cx("grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold", MARK[source])}>
        {name[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lead font-semibold">{name}</span>
        <span className="line-clamp-2 block text-small text-muted">{line}</span>
      </span>
      {connected ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-small font-semibold text-success-fg">
          <Icons.CheckCircle className="size-4" />
          {t("welcome.connected")}
        </span>
      ) : (
        <Button variant={primary ? "primary" : "secondary"} busy={busy} aria-label={t("welcome.connectSource", { source: name })} onClick={() => void signIn(source)}>
          {t("welcome.connect")}
        </Button>
      )}
    </div>
  );
}
