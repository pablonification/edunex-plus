// Settings (A6), from the avatar on every tab: the desktop's (src/app/shell/settings.tsx) as Android's
// settings list, with the same words and the same settings. Who's signed in on top, then the groups as
// Material lists: accounts, notifications (Android's own switches), how the app looks (Tema and Bahasa
// pick from a sheet), Beranda, attendance, course colors, problem reports, about, and signing out of
// everything last. What only a computer has is left out: closing to the tray, installing updates (the
// phone shows the version and asks GitHub, D5) and phone alerts through ntfy (A18). A setting that
// can't be saved says so under the top bar, never in a snackbar. `?at=alerts|courseColors` opens it at
// that group.
import { router } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { Image, type ScrollView, View } from "react-native";
import { errorKey } from "../../src/app/bridge";
import { useCourseColorPicks } from "../../src/app/course-colors";
import { useTermCourses } from "../../src/app/courses";
import { useFormat, useLang, useT } from "../../src/app/i18n";
import { displayName, initials } from "../../src/app/names";
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
import { colorName, openCourseColorPicker } from "../src/parts/course-color-picker";
import { NotificationsOff } from "../src/parts/notifications-off";
import { openReport } from "../src/parts/report";
import { usePerfDrawn } from "../src/perf";
import { useSignIn, useSignInNote } from "../src/shell/source-status";
import { toast } from "../src/swaps/overlays";
import { SourceLogo } from "../src/ui/brand";
import { Button, Chip } from "../src/ui/controls";
import { CourseDot, LiveDot } from "../src/ui/display";
import { Icons } from "../src/ui/icons";
import { Meta, Notice, Page } from "../src/ui/layout";
import { ChoiceRow, ErrorBanner, SettingRow, SettingsGroup, SwitchRow } from "../src/ui/settings-list";
import { Sheet } from "../src/ui/sheet";
import { Text } from "../src/ui/text";
import { space, useTheme } from "../src/ui/theme";
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

/** What a failed save says, on the page (ErrorBanner under the top bar). */
type Report = (error: unknown) => void;

export default function SettingsScreen() {
  usePerfDrawn(true);
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const store = useStore();
  const settings = useSettings();
  const at = useParam("at");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const report: Report = (error) => setProblem(t(errorKey(error)));
  const update = (patch: Partial<Settings>) =>
    void bridge.invoke("settings.update", patch).then(
      () => setProblem(null),
      (error: unknown) => report(error),
    );
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
      setConfirming(false);
      report(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      testID="screen.settings"
      header={
        <>
          <TopBar title={t("nav.settings")} />
          {problem && <ErrorBanner text={problem} onClose={() => setProblem(null)} />}
        </>
      }
      scrollRef={scroll}
    >
      <Profile />

      <SettingsGroup title={t("settings.accounts")} note={t("settings.accounts.note")} first>
        <AccountRow source="edunex" report={report} />
        <AccountRow source="six" report={report} />
        <SettingRow
          title={t("settings.firstScan")}
          summary={t("settings.firstScan.hint")}
          onPress={() => router.push("/first-scan")}
          label={`${t("settings.firstScan.show")}: ${t("settings.firstScan")}`}
          testID="action.firstScan"
        />
      </SettingsGroup>

      <View onLayout={(event) => scrollTo("alerts")(event.nativeEvent.layout.y)}>
        <AlertSettings settings={settings} update={update} report={report} />
      </View>

      <SettingsGroup title={t("settings.appearance")}>
        <ChoiceRow
          title={t("settings.theme")}
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          testID="segment.theme"
          choices={[
            { value: "system", label: t("settings.theme.system") },
            { value: "light", label: t("settings.theme.light") },
            { value: "dark", label: t("settings.theme.dark") },
          ]}
        />
        <ChoiceRow
          title={t("settings.language")}
          value={settings.lang}
          onChange={(lang) => update({ lang })}
          testID="segment.lang"
          choices={[
            { value: "id", label: "Indonesia" },
            { value: "en", label: "English" },
          ]}
        />
      </SettingsGroup>

      <SettingsGroup title={t("nav.home")}>
        <ChoiceRow
          title={t("settings.needsAhead")}
          hint={t("settings.needsAhead.hint")}
          value={String(settings.needsAhead)}
          onChange={(days) => update({ needsAhead: Number(days) as NeedsAhead })}
          testID="segment.needsAhead"
          choices={NEEDS_AHEAD.map((days) => ({ value: String(days), label: t(`settings.needsAhead.${days}`) }))}
        />
      </SettingsGroup>

      <SettingsGroup title={t("mobile.settings.attendance")}>
        <AttendanceTargets />
      </SettingsGroup>

      <View onLayout={(event) => scrollTo("courseColors")(event.nativeEvent.layout.y)}>
        <CourseColors />
      </View>

      {store.relay && <ReportSettings settings={settings} update={update} report={report} />}

      <SettingsGroup title={t("settings.about")} note={t("settings.unofficial")}>
        <About />
        <CheckForUpdates version={store.version} />
        <SettingRow
          title={t("report.title")}
          summary={t(store.relay ? "report.settingsHintRelay" : "report.settingsHint")}
          leading={<Icons.Flag size={24} color={theme.color.onSurfaceVariant} />}
          onPress={() => openReport({})}
          testID="action.report"
        />
        <SettingRow
          title={t("licences.title")}
          summary={t("licences.hint")}
          leading={<Icons.BookOpen size={24} color={theme.color.onSurfaceVariant} />}
          onPress={() => router.push("/licences")}
          label={t("licences.viewAll")}
          testID="action.licences"
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          title={t("settings.signOutAll.label")}
          summary={t("settings.signOutAllHint")}
          tone="danger"
          leading={<Icons.LogOut size={24} color={theme.color.error} />}
          onPress={() => setConfirming(true)}
          testID="action.signOutAll"
        />
      </SettingsGroup>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={t("settings.signOutAllConfirm")} testID="sheet.signOutAll">
        <Text size="bodyMedium" tone="muted">
          {t("settings.signOutAllBody")}
        </Text>
        <View style={{ gap: space[2], marginTop: space[6], marginBottom: space[2] }}>
          <Button variant="danger" size="lg" busy={busy} onPress={() => void signOutOfEverything()} testID="action.signOutAllConfirm">
            {t("settings.signOutAll")}
          </Button>
          <Button size="lg" variant="ghost" onPress={() => setConfirming(false)}>
            {t("action.cancel")}
          </Button>
        </View>
      </Sheet>
    </Page>
  );
}

/** Who's signed in: the avatar, the name, the NIM and the program (Edunex's account, else SIX's). */
function Profile() {
  const theme = useTheme();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  if (!name) return null;
  const facts = [account?.nim ?? student?.nim, student?.program].filter(Boolean) as string[];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], paddingHorizontal: space[1], marginBottom: space[6] }} testID="card.profile">
      <View
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.color.primaryContainer, alignItems: "center", justifyContent: "center" }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Text size="titleLarge" tone="onPrimaryContainer">
          {initials(name)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }} accessible>
        <Text size="titleLarge" numberOfLines={2}>
          {displayName(name)}
        </Text>
        {facts.length > 0 && <Meta size="small">{facts}</Meta>}
      </View>
    </View>
  );
}

function AlertSettings({ settings, update, report }: { settings: Settings; update: (patch: Partial<Settings>) => void; report: Report }) {
  const t = useT();
  const bridge = useBridge();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<"sent" | "off" | null>(null);
  const sixOut = useStatus("six").state === "signed-out";
  const setOn = (group: AlertGroup, on: boolean) =>
    update({ mutedAlerts: on ? settings.mutedAlerts.filter((g) => g !== group) : [...settings.mutedAlerts.filter((g) => g !== group), group] });
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
  const toggleDue = (hours: DeadlineReminder) =>
    update({
      deadlineReminders: DEADLINE_REMINDERS.filter((h) => (h === hours ? !settings.deadlineReminders.includes(h) : settings.deadlineReminders.includes(h))),
    });
  const needsSix = (hint: string) =>
    sixOut ? (
      <Meta>
        {hint}
        {t("settings.alerts.needsSix")}
      </Meta>
    ) : (
      hint
    );
  return (
    <SettingsGroup title={t("settings.alerts")} lead={<NotificationsOff />}>
      {ALERT_ROWS.map(({ group, label, hint, six }) => (
        <SwitchRow
          key={group}
          title={t(label)}
          summary={six ? needsSix(t(hint)) : group === "deadline" && !settings.deadlineReminders.length ? t("settings.alerts.deadlineNone") : t(hint)}
          value={!settings.mutedAlerts.includes(group)}
          onChange={(on) => setOn(group, on)}
          testID={`switch.alert.${group}`}
        >
          {/* The deadline row picks its reminder times under it. */}
          {group === "deadline" && (
            <View accessibilityLabel={t("settings.alerts.deadlineTimes")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {DEADLINE_REMINDERS.map((hours) => (
                <Chip key={hours} selected={settings.deadlineReminders.includes(hours)} onPress={() => toggleDue(hours)} testID={`chip.due.${hours}`}>
                  {t(DUE_LABEL[hours])}
                </Chip>
              ))}
            </View>
          )}
        </SwitchRow>
      ))}
      <SwitchRow
        title={t("settings.alerts.classSoon")}
        summary={needsSix(t("settings.alerts.classSoonHint"))}
        value={settings.classSoonAlerts}
        onChange={(classSoonAlerts) => update({ classSoonAlerts })}
        testID="switch.classSoon"
      />
      <SettingRow
        title={t("settings.alerts.test")}
        summary={t("settings.alerts.testHint")}
        trailing={
          <Button size="sm" variant="ghost" busy={testing} onPress={() => void test()} testID="action.testAlert" label={t("settings.alerts.test")}>
            {t("settings.alerts.testAction")}
          </Button>
        }
      >
        {result && (
          <View accessibilityLiveRegion="polite">
            {result === "sent" ? (
              <Notice tone="success" title={t("settings.alerts.testSent")} />
            ) : (
              <Notice tone="danger" title={t("mobile.settings.notificationsOff")} />
            )}
          </View>
        )}
      </SettingRow>
      <SnoozedReminders report={report} />
    </SettingsGroup>
  );
}

/** What's put off or marked handled, and the way to bring it all back; only while there is some. */
function SnoozedReminders({ report }: { report: Report }) {
  const t = useT();
  const { wakeAll } = useSnoozes();
  const { unmarkAll } = useDone();
  const held = useHeldBack();
  const count = held.snoozed.length + held.done.length;
  if (!count) return null;
  return (
    <SettingRow
      title={t("settings.snoozed", { count })}
      summary={t("settings.snoozed.hint")}
      trailing={
        <Button
          size="sm"
          variant="ghost"
          onPress={() => Promise.all([wakeAll(), unmarkAll()]).then(() => toast(t("settings.snoozed.woken"), "success"), report)}
          testID="action.wakeAll"
        >
          {t("settings.snoozed.wakeAll")}
        </Button>
      }
    />
  );
}

/** One system's account: its state and last check, and Sign in (again) or Sign out of just that system. */
function AccountRow({ source, report }: { source: SourceId; report: Report }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const status = useStatus(source);
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
  // The row names the system and its state; the button beside it says only the verb (its accessible name says all of it).
  return (
    <SettingRow
      testID={`row.account.${source}`}
      leading={<SourceLogo source={source} size={40} />}
      title={name}
      summary={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {status.state === "live" && <LiveDot />}
          <Text size="bodyMedium" tone={state.tone} style={{ flexShrink: 1 }}>
            {state.text}
          </Text>
        </View>
      }
      trailing={
        <Button
          size="sm"
          variant={needsSignIn ? "tonal" : "secondary"}
          busy={needsSignIn ? signingIn : busy}
          label={label}
          onPress={() => void (needsSignIn ? signIn(source) : signOut())}
          testID={needsSignIn ? `action.signIn.${source}` : `action.signOut.${source}`}
        >
          {needsSignIn ? t(status.state === "expired" ? "action.signInAgain" : "action.signIn") : t("action.signOut")}
        </Button>
      }
    />
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
      <SettingRow title={t("settings.attendance.target")} summary={t(codes.length ? "settings.attendance.targetHintOwn" : "settings.attendance.targetHint")}>
        <TargetStepper value={target} onChange={setDefault} />
      </SettingRow>
      {codes.map((code) => (
        <SettingRow key={code} title={name(code)} summary={t("settings.attendance.own", { code })}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
            <TargetStepper value={own[code]!} onChange={(value) => setOwn(code, value)} code={code} />
            <Button size="sm" variant="ghost" label={t("settings.attendance.useDefaultFor", { code })} onPress={() => setOwn(code, null)}>
              {t("settings.attendance.useDefault")}
            </Button>
          </View>
        </SettingRow>
      ))}
    </>
  );
}

/**
 * Each course's color, as the desktop's: the course, then its code and whether the color is automatic or the Student's
 * pick (and who shares it); the row opens the same picker as a course page's header. Last, every course back to
 * automatic at once (the snackbar offers Undo).
 */
function CourseColors() {
  const t = useT();
  const f = useFormat();
  const term = useTermCourses();
  const picks = useCourseColorPicks();
  // A code in two classes is one course with one color.
  const courses = (term ?? []).filter((course, index, all) => all.findIndex((other) => other.code === course.code) === index);
  if (!courses.length) return null;
  const picked = courses.filter((course) => course.colorPicked).length;
  return (
    <SettingsGroup title={t("settings.courseColors")} note={t("settings.courseColors.note")}>
      {courses.map((course) => {
        const same = courses.filter((other) => other.code !== course.code && other.colorId === course.colorId).map((other) => other.code);
        const name = colorName(t, course.colorId);
        return (
          <SettingRow
            key={course.code}
            title={course.name}
            label={`${course.name}, ${t("courseColor.current", { code: course.code, color: name })}`}
            summary={
              <Meta>
                {course.code}
                {t(course.colorPicked ? "courseColor.yours" : "courseColor.automatic")}
                {same.length ? t("courseColor.sameAs", { codes: f.list(same) }) : ""}
              </Meta>
            }
            onPress={() => openCourseColorPicker(course.code)}
            testID={`row.courseColor.${course.code}`}
            trailing={
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <CourseDot color={course.color} size={16} />
                <Text size="bodyMedium" tone="muted" numberOfLines={1}>
                  {name}
                </Text>
              </View>
            }
          />
        );
      })}
      {picked > 0 ? (
        <SettingRow
          title={t("settings.courseColors.reset")}
          summary={t("settings.courseColors.allHint", { count: picked })}
          onPress={() => void picks.resetAll(courses.map((course) => course.code))}
          testID="action.resetCourseColors"
        />
      ) : (
        <SettingRow title={t("settings.courseColors.all")} summary={t("settings.courseColors.allAuto")} />
      )}
    </SettingsGroup>
  );
}

/** Problem reports, while the app has the maintainer's relay: whether they go by themselves, and what went. */
function ReportSettings({ settings, update, report }: { settings: Settings; update: (patch: Partial<Settings>) => void; report: Report }) {
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
    <SettingsGroup title={t("report.settings.title")} note={t("report.settings.note")}>
      <ChoiceRow
        title={t("report.settings.sending")}
        hint={t("report.settings.sendingHint")}
        value={reportSendingOf(settings)}
        onChange={(reportSending) => update({ reportSending, reportAsked: true })}
        testID="segment.reportSending"
        choices={[
          { value: "auto", label: t("report.settings.auto") },
          { value: "ask", label: t("report.settings.ask") },
          { value: "never", label: t("report.settings.never") },
        ]}
      />
      {sent.map((one) => (
        <SettingRow
          key={`${one.at} ${one.id}`}
          title={pages(one.feeds)}
          summary={<Meta>{[f.dayTime(one.at), t(one.how === "auto" ? "report.settings.byItself" : "report.settings.byYou")]}</Meta>}
          trailing={
            one.issue ? (
              <Button
                size="sm"
                variant="ghost"
                label={t("report.settings.seeIssue", { number: one.issue.number })}
                icon={<Icons.ArrowUpRight size={14} />}
                onPress={() => void bridge.invoke("report.openIssue", { number: one.issue!.number }).catch(report)}
              >
                {`#${one.issue.number}`}
              </Button>
            ) : (
              <Text size="bodyMedium" tone="muted">
                {t("report.settings.notFiled")}
              </Text>
            )
          }
        />
      ))}
    </SettingsGroup>
  );
}

/** "Periksa pembaruan": GitHub is asked now; a newer version opens its release page to download the APK. */
function CheckForUpdates({ version }: { version: string }) {
  const t = useT();
  const theme = useTheme();
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
    <SettingRow
      title={t("settings.version", { version })}
      summary={
        <Text size="bodyMedium" tone="muted" accessibilityLiveRegion="polite">
          {answer ?? t("update.checkHint")}
        </Text>
      }
      leading={<Icons.RefreshCw size={24} color={theme.color.onSurfaceVariant} />}
      trailing={
        found === "newer" ? (
          <Button
            size="sm"
            variant="tonal"
            icon={<Icons.ArrowUpRight size={14} color={theme.color.onSecondaryContainer} />}
            onPress={() => void bridge.invoke("app.openRelease", {}).catch(() => undefined)}
            testID="action.openRelease"
          >
            {t("update.download")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" busy={checking} label={t("update.check")} onPress={() => void check()} testID="action.checkUpdate">
            {t("mobile.update.checkShort")}
          </Button>
        )
      }
    />
  );
}

/** Which app this is, and its own licence. */
function About() {
  const t = useT();
  return (
    <SettingRow
      leading={<Image source={require("../assets/icon.png")} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityIgnoresInvertColors />}
      title={
        <Text size="bodyLarge" weight="semibold">
          Edunex Plus
        </Text>
      }
      summary={t("settings.openSource")}
    />
  );
}
