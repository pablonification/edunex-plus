// Settings, in the order people look for things: the accounts first (who is
// signed in, when each was last checked, sign out of one, or sign out and
// remove everything), then notifications and what closing the window does,
// then appearance, then the rest (attendance target, version). A newer
// release shows on top while there is one.
import { type ReactNode, useRef, useState } from "react";
import type { AlertGroup, Settings, SourceId } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { ActionError } from "../bridge";
import { useFormat, useT } from "../i18n";
import { displayName } from "../names";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { AppMark, SourceLogo } from "../ui/brand";
import { Button, IconButton, Segmented, Switch } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card } from "../ui/display";
import { Icons } from "../ui/icons";
import { Notice } from "../ui/layout";
import { ConfirmDialog, Dialog, toast } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { useSignIn } from "./source-status";

export function SettingsDialog({
  open,
  onOpenChange,
  onShowFirstScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowFirstScan?: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("nav.settings")}>
      <PanelBoundary name="settings" compact>
        <SettingsBody onSignedOutOfEverything={() => onOpenChange(false)} onShowFirstScan={onShowFirstScan} />
      </PanelBoundary>
    </Dialog>
  );
}

function SettingsBody({ onSignedOutOfEverything, onShowFirstScan }: { onSignedOutOfEverything: () => void; onShowFirstScan?: () => void }) {
  const t = useT();
  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const report = useReport();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<Settings>) => void bridge.invoke("settings.update", patch).catch(report);
  const signOutOfEverything = async () => {
    setBusy(true);
    try {
      await bridge.invoke("auth.signOut", {});
      setConfirming(false);
      onSignedOutOfEverything();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <UpdateNotice report={report} />

      <Group title={t("settings.accounts")} note={t("settings.accounts.note")}>
        <AccountRow source="edunex" who={account ? `${displayName(account.name)} · ${account.nim}` : null} />
        <AccountRow source="six" who={student ? `${displayName(student.name)} · ${student.program ?? student.nim}` : null} />
        {onShowFirstScan && (
          <Row label={t("settings.firstScan")} hint={t("settings.firstScan.hint")}>
            <Button size="sm" aria-label={`${t("settings.firstScan.show")}: ${t("settings.firstScan")}`} onClick={onShowFirstScan}>
              {t("settings.firstScan.show")}
            </Button>
          </Row>
        )}
        <Row label={t("settings.signOutAll.label")} hint={t("settings.signOutAllHint")}>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            {t("settings.signOutAll")}
          </Button>
        </Row>
      </Group>
      {store.vault === "memory" && <Notice tone="warning" title={t("settings.sessionNotSaved")} />}

      <AlertSettings settings={settings} update={update} report={report} />

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

      <Group title={t("settings.other")}>
        <Row label={t("settings.attendance.target")} hint={t("settings.attendance.targetHint")}>
          <Target value={settings.attendanceTarget} onChange={(attendanceTarget) => update({ attendanceTarget })} />
        </Row>
      </Group>

      <About version={store.version} />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("settings.signOutAllConfirm")}
        body={t("settings.signOutAllHint")}
        confirmLabel={t("settings.signOutAll")}
        busy={busy}
        onConfirm={() => void signOutOfEverything()}
      />
    </div>
  );
}

/** "− 80% +": the target, stepped by 5 between 50 and 100. */
function Target({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const t = useT();
  const set = (next: number) => onChange(Math.max(50, Math.min(100, next)));
  return (
    <div className="inline-flex h-8 shrink-0 items-center rounded-lg border border-edge bg-surface">
      <IconButton size="sm" label={t("presence.target.lower")} disabled={value <= 50} onClick={() => set(value - 5)} className="rounded-r-none">
        <Icons.Minus className="size-3.5" />
      </IconButton>
      <span className="min-w-11 px-1 text-center text-small font-semibold tabular-nums" aria-live="polite">
        {value}%
      </span>
      <IconButton size="sm" label={t("presence.target.raise")} disabled={value >= 100} onClick={() => set(value + 5)} className="rounded-l-none">
        <Icons.Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}

/** Alert groups with a detector so far, in the approved design's order. Add a group here when its alerts land. */
const ALERT_ROWS: { group: AlertGroup; label: StringKey; hint: StringKey; six?: true }[] = [
  { group: "presence", label: "settings.alerts.presence", hint: "settings.alerts.presenceHint" },
  { group: "attendanceRisk", label: "settings.alerts.attendanceRisk", hint: "settings.alerts.attendanceRiskHint", six: true },
  { group: "changes", label: "settings.alerts.changes", hint: "settings.alerts.changesHint" },
  { group: "exams", label: "settings.alerts.exams", hint: "settings.alerts.examsHint" },
  { group: "deadline", label: "settings.alerts.deadline", hint: "settings.alerts.deadlineHint" },
  { group: "newTask", label: "settings.alerts.newTask", hint: "settings.alerts.newTaskHint" },
  { group: "newMaterial", label: "settings.alerts.newMaterial", hint: "settings.alerts.newMaterialHint" },
  { group: "grade", label: "settings.alerts.grade", hint: "settings.alerts.gradeHint" },
  { group: "krs", label: "settings.alerts.krs", hint: "settings.alerts.krsHint", six: true },
  { group: "bill", label: "settings.alerts.bill", hint: "settings.alerts.billHint", six: true },
  { group: "academic", label: "settings.alerts.academic", hint: "settings.alerts.academicHint" },
];

function AlertSettings({ settings, update, report }: { settings: Settings; update: (patch: Partial<Settings>) => void; report: (error: unknown) => void }) {
  const t = useT();
  const bridge = useBridge();
  const [testing, setTesting] = useState(false);
  const [sent, setSent] = useState(false);
  const sixOut = useStatus("six").state === "signed-out";
  const setOn = (group: AlertGroup, on: boolean) =>
    update({ mutedAlerts: on ? settings.mutedAlerts.filter((g) => g !== group) : [...settings.mutedAlerts.filter((g) => g !== group), group] });
  const test = async () => {
    setTesting(true);
    setSent(false);
    try {
      await bridge.invoke("alerts.test", {});
      setSent(true);
    } catch (error) {
      report(error);
    } finally {
      setTesting(false);
    }
  };
  return (
    <Group title={t("settings.alerts")}>
      {ALERT_ROWS.map(({ group, label, hint, six }) => (
        // Signed out of SIX, an alert only SIX can raise says so, rather than seeming to work.
        <Row key={group} label={t(label)} hint={six && sixOut ? `${t(hint)} · ${t("settings.alerts.needsSix")}` : t(hint)}>
          <Switch checked={!settings.mutedAlerts.includes(group)} onCheckedChange={(on) => setOn(group, on)} label={t(label)} />
        </Row>
      ))}
      <Row label={t("settings.alerts.test")} hint={t("settings.alerts.testHint")}>
        <Button size="sm" busy={testing} onClick={() => void test()}>
          {t("settings.alerts.testAction")}
        </Button>
      </Row>
      {sent && (
        <p role="status" className="flex items-start gap-2 bg-success-bg/60 px-4 py-2.5 text-small text-success-fg">
          <Icons.CheckCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {t("settings.alerts.testSent")}
        </p>
      )}
      <Row label={t("settings.closeWindow")} hint={t("settings.closeWindow.hint")} stacked>
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
    </Group>
  );
}

/** A newer release on GitHub: shown only while there is one. The app never installs it itself. */
function UpdateNotice({ report }: { report: (error: unknown) => void }) {
  const t = useT();
  const bridge = useBridge();
  const update = useDataset("app.update");
  if (!update) return null;
  return (
    <Notice
      tone="info"
      title={t("update.available")}
      action={
        <Button size="sm" variant="primary" onClick={() => void bridge.invoke("app.openRelease", {}).catch(report)}>
          {t("update.download")}
        </Button>
      }
    >
      {t("update.version", { version: update.version })}
    </Notice>
  );
}

function useReport() {
  const t = useT();
  return (error: unknown) => toast(t("error.action", { message: error instanceof ActionError ? error.message : String(error) }), "danger");
}

/** One system's account: who, its state and last check, and Sign in (again) or Sign out of just that system. */
function AccountRow({ source, who }: { source: SourceId; who: string | null }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const status = useStatus(source);
  const report = useReport();
  const { signIn, busy: signingIn } = useSignIn();
  const [busy, setBusy] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const name = t(`source.${source}`);
  const signOut = async () => {
    setBusy(true);
    try {
      await bridge.invoke("auth.signOut", { source });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
    // The busy button let go of focus: give it back (now "Masuk ke …") without moving the list, and keep the row in sight.
    requestAnimationFrame(() => {
      row.current?.querySelector("button")?.focus({ preventScroll: true });
      row.current?.scrollIntoView?.({ block: "nearest" });
    });
  };
  const needsSignIn = status.state === "signed-out" || status.state === "expired";
  // Each button says where it goes, both ways: "Masuk ke SIX", "Keluar dari SIX".
  const label = needsSignIn
    ? t(status.state === "expired" ? "settings.signInAgainTo" : "settings.signInTo", { source: name })
    : t("settings.signOutOf", { source: name });
  const checked = status.updatedAt !== null ? f.fromNow(status.updatedAt) : null;
  const state =
    status.state === "signed-out"
      ? { text: t("settings.notConnected"), tone: "text-muted" }
      : status.state === "expired"
        ? { text: t("settings.account.expired"), tone: "text-warning-fg" }
        : status.state === "connecting"
          ? { text: t("status.connecting"), tone: "text-muted" }
          : status.state === "live"
            ? { text: checked ? t("settings.account.live", { when: checked }) : t("status.live"), tone: "text-success-fg" }
            : { text: checked ? t("settings.account.stale", { when: checked }) : t(`status.${status.state}`, { source: name }), tone: "text-warning-fg" };
  return (
    <div ref={row} className="flex scroll-my-3 items-center gap-3.5 px-4 py-3">
      <SourceLogo source={source} className="size-9" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{name}</span>
        {who && <span className="block truncate text-small text-muted">{who}</span>}
        <span className={cx("mt-0.5 flex items-center gap-1.5 text-caption font-medium", state.tone)}>
          {status.state === "live" && <span aria-hidden className="size-1.5 rounded-full bg-live" />}
          {state.text}
        </span>
      </span>
      <Button
        size="sm"
        variant={needsSignIn ? "primary" : "secondary"}
        busy={needsSignIn ? signingIn : busy}
        onClick={() => void (needsSignIn ? signIn(source) : signOut())}
      >
        {label}
      </Button>
    </div>
  );
}

/** Which app this is, and which version. */
function About({ version }: { version: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 px-1">
      <AppMark className="size-9" />
      <span className="min-w-0">
        <span className="block text-body font-semibold">Edunex Plus</span>
        <span className="block text-small text-muted">{t("settings.version", { version })}</span>
      </span>
    </div>
  );
}

function Group({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className="mb-2 px-1 text-small font-semibold text-muted">{title}</h3>}
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      {note && <p className="mt-1.5 px-1 text-caption text-faint">{note}</p>}
    </section>
  );
}

/** A setting: what it is, when it applies, and its control (beside it, or under it when the choices are long). */
function Row({ label, hint, stacked = false, children }: { label: string; hint?: string; stacked?: boolean; children?: ReactNode }) {
  return (
    <div className={cx("flex gap-4 px-4 py-2.5", stacked ? "flex-col items-start gap-2.5 py-3" : "items-center justify-between")}>
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        {hint && <span className="block text-small text-muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}
