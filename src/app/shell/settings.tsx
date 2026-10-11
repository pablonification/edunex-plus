// Settings: theme, language, which alerts notify and what closing the window
// does, the accounts, and a visible Sign out that removes every session and
// saved trace from this computer.
import { useState, type ReactNode } from "react";
import type { AlertGroup, Settings } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { ActionError } from "../bridge";
import { useT } from "../i18n";
import { displayName } from "../names";
import { TargetStepper } from "../screens/presence";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { Button, Segmented, Switch } from "../ui/controls";
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

      <AlertSettings settings={settings} update={update} report={report} />

      <Group title={t("course.attendance")}>
        <Row label={t("settings.attendance.target")} hint={t("settings.attendance.targetHint")}>
          <TargetStepper />
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

/** Alert groups with a detector so far, in the approved design's order. Add a group here when its alerts land. */
const ALERT_ROWS: { group: AlertGroup; label: StringKey; hint: StringKey }[] = [
  { group: "presence", label: "settings.alerts.presence", hint: "settings.alerts.presenceHint" },
  { group: "attendanceRisk", label: "settings.alerts.attendanceRisk", hint: "settings.alerts.attendanceRiskHint" },
  { group: "deadline", label: "settings.alerts.deadline", hint: "settings.alerts.deadlineHint" },
  { group: "newTask", label: "settings.alerts.newTask", hint: "settings.alerts.newTaskHint" },
  { group: "newMaterial", label: "settings.alerts.newMaterial", hint: "settings.alerts.newMaterialHint" },
];

function AlertSettings({ settings, update, report }: { settings: Settings; update: (patch: Partial<Settings>) => void; report: (error: unknown) => void }) {
  const t = useT();
  const bridge = useBridge();
  const [testing, setTesting] = useState(false);
  const setOn = (group: AlertGroup, on: boolean) =>
    update({ mutedAlerts: on ? settings.mutedAlerts.filter((g) => g !== group) : [...settings.mutedAlerts.filter((g) => g !== group), group] });
  const test = async () => {
    setTesting(true);
    try {
      await bridge.invoke("alerts.test", {});
    } catch (error) {
      report(error);
    } finally {
      setTesting(false);
    }
  };
  return (
    <Group title={t("settings.alerts")}>
      {ALERT_ROWS.map(({ group, label, hint }) => (
        <Row key={group} label={t(label)} hint={t(hint)}>
          <Switch checked={!settings.mutedAlerts.includes(group)} onCheckedChange={(on) => setOn(group, on)} label={t(label)} />
        </Row>
      ))}
      <Row label={t("settings.closeWindow")}>
        <Segmented
          label={t("settings.closeWindow")}
          value={settings.closeToTray ? "tray" : "quit"}
          onChange={(choice) => update({ closeToTray: choice === "tray" })}
          options={[
            { value: "tray", label: t("settings.closeWindow.tray") },
            { value: "quit", label: t("settings.closeWindow.quit") },
          ]}
        />
      </Row>
      <Row label={t("settings.alerts.test")}>
        <Button size="sm" busy={testing} onClick={() => void test()}>
          {t("settings.alerts.testAction")}
        </Button>
      </Row>
    </Group>
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
