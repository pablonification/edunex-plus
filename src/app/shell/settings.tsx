// Settings: theme, language, the accounts, and a visible Sign out that removes
// every session and saved trace from this computer.
import { useState, type ReactNode } from "react";
import type { Settings } from "../../core/models";
import { ActionError } from "../bridge";
import { useT } from "../i18n";
import { displayName } from "../names";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { Button, Segmented } from "../ui/controls";
import { Card } from "../ui/display";
import { ConfirmDialog, Dialog, toast } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { useSignIn } from "./source-status";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("nav.settings")}>
      <PanelBoundary name="settings" compact>
        <SettingsBody onSignedOutOfEverything={() => onOpenChange(false)} />
      </PanelBoundary>
    </Dialog>
  );
}

function SettingsBody({ onSignedOutOfEverything }: { onSignedOutOfEverything: () => void }) {
  const t = useT();
  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const account = useDataset("edunex.account");
  const status = useStatus("edunex");
  const { signIn, busy: signingIn } = useSignIn();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"edunex" | "all" | null>(null);

  const report = (error: unknown) => toast(t("error.action", { message: error instanceof ActionError ? error.message : String(error) }), "danger");
  const update = (patch: Partial<Settings>) => void bridge.invoke("settings.update", patch).catch(report);
  const signOut = async (source?: "edunex") => {
    setBusy(source ?? "all");
    try {
      await bridge.invoke("auth.signOut", source ? { source } : {});
      if (!source) {
        setConfirming(false);
        onSignedOutOfEverything();
      }
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-7">
      <Group title={t("settings.appearance")}>
        <Row label={t("settings.theme")}>
          <Segmented
            label={t("settings.theme")}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: t("settings.theme.system") },
              { value: "light", label: t("settings.theme.light") },
              { value: "dark", label: t("settings.theme.dark") },
            ]}
          />
        </Row>
        <Row label={t("settings.language")}>
          <Segmented
            label={t("settings.language")}
            value={settings.lang}
            onChange={(lang) => update({ lang })}
            options={[
              { value: "id", label: "Indonesia" },
              { value: "en", label: "English" },
            ]}
          />
        </Row>
      </Group>

      <Group title={t("settings.accounts")}>
        <Row label={t("source.edunex")} hint={account ? `${displayName(account.name)} · ${account.nim}` : t("settings.notConnected")}>
          {status.state === "signed-out" || status.state === "expired" ? (
            <Button size="sm" variant="primary" busy={signingIn} onClick={() => void signIn("edunex")}>
              {status.state === "expired" ? t("action.signInAgain") : t("action.signIn")}
            </Button>
          ) : (
            <Button size="sm" busy={busy === "edunex"} onClick={() => void signOut("edunex")}>
              {t("action.signOut")}
            </Button>
          )}
        </Row>
      </Group>

      {store.vault === "memory" && <p className="rounded-lg bg-warning-bg px-3.5 py-2.5 text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>}

      <Group>
        <Row label={t("settings.signOutAll")} hint={t("settings.signOutAllHint")}>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            {t("action.signOut")}
          </Button>
        </Row>
      </Group>

      <p className="text-caption text-faint">{t("settings.version", { version: store.version })}</p>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("settings.signOutAllConfirm")}
        body={t("settings.signOutAllHint")}
        confirmLabel={t("action.signOut")}
        busy={busy === "all"}
        onConfirm={() => void signOut()}
      />
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className="mb-2 text-small font-semibold text-muted">{title}</h3>}
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        {hint && <span className="block truncate text-small text-muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
