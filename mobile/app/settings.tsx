// Settings (A6): the desktop's (src/app/shell/settings.tsx) as a screen, group by group, with the same
// words and the same settings. What only a computer has is left out: closing to the tray (Android keeps
// the app itself), installing updates (the phone shows the version and asks GitHub, D5), and phone alerts
// through ntfy (the app is the phone, A18). `?at=alerts|courseColors` opens it at that group.
import { router } from "expo-router";
import { type ComponentRef, type ReactNode, useRef, useState } from "react";
import { Image, Pressable, type ScrollView, View } from "react-native";
import { errorKey } from "../../src/app/bridge";
import { useTermCourses } from "../../src/app/courses";
import { useFormat, useLang, useT } from "../../src/app/i18n";
import { displayName } from "../../src/app/names";
import { useDone, useHeldBack, useSnoozes } from "../../src/app/snoozes";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../../src/app/store";
import {
  type AlertGroup,
  DEADLINE_REMINDERS,
  type DeadlineReminder,
  NEEDS_AHEAD,
  type NeedsAhead,
  reportSendingOf,
  type Settings,
  type SourceId,
  type UpdateCheckResult,
} from "../../src/core/models";
import { pageName } from "../../src/core/report";
import type { StringKey } from "../../src/core/strings";
import { useParam } from "../src/nav";
import { TargetStepper, useTargets } from "../src/parts/attendance";
import { openReport } from "../src/parts/report";
import { useSignIn, useSignInNote } from "../src/shell/source-status";
import { toast } from "../src/swaps/overlays";
import { Button, Chip, Segmented, Switch } from "../src/ui/controls";
import { Card, LiveDot } from "../src/ui/display";
import { Icons } from "../src/ui/icons";
import { Meta, Page } from "../src/ui/layout";
import { Sheet } from "../src/ui/sheet";
import { Text } from "../src/ui/text";
import { radius, space, useTheme } from "../src/ui/theme";
import { TopBar } from "../src/ui/top-bar";

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

function useReport() {
  const t = useT();
  return (error: unknown) => toast(t(errorKey(error)), "danger");
}

export default function SettingsScreen() {
  const t = useT();
  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const report = useReport();
  const at = useParam("at");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Settings>) => void bridge.invoke("settings.update", patch).catch(report);
  // Opened at a group (the bell's "Atur notifikasi", a course's long-press): scrolled to it once it's laid out.
  const scrollTo = (group: string) => (y: number) => {
    if (at === group) requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }));
  };
  const signOutOfEverything = async () => {
    setBusy(true);
    try {
      await bridge.invoke("auth.signOut", {});
      setConfirming(false);
      router.replace("/");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page testID="screen.settings" header={<TopBar title={t("nav.settings")} />} scrollRef={scroll}>
      <Group title={t("settings.accounts")} note={t("settings.accounts.note")} first>
        <AccountRow source="edunex" who={account ? [displayName(account.name), account.nim] : null} />
        <AccountRow source="six" who={student ? [displayName(student.name), student.program ?? student.nim] : null} />
        <Row label={t("settings.firstScan")} hint={t("settings.firstScan.hint")}>
          <Button
            size="sm"
            label={`${t("settings.firstScan.show")}: ${t("settings.firstScan")}`}
            onPress={() => router.push("/first-scan")}
            testID="action.firstScan"
          >
            {t("settings.firstScan.show")}
          </Button>
        </Row>
        <Row label={t("settings.signOutAll.label")} hint={t("settings.signOutAllHint")}>
          <Button size="sm" variant="danger" onPress={() => setConfirming(true)} testID="action.signOutAll">
            {t("settings.signOutAll")}
          </Button>
        </Row>
      </Group>

      <View onLayout={(event) => scrollTo("alerts")(event.nativeEvent.layout.y)}>
        <AlertSettings settings={settings} update={update} report={report} />
      </View>

      <Group title={t("settings.appearance")}>
        <Row label={t("settings.theme")} stacked>
          <Segmented
            label={t("settings.theme")}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            testID="segment.theme"
            options={[
              { value: "system", label: t("settings.theme.system") },
              { value: "light", label: t("settings.theme.light") },
              { value: "dark", label: t("settings.theme.dark") },
            ]}
          />
        </Row>
        <Row label={t("settings.language")} stacked>
          <Segmented
            label={t("settings.language")}
            value={settings.lang}
            onChange={(lang) => update({ lang })}
            testID="segment.lang"
            options={[
              { value: "id", label: "Indonesia" },
              { value: "en", label: "English" },
            ]}
          />
        </Row>
      </Group>

      <View onLayout={(event) => scrollTo("courseColors")(event.nativeEvent.layout.y)}>
        <CourseColors />
      </View>

      <Group title={t("settings.other")}>
        <Row label={t("settings.needsAhead")} hint={t("settings.needsAhead.hint")} stacked>
          <Segmented
            label={t("settings.needsAhead")}
            value={String(settings.needsAhead)}
            onChange={(days) => update({ needsAhead: Number(days) as NeedsAhead })}
            testID="segment.needsAhead"
            options={NEEDS_AHEAD.map((days) => ({ value: String(days), label: t(`settings.needsAhead.${days}`) }))}
          />
        </Row>
        <AttendanceTargets />
      </Group>

      {store.relay && <ReportSettings settings={settings} update={update} report={report} />}

      <Group title={t("settings.about")} note={t("settings.unofficial")}>
        <About />
        <CheckForUpdates version={store.version} />
        <Row label={t("report.title")} hint={t(store.relay ? "report.settingsHintRelay" : "report.settingsHint")}>
          <Button size="sm" label={t("report.title")} icon={<Icons.Flag size={14} />} onPress={() => openReport({})} testID="action.report">
            {t("report.open")}
          </Button>
        </Row>
        <Row label={t("licences.title")} hint={t("licences.hint")}>
          <Button size="sm" label={t("licences.viewAll")} onPress={() => router.push("/licences")} testID="action.licences">
            {t("licences.view")}
          </Button>
        </Row>
      </Group>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={t("settings.signOutAllConfirm")} testID="sheet.signOutAll">
        <Text size="body" tone="muted">
          {t("settings.signOutAllBody")}
        </Text>
        <View style={{ gap: space[2], marginTop: space[5], marginBottom: space[2] }}>
          <Button variant="danger" size="lg" busy={busy} onPress={() => void signOutOfEverything()} testID="action.signOutAllConfirm">
            {t("settings.signOutAll")}
          </Button>
          <Button size="lg" onPress={() => setConfirming(false)}>
            {t("action.cancel")}
          </Button>
        </View>
      </Sheet>
    </Page>
  );
}

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
      const { shown } = await bridge.invoke("alerts.test", {});
      if (shown) setSent(true);
      else toast(t("mobile.settings.notificationsOff"), "danger");
    } catch (error) {
      report(error);
    } finally {
      setTesting(false);
    }
  };
  const toggleDue = (hours: DeadlineReminder) =>
    update({
      deadlineReminders: DEADLINE_REMINDERS.filter((h) => (h === hours ? !settings.deadlineReminders.includes(h) : settings.deadlineReminders.includes(h))),
    });
  return (
    <Group title={t("settings.alerts")}>
      {ALERT_ROWS.map(({ group, label, hint, six }) => (
        <View key={group}>
          <Row
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
            <Switch value={!settings.mutedAlerts.includes(group)} onChange={(on) => setOn(group, on)} label={t(label)} testID={`switch.alert.${group}`} />
          </Row>
          {/* The deadline row picks its reminder times under it. */}
          {group === "deadline" && (
            <View
              accessibilityLabel={t("settings.alerts.deadlineTimes")}
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingHorizontal: space[4], paddingBottom: space[3] }}
            >
              {DEADLINE_REMINDERS.map((hours) => {
                const on = settings.deadlineReminders.includes(hours);
                return (
                  <Chip key={hours} selected={on} onPress={() => toggleDue(hours)} testID={`chip.due.${hours}`}>
                    {`${on ? "✓ " : ""}${t(DUE_LABEL[hours])}`}
                  </Chip>
                );
              })}
            </View>
          )}
        </View>
      ))}
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
        <Switch
          value={settings.classSoonAlerts}
          onChange={(classSoonAlerts) => update({ classSoonAlerts })}
          label={t("settings.alerts.classSoon")}
          testID="switch.classSoon"
        />
      </Row>
      <Row label={t("settings.alerts.test")} hint={t("settings.alerts.testHint")}>
        <Button size="sm" busy={testing} onPress={() => void test()} testID="action.testAlert">
          {t("settings.alerts.testAction")}
        </Button>
      </Row>
      {sent && <Notice text={t("settings.alerts.testSent")} />}
      <SnoozedReminders report={report} />
    </Group>
  );
}

function Notice({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", gap: space[2], backgroundColor: theme.color.successBg, paddingHorizontal: space[4], paddingVertical: space[3] }}
    >
      <Icons.CheckCircle size={16} color={theme.color.successFg} weight="bold" />
      <Text size="small" tone="success" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** What's put off or marked handled, and the way to bring it all back; only while there is some. */
function SnoozedReminders({ report }: { report: (error: unknown) => void }) {
  const t = useT();
  const { wakeAll } = useSnoozes();
  const { unmarkAll } = useDone();
  const held = useHeldBack();
  const count = held.snoozed.length + held.done.length;
  if (!count) return null;
  return (
    <Row label={t("settings.snoozed", { count })} hint={t("settings.snoozed.hint")}>
      <Button
        size="sm"
        onPress={() => Promise.all([wakeAll(), unmarkAll()]).then(() => toast(t("settings.snoozed.woken"), "success"), report)}
        testID="action.wakeAll"
      >
        {t("settings.snoozed.wakeAll")}
      </Button>
    </Row>
  );
}

/** One system's account: who, its state and last check, and Sign in (again) or Sign out of just that system. */
function AccountRow({ source, who }: { source: SourceId; who: readonly string[] | null }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const bridge = useBridge();
  const status = useStatus(source);
  const report = useReport();
  const { signIn, busy: signingIn } = useSignIn();
  const note = useSignInNote(source);
  const [busy, setBusy] = useState(false);
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
  };
  const needsSignIn = status.state === "signed-out" || status.state === "expired";
  const label = needsSignIn
    ? t(status.state === "expired" ? "settings.signInAgainTo" : "settings.signInTo", { source: name })
    : t("settings.signOutOf", { source: name });
  const checked = status.updatedAt !== null ? f.fromNow(status.updatedAt) : null;
  const state: { text: string; tone: "muted" | "warning" | "success" } =
    needsSignIn && note
      ? { text: note.text, tone: note.slow ? "warning" : "muted" }
      : status.state === "signed-out"
        ? { text: t("settings.notConnected"), tone: "muted" }
        : status.state === "expired"
          ? { text: t("settings.account.expired"), tone: "warning" }
          : status.state === "connecting"
            ? { text: t("status.connecting"), tone: "muted" }
            : status.state === "live"
              ? { text: checked ? t("settings.account.live", { when: checked }) : t("status.live"), tone: "success" }
              : { text: checked ? t("settings.account.stale", { when: checked }) : t(`status.${status.state}`, { source: name }), tone: "warning" };
  return (
    <View style={{ paddingHorizontal: space[4], paddingVertical: space[3], gap: space[3] }} testID={`row.account.${source}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            backgroundColor: source === "six" ? "#0b4ea2" : theme.color.infoBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text size="small" weight="bold" style={{ color: source === "six" ? "#ffffff" : theme.color.infoFg }}>
            {source === "six" ? "SIX" : "E"}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="body" weight="medium">
            {name}
          </Text>
          {who && (
            <Meta size="small" numberOfLines={1}>
              {who}
            </Meta>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            {status.state === "live" && <LiveDot />}
            <Text size="caption" weight="medium" tone={state.tone}>
              {state.text}
            </Text>
          </View>
        </View>
      </View>
      <Button
        size="sm"
        variant={needsSignIn ? "primary" : "secondary"}
        busy={needsSignIn ? signingIn : busy}
        onPress={() => void (needsSignIn ? signIn(source) : signOut())}
        testID={needsSignIn ? `action.signIn.${source}` : `action.signOut.${source}`}
      >
        {label}
      </Button>
    </View>
  );
}

/** The default target, then each course with its own, which can go back to the default. */
function AttendanceTargets() {
  const t = useT();
  const courses = useTermCourses();
  const { target, own, setDefault, setOwn } = useTargets();
  const codes = Object.keys(own).sort();
  const name = (code: string) => {
    const course = courses?.find((one) => one.code === code);
    return course ? `${code} ${course.name}` : code;
  };
  return (
    <>
      <Row label={t("settings.attendance.target")} hint={t(codes.length ? "settings.attendance.targetHintOwn" : "settings.attendance.targetHint")} stacked>
        <TargetStepper value={target} onChange={setDefault} />
      </Row>
      {codes.map((code) => (
        <Row key={code} label={name(code)} hint={t("settings.attendance.own", { code })} stacked>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <TargetStepper value={own[code]!} onChange={(value) => setOwn(code, value)} code={code} />
            <Button size="sm" variant="ghost" label={t("settings.attendance.useDefaultFor", { code })} onPress={() => setOwn(code, null)}>
              {t("settings.attendance.useDefault")}
            </Button>
          </View>
        </Row>
      ))}
    </>
  );
}

/** Each course's color: the row opens the course page, where its color is picked (⋯ in its header). */
function CourseColors() {
  const t = useT();
  const theme = useTheme();
  const courses = useTermCourses();
  if (!courses?.length) return null;
  return (
    <Group title={t("settings.courseColors")} note={t("settings.courseColors.note")}>
      {courses.map((course) => (
        <Row
          key={course.code}
          label={`${course.code} ${course.name}`}
          onPress={() => router.push({ pathname: "/course/[code]", params: { code: course.code, colors: "1" } })}
        >
          <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: theme.course(course.color) }} />
        </Row>
      ))}
    </Group>
  );
}

/** Problem reports, while the app has the maintainer's relay: whether they go by themselves, and what went. */
function ReportSettings({ settings, update, report }: { settings: Settings; update: (patch: Partial<Settings>) => void; report: (error: unknown) => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const bridge = useBridge();
  const sent = useDataset("app.reports")?.sent ?? [];
  const pages = (feeds: readonly string[]) => {
    const names = feeds.map((feed) => pageName(feed, lang)).filter((name): name is string => !!name);
    return names.length ? t("report.settings.page", { page: f.list(names) }) : t("report.settings.noPage");
  };
  return (
    <Group title={t("report.settings.title")} note={t("report.settings.note")}>
      <Row label={t("report.settings.sending")} hint={t("report.settings.sendingHint")} stacked>
        <Segmented
          label={t("report.settings.sending")}
          value={reportSendingOf(settings)}
          onChange={(reportSending) => update({ reportSending, reportAsked: true })}
          options={[
            { value: "auto", label: t("report.settings.auto") },
            { value: "ask", label: t("report.settings.ask") },
            { value: "never", label: t("report.settings.never") },
          ]}
        />
      </Row>
      {sent.map((one) => (
        <Row
          key={`${one.at} ${one.id}`}
          label={pages(one.feeds)}
          hint={<Meta>{[f.dayTime(one.at), t(one.how === "auto" ? "report.settings.byItself" : "report.settings.byYou")]}</Meta>}
        >
          {one.issue ? (
            <Button
              size="sm"
              label={t("report.settings.seeIssue", { number: one.issue.number })}
              icon={<Icons.ArrowUpRight size={14} />}
              onPress={() => void bridge.invoke("report.openIssue", { number: one.issue!.number }).catch(report)}
            >
              {`#${one.issue.number}`}
            </Button>
          ) : (
            <Text size="small" tone="muted">
              {t("report.settings.notFiled")}
            </Text>
          )}
        </Row>
      ))}
    </Group>
  );
}

/** "Periksa pembaruan": GitHub is asked now; a newer version opens its release page to download the APK. */
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
    <Row label={t("settings.version", { version })} hint={answer ?? t("update.checkHint")}>
      {found === "newer" ? (
        <Button
          size="sm"
          variant="primary"
          icon={<Icons.ArrowUpRight size={14} color="#ffffff" />}
          onPress={() => void bridge.invoke("app.openRelease", {}).catch(() => undefined)}
          testID="action.openRelease"
        >
          {t("update.download")}
        </Button>
      ) : (
        <Button size="sm" busy={checking} onPress={() => void check()} testID="action.checkUpdate">
          {t("update.check")}
        </Button>
      )}
    </Row>
  );
}

/** Which app this is, and its own licence. */
function About() {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}>
      <Image source={require("../assets/icon.png")} style={{ width: 40, height: 40 }} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1 }}>
        <Text size="body" weight="semibold">
          Edunex Plus
        </Text>
        <Text size="small" tone="muted">
          {t("settings.openSource")}
        </Text>
      </View>
    </View>
  );
}

/** A group of settings on one card, under its title, with a note under it. */
function Group({ title, note, first = false, children }: { title?: string; note?: string; first?: boolean; children: ReactNode }) {
  return (
    <View style={{ marginTop: first ? 0 : space[6] }}>
      {title && (
        <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2], paddingHorizontal: space[1] }} accessibilityRole="header">
          {title}
        </Text>
      )}
      <Card>
        <Divided>{children}</Divided>
      </Card>
      {note && (
        <Text size="caption" tone="faint" style={{ marginTop: 6, paddingHorizontal: space[1] }}>
          {note}
        </Text>
      )}
    </View>
  );
}

function Divided({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const items = (Array.isArray(children) ? children.flat() : [children]).filter((child) => child !== null && child !== undefined && child !== false);
  return (
    <>
      {items.map((child, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the group's rows, in their order
        <View key={i} style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: theme.color.line } : undefined}>
          {child as ReactNode}
        </View>
      ))}
    </>
  );
}

/** A setting: what it is, when it applies, and its control (beside it, or under it when the choices are long). */
function Row({
  label,
  hint,
  stacked = false,
  onPress,
  children,
}: {
  label: string;
  hint?: ReactNode;
  stacked?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const body = (
    <View style={[{ paddingHorizontal: space[4], paddingVertical: space[3], gap: space[3] }, stacked ? null : { flexDirection: "row", alignItems: "center" }]}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
        <Text size="body">{label}</Text>
        {hint !== undefined &&
          (typeof hint === "string" ? (
            <Text size="small" tone="muted">
              {hint}
            </Text>
          ) : (
            hint
          ))}
      </View>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}
