// Settings, in the order people look for things: updates first (a newer
// release with the way to download and install it, "Perbarui otomatis" and a
// way to check now, together, so a check's answer shows where it was asked),
// then the accounts (who is
// signed in, when each was last checked, sign out of one, or sign out and
// remove everything), then notifications and what closing the window does,
// then notifications on the phone (./phone.tsx), then appearance, then the
// rest (attendance targets: the default and each course's own), then what the
// app is (licence, the open-source software it uses, opened as a page of its
// own).
import { lazy, type ReactNode, Suspense, useRef, useState } from "react";
import { type AlertGroup, DEADLINE_REMINDERS, type DeadlineReminder, type Settings, type SourceId, type UpdateCheckResult } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { TargetStepper, useTargets } from "../attendance-parts";
import { ActionError } from "../bridge";
import { useFocusNext } from "../hooks";
import { useFormat, useT } from "../i18n";
import { displayName } from "../names";
import { useCourseNames } from "../schedule-data";
import { useHeldBack, useSnoozes } from "../snoozes";
import { useBridge, useDataset, useSettings, useStatus, useStore, useUpdateInstall } from "../store";
import { AppMark, SourceLogo } from "../ui/brand";
import { Button, Segmented, Switch } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, ProgressBar, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta, Notice } from "../ui/layout";
import { ConfirmDialog, Dialog, toast } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { PhoneSettings } from "./phone";
import { useSignIn, useSignInNote } from "./source-status";

// The list of licences, and the code that shows it, load only when the Student opens it.
const Licences = lazy(() => import("./licences"));

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
  const focusNext = useFocusNext();
  const [page, setPage] = useState<"settings" | "licences">("settings");
  // Opened again, Settings starts on its own page (closing leaves the last one on screen while it goes).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPage("settings");
  }
  const licences = page === "licences";
  const back = () => {
    // Back where the Student left: on the button that opened the list.
    focusNext("licences");
    setPage("settings");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(licences ? "licences.title" : "nav.settings")}
      back={licences ? { label: t("action.backTo", { place: t("nav.settings") }), onBack: back } : undefined}
    >
      <PanelBoundary name={page} compact>
        {licences ? (
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <Licences />
          </Suspense>
        ) : (
          <SettingsBody onSignedOutOfEverything={() => onOpenChange(false)} onShowFirstScan={onShowFirstScan} onShowLicences={() => setPage("licences")} />
        )}
      </PanelBoundary>
    </Dialog>
  );
}

function SettingsBody({
  onSignedOutOfEverything,
  onShowFirstScan,
  onShowLicences,
}: {
  onSignedOutOfEverything: () => void;
  onShowFirstScan?: () => void;
  onShowLicences: () => void;
}) {
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
      <Group title={t("settings.updates")} lead={<UpdateNotice report={report} />}>
        <Row label={t("update.auto")} hint={t("update.autoHint")}>
          <Switch checked={settings.autoUpdate} onCheckedChange={(autoUpdate) => update({ autoUpdate })} label={t("update.auto")} />
        </Row>
        <CheckForUpdates version={store.version} />
      </Group>

      <Group title={t("settings.accounts")} note={t("settings.accounts.note")}>
        <AccountRow source="edunex" who={account ? [displayName(account.name), account.nim] : null} />
        <AccountRow source="six" who={student ? [displayName(student.name), student.program ?? student.nim] : null} />
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

      <Group title={t("phone.title")} note={t("phone.privacy")}>
        <PhoneSettings settings={settings} update={update} report={report} />
      </Group>

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
        <AttendanceTargets />
      </Group>

      <Group title={t("settings.about")} note={t("settings.unofficial")}>
        <About />
        <Row label={t("licences.title")} hint={t("licences.hint")}>
          <Button size="sm" data-focus="licences" aria-label={t("licences.viewAll")} onClick={onShowLicences}>
            {t("licences.view")}
          </Button>
        </Row>
      </Group>

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

/** The default target, then each course with its own (from its course contract), which can go back to the default. */
function AttendanceTargets() {
  const t = useT();
  const name = useCourseNames();
  const { target, own, setDefault, setOwn } = useTargets();
  const codes = Object.keys(own).sort();
  const resets = useRef(new Map<string, HTMLButtonElement>());
  const general = useRef<HTMLSpanElement>(null);
  const followDefault = (code: string) => {
    // Its row goes: focus moves to the next course's, else the one before, else the default's stepper, never back to the top of Settings.
    const at = codes.indexOf(code);
    const neighbour = codes[at + 1] ?? codes[at - 1];
    const next = neighbour ? resets.current.get(neighbour) : general.current?.querySelector<HTMLButtonElement>("button:enabled");
    next?.focus();
    setOwn(code, null);
  };
  return (
    <>
      <Row label={t("settings.attendance.target")} hint={t(codes.length ? "settings.attendance.targetHintOwn" : "settings.attendance.targetHint")}>
        <span ref={general} className="flex shrink-0">
          <TargetStepper value={target} onChange={setDefault} />
        </span>
      </Row>
      {codes.map((code) => (
        <Row key={code} label={name(code)} hint={<Meta>{t("settings.attendance.own", { code })}</Meta>}>
          {/* The steppers line up in one column with the default's. */}
          <span className="flex shrink-0 items-center gap-1.5">
            <Button
              ref={(button) => {
                if (button) resets.current.set(code, button);
                else resets.current.delete(code);
              }}
              size="sm"
              variant="ghost"
              aria-label={t("settings.attendance.useDefaultFor", { code })}
              onClick={() => followDefault(code)}
            >
              {t("settings.attendance.useDefault")}
            </Button>
            <TargetStepper value={own[code]} onChange={(value) => setOwn(code, value)} code={code} />
          </span>
        </Row>
      ))}
    </>
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
      {ALERT_ROWS.map(({ group, label, hint, six }) => {
        // Signed out of SIX, an alert only SIX can raise says so, rather than seeming to work.
        const row = (
          <Row
            key={group}
            label={t(label)}
            hint={
              six && sixOut ? (
                <Meta>
                  {t(hint)}
                  {t("settings.alerts.needsSix")}
                </Meta>
              ) : group === "deadline" && !settings.deadlineReminders.length ? (
                t("settings.alerts.deadlineNone")
              ) : (
                t(hint)
              )
            }
          >
            <Switch checked={!settings.mutedAlerts.includes(group)} onCheckedChange={(on) => setOn(group, on)} label={t(label)} />
          </Row>
        );
        // The deadline row picks its reminder times under it, on the same card row.
        return group === "deadline" ? (
          <div key={group}>
            {row}
            <DeadlineTimes chosen={settings.deadlineReminders} onChange={(deadlineReminders) => update({ deadlineReminders })} />
          </div>
        ) : (
          row
        );
      })}
      {/* Off until the Student turns it on: its own setting, not a muted group. It reads SIX's timetable. */}
      <Row
        label={t("settings.alerts.classSoon")}
        hint={
          sixOut ? (
            <Meta>
              {t("settings.alerts.classSoonHint")}
              {t("settings.alerts.needsSix")}
            </Meta>
          ) : (
            t("settings.alerts.classSoonHint")
          )
        }
      >
        <Switch checked={settings.classSoonAlerts} onCheckedChange={(classSoonAlerts) => update({ classSoonAlerts })} label={t("settings.alerts.classSoon")} />
      </Row>
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
      <SnoozedReminders report={report} />
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

const DUE_LABEL: Record<DeadlineReminder, StringKey> = {
  48: "settings.alerts.due48",
  24: "settings.alerts.due24",
  3: "settings.alerts.due3",
  1: "settings.alerts.due1",
};

/**
 * How long before a deadline the reminders come, any number of them. None
 * picked means no deadline reminders at all (the row's hint then says so);
 * the switch above only stops the notifications, the bell still keeps them.
 */
function DeadlineTimes({ chosen, onChange }: { chosen: readonly DeadlineReminder[]; onChange: (chosen: DeadlineReminder[]) => void }) {
  const t = useT();
  const toggle = (hours: DeadlineReminder) => onChange(DEADLINE_REMINDERS.filter((h) => (h === hours ? !chosen.includes(h) : chosen.includes(h))));
  return (
    <fieldset className="px-4 pb-3">
      <legend className="sr-only">{t("settings.alerts.deadlineTimes")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {DEADLINE_REMINDERS.map((hours) => {
          const on = chosen.includes(hours);
          return (
            <button
              key={hours}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(hours)}
              className={cx(
                "focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-small transition-colors duration-150",
                on ? "border-fg/60 bg-selected font-semibold text-fg" : "border-edge text-muted hover:bg-hover hover:text-fg",
              )}
            >
              {on && <Icons.Check className="size-3" weight="bold" />}
              {t(DUE_LABEL[hours])}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * A newer release on GitHub: shown only while there is one. "Unduh & pasang" downloads it (with
 * its progress) and "Mulai ulang untuk memperbarui" installs it; nothing is installed before the
 * Student presses that. A copy that can't replace itself says why and opens the release page.
 */
function UpdateNotice({ report }: { report: (error: unknown) => void }) {
  const t = useT();
  const bridge = useBridge();
  const update = useDataset("app.update");
  const install = useUpdateInstall();
  const { autoUpdate } = useSettings();
  if (!update) return null;
  const openPage = () => void bridge.invoke("app.openRelease", {}).catch(report);
  const download = () => void bridge.invoke("app.downloadUpdate", {}).catch(report);
  // A download of an older notice's version doesn't count for this one.
  const step = install.version === update.version ? install.step : "idle";
  const whatsNew = (
    <Button size="sm" variant="ghost" onClick={openPage}>
      {t("update.whatsNew")}
    </Button>
  );
  const percent = Math.round((install.progress ?? 0) * 100);
  const blockedHint = install.blocked && install.blocked !== "notPackaged" ? t(`update.blocked.${install.blocked}`) : null;
  const action = install.blocked ? (
    <Button size="sm" variant="primary" onClick={openPage}>
      {t("update.download")}
    </Button>
  ) : step === "downloading" ? (
    whatsNew
  ) : step === "ready" ? (
    <>
      {whatsNew}
      <Button size="sm" variant="primary" onClick={() => void bridge.invoke("app.installUpdate", {}).catch(report)}>
        {t("update.restart")}
      </Button>
    </>
  ) : (
    <>
      {whatsNew}
      <Button size="sm" variant="primary" onClick={download}>
        {step === "failed" ? t("update.retry") : t("update.install")}
      </Button>
    </>
  );
  return (
    <Notice tone="info" title={t("update.available")} action={action}>
      {step === "downloading" ? (
        <span className="block space-y-1.5">
          <span className="block">{t("update.downloading", { version: update.version })}</span>
          <ProgressBar
            value={install.progress ?? 0}
            indeterminate={install.progress === null}
            label={install.progress === null ? t("update.downloading", { version: update.version }) : t("update.progress", { percent })}
          />
        </span>
      ) : step === "ready" ? (
        t(autoUpdate ? "update.readyAuto" : "update.ready", { version: update.version })
      ) : (
        <>
          {t("update.version", { version: update.version })}
          {step === "failed" && install.problem && <span className="block">{t(`update.problem.${install.problem}`)}</span>}
          {blockedHint && <span className="block">{blockedHint}</span>}
        </>
      )}
    </Notice>
  );
}

function useReport() {
  const t = useT();
  return (error: unknown) => toast(t("error.action", { message: error instanceof ActionError ? error.message : String(error) }), "danger");
}

/** What's put off with "Ingatkan nanti" on Beranda and course pages, and the way to bring it all back; only while there is some. */
function SnoozedReminders({ report }: { report: (error: unknown) => void }) {
  const t = useT();
  const { wakeAll } = useSnoozes();
  const held = useHeldBack();
  if (!held.length) return null;
  return (
    <Row label={t("settings.snoozed", { count: held.length })} hint={t("settings.snoozed.hint")}>
      <Button size="sm" onClick={() => wakeAll().then(() => toast(t("settings.snoozed.woken"), "success"), report)}>
        {t("settings.snoozed.wakeAll")}
      </Button>
    </Row>
  );
}

/** One system's account: who, its state and last check, and Sign in (again) or Sign out of just that system. */
/** `who`: their name, then their NIM or program. */
function AccountRow({ source, who }: { source: SourceId; who: readonly string[] | null }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const status = useStatus(source);
  const report = useReport();
  const { signIn, busy: signingIn } = useSignIn();
  const note = useSignInNote(source);
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
    needsSignIn && note
      ? { text: note.text, tone: note.slow ? "text-warning-fg" : "text-muted" }
      : status.state === "signed-out"
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
        {who && (
          <Meta truncate className="text-small text-muted">
            {who}
          </Meta>
        )}
        <span className={cx("mt-0.5 flex items-center gap-1.5 text-caption font-medium", state.tone)}>
          {status.state === "live" && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-live" />}
          <Meta>{state.text}</Meta>
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

/**
 * "Periksa pembaruan": GitHub is asked now instead of at the day's check. A newer release shows
 * just above, in the update notice; otherwise the answer shows here.
 */
function CheckForUpdates({ version }: { version: string }) {
  const t = useT();
  const bridge = useBridge();
  const update = useDataset("app.update");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<UpdateCheckResult | null>(null);
  const check = async () => {
    setChecking(true);
    setFound(null);
    try {
      setFound((await bridge.invoke("app.checkUpdate", {})).found);
    } catch {
      setFound("unknown");
    } finally {
      setChecking(false);
    }
  };
  const answer =
    found === "newer" && update ? t("update.checked.newer", { version: update.version }) : found && found !== "newer" ? t(`update.checked.${found}`) : null;
  return (
    <Row label={t("settings.version", { version })} hint={<span role="status">{answer ?? t("update.checkHint")}</span>}>
      <Button size="sm" busy={checking} onClick={() => void check()}>
        {t("update.check")}
      </Button>
    </Row>
  );
}

/** Which app this is, and its own licence (its version is under Pembaruan). */
function About() {
  const t = useT();
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <AppMark className="size-9" />
      <span className="min-w-0">
        <span className="block text-body font-semibold">Edunex Plus</span>
        <span className="block text-small text-muted">{t("settings.openSource")}</span>
      </span>
    </div>
  );
}

/** `lead`: shown between the title and the rows (an update notice), while it draws anything. */
function Group({ title, note, lead, children }: { title?: string; note?: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className="mb-2 px-1 text-small font-semibold text-muted">{title}</h3>}
      {lead && <div className="mb-2 empty:hidden">{lead}</div>}
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      {note && <p className="mt-1.5 px-1 text-caption text-faint">{note}</p>}
    </section>
  );
}

/** A setting: what it is, when it applies, and its control (beside it, or under it when the choices are long). */
function Row({ label, hint, stacked = false, children }: { label: string; hint?: ReactNode; stacked?: boolean; children?: ReactNode }) {
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
