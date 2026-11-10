// Settings › Notifikasi: one switch row per kind of alert (Android's MaterialSwitch, the whole row toggles), each just
// its name; when it fires is its spoken hint, not a line under every switch. An alert that needs SIX says so while SIX
// is signed out. Under Tenggat (while it's on), the reminder times as one row with its value, picked in a sheet. Then
// Kuliah sebentar lagi, a test notification (the row sends it; what happened is its one line) and, while there are
// some, the reminders put off or marked handled (the row opens the way to bring them all back).
// While Android's permission for notifications is off, no switch here can make one show: the group says so once with
// the shared notice (parts/notifications-off.tsx: one line, its own small button, the same on Notifikasi) in place
// of the group's heading, and the switches are folded away until it's on, never half-on (round 1's council: "on, off or disabled can't be told").
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDone, useHeldBack, useSnoozes } from "../../../../src/app/snoozes";
import { useBridge, useStatus } from "../../../../src/app/store";
import { type AlertGroup, DEADLINE_REMINDERS, type DeadlineReminder, type Settings } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import { NotificationsOff, useNotificationPermission } from "../../parts/notifications-off";
import { toast } from "../../swaps/overlays";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Chevron, haptic, SettingRow, SettingsGroup, SheetTitle, SwitchRow } from "../../ui/settings-list";
import { ActionSheet, Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import type { Report, Update } from "./save";

// Presensi and Kehadiran read as one thing to a student: on the phone each is named by what it warns about (phoneWording).
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

const DUE_LABEL: Record<DeadlineReminder, StringKey> = {
  48: "settings.alerts.due48",
  24: "settings.alerts.due24",
  3: "settings.alerts.due3",
  1: "settings.alerts.due1",
};

export function AlertSettings({ settings, update, report }: { settings: Settings; update: Update; report: Report }) {
  const t = useT();
  const sixOut = useStatus("six").state === "signed-out";
  const needsSix = sixOut ? t("mobile.settings.needsSix") : undefined;
  const setOn = (group: AlertGroup, on: boolean) =>
    update({ mutedAlerts: on ? settings.mutedAlerts.filter((g) => g !== group) : [...settings.mutedAlerts.filter((g) => g !== group), group] });
  // While Android has notifications off, no switch here can make one show: they're folded away, their state kept,
  // until the button turns notifications on. What doesn't need the permission (reminders put off) stays.
  const permission = useNotificationPermission();
  const off = permission.off;
  if (off)
    return (
      // No heading while the notice shows: it names the group itself ("Notifikasi mati"), and the word right over it
      // said it twice (round 3's council).
      <SettingsGroup lead={<NotificationsOff state={permission} />} testID="section.settings.alerts">
        <SnoozedReminders report={report} />
      </SettingsGroup>
    );
  return (
    <SettingsGroup title={t("settings.alerts")} testID="section.settings.alerts">
      {ALERT_ROWS.flatMap(({ group, label, hint, six }) => {
        const on = !settings.mutedAlerts.includes(group);
        const row = (
          <SwitchRow
            key={group}
            title={t(label)}
            hint={six && needsSix ? `${t(hint)}, ${needsSix}` : t(hint)}
            meta={six ? needsSix : undefined}
            metaTone="amber"
            value={on}
            onChange={(next) => setOn(group, next)}
            testID={`switch.alert.${group}`}
          />
        );
        // Tenggat's reminder times, while it's on.
        return group === "deadline" && on ? [row, <DueTimes key="dueTimes" settings={settings} update={update} />] : [row];
      })}
      <SwitchRow
        title={t("settings.alerts.classSoon")}
        hint={needsSix ? `${t("settings.alerts.classSoonHint")}, ${needsSix}` : t("settings.alerts.classSoonHint")}
        meta={needsSix}
        metaTone="amber"
        value={settings.classSoonAlerts}
        onChange={(classSoonAlerts) => update({ classSoonAlerts })}
        testID="switch.classSoon"
      />
      <TestAlert report={report} />
      <SnoozedReminders report={report} />
    </SettingsGroup>
  );
}

/** "Ingatkan sebelum tenggat": the times picked, as the row's value; the row opens them in a sheet, each on or off. */
function DueTimes({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const [open, setOpen] = useState(false);
  const picked = DEADLINE_REMINDERS.filter((hours) => settings.deadlineReminders.includes(hours));
  const value = picked.length ? f.list(picked.map((hours) => t(DUE_LABEL[hours]))) : t("mobile.settings.dueNone");
  const toggle = (hours: DeadlineReminder) => {
    const on = !settings.deadlineReminders.includes(hours);
    haptic.toggle(on);
    update({ deadlineReminders: DEADLINE_REMINDERS.filter((h) => (h === hours ? on : settings.deadlineReminders.includes(h))) });
  };
  const title = t("settings.alerts.deadlineTimes");
  return (
    <>
      <SettingRow
        title={title}
        meta={value}
        metaTone={picked.length ? "muted" : "amber"}
        label={`${title}, ${value}`}
        hint={picked.length ? undefined : t("settings.alerts.deadlineNone")}
        onPress={() => setOpen(true)}
        trailing={<Chevron />}
        testID="row.dueTimes"
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={<SheetTitle>{title}</SheetTitle>} background={v.card} testID="sheet.dueTimes">
        <View style={{ marginHorizontal: -space[6] }}>
          {DEADLINE_REMINDERS.map((hours) => {
            const on = settings.deadlineReminders.includes(hours);
            return (
              <PressScale
                key={hours}
                testID={`chip.due.${hours}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(hours)}
                style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 56, paddingHorizontal: space[6] }}
              >
                {/* Material's checkbox: a rounded square, filled with a check when on. */}
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: on ? v.brand : v.muted,
                    backgroundColor: on ? v.brand : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {on && <Icons.Check size={14} color={v.onBrand} weight="bold" />}
                </View>
                <Text size="bodyLarge" style={{ flex: 1, color: v.fg }}>
                  {t(DUE_LABEL[hours])}
                </Text>
              </PressScale>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

/** "Coba notifikasi": the row sends one; its line says it went, or that Android has notifications off. */
function TestAlert({ report }: { report: Report }) {
  const t = useT();
  const bridge = useBridge();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<"sent" | "off" | null>(null);
  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { shown } = await bridge.invoke("alerts.test", {});
      setResult(shown ? "sent" : "off");
    } catch (error) {
      report(error);
    } finally {
      setTesting(false);
    }
  };
  const said = result === "sent" ? t("settings.alerts.testSent") : result === "off" ? t("mobile.settings.notificationsOff") : null;
  return (
    <SettingRow
      title={t("settings.alerts.test")}
      meta={said ? <Said tone={result === "sent" ? "ok" : "red"}>{said}</Said> : undefined}
      label={`${t("settings.alerts.testAction")}: ${t("settings.alerts.test")}`}
      hint={t("settings.alerts.testHint")}
      busy={testing}
      onPress={() => void test()}
      testID="action.testAlert"
    />
  );
}

/** What a tried action did, read out as it changes. */
function Said({ tone, children }: { tone: "ok" | "red"; children: string }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyMedium" accessibilityLiveRegion="polite" style={{ color: tone === "ok" ? v.okFg : v.redFg }}>
      {children}
    </Text>
  );
}

/** What's put off or marked handled, and the way to bring it all back; only while there is some. */
function SnoozedReminders({ report }: { report: Report }) {
  const t = useT();
  const { wakeAll } = useSnoozes();
  const { unmarkAll } = useDone();
  const held = useHeldBack();
  const [menu, setMenu] = useState(false);
  const count = held.snoozed.length + held.done.length;
  if (!count) return null;
  const title = t("settings.snoozed", { count });
  return (
    <>
      <SettingRow title={title} hint={t("settings.snoozed.hint")} onPress={() => setMenu(true)} trailing={<Chevron />} testID="row.snoozed" />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={title}
        testID="sheet.snoozed"
        choices={[
          {
            label: t("settings.snoozed.wakeAll"),
            hint: t("settings.snoozed.hint"),
            onPress: () =>
              void Promise.all([wakeAll(), unmarkAll()]).then(() => {
                haptic.confirm();
                toast(t("settings.snoozed.woken"), "success");
              }, report),
            testID: "action.wakeAll",
          },
        ]}
      />
    </>
  );
}
