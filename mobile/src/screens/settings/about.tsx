// Settings' last groups. Laporan masalah (only while the app has the maintainer's relay): whether reports go by
// themselves, picked in a sheet, then each report sent. Tentang: the app and its licence, the version (the row asks
// GitHub now; a newer one turns the row into its download), the tour again ("Panduan aplikasi"), on an iPhone the Live
// Activity's preview ("Coba Aktivitas Langsung"), Laporkan masalah, the open-source licences, and the line
// saying this isn't ITB's app. Last, in its own card in the danger colour: signing out of everything, confirmed in a
// sheet that says what goes.
import { router } from "expo-router";
import { useState } from "react";
import { Image, Platform, View } from "react-native";
import { useFormat, useLang, useT } from "../../../../src/app/i18n";
import { useBridge, useDataset, useUpdateInstall } from "../../../../src/app/store";
import { reportSendingOf, type Settings, type UpdateCheckResult } from "../../../../src/core/models";
import { pageName } from "../../../../src/core/report";
import { previewIosLive } from "../../host/widget-ios";
import { openReport } from "../../parts/report";
import { startGuide } from "../../shell/guide/state";
import { Button } from "../../ui/controls";
import { Pill } from "../../ui/group";
import { factsLabel } from "../../ui/layout";
import { Chevron, ChoiceRow, haptic, SettingRow, SettingsGroup, SheetTitle } from "../../ui/settings-list";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import type { Report, Update } from "./save";

/** Problem reports, while the app has the maintainer's relay: whether they go by themselves, and what went. */
export function ReportSettings({ settings, update, report }: { settings: Settings; update: Update; report: Report }) {
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
    <SettingsGroup title={t("report.settings.title")}>
      <ChoiceRow
        title={t("report.settings.sending")}
        note={`${t("report.settings.sendingHint")} ${t("report.settings.note")}`}
        value={reportSendingOf(settings)}
        onChange={(reportSending) => update({ reportSending, reportAsked: true })}
        testID="segment.reportSending"
        choices={[
          { value: "auto", label: t("report.settings.auto") },
          { value: "ask", label: t("report.settings.ask") },
          { value: "never", label: t("report.settings.never") },
        ]}
      />
      {sent.map((one) => {
        const issue = one.issue;
        const how = t(one.how === "auto" ? "report.settings.byItself" : "report.settings.byYou");
        return (
          <SettingRow
            key={`${one.at} ${one.id}`}
            title={pages(one.feeds)}
            meta={factsLabel(f.dayTime(one.at), how)}
            label={factsLabel(
              pages(one.feeds),
              f.dayTime(one.at),
              how,
              issue ? t("report.settings.seeIssue", { number: issue.number }) : t("report.settings.notFiled"),
            )}
            onPress={issue ? () => void bridge.invoke("report.openIssue", { number: issue.number }).catch(report) : undefined}
            role="link"
            trailing={issue ? <Pill tone="brand">{`#${issue.number}`}</Pill> : undefined}
          />
        );
      })}
    </SettingsGroup>
  );
}

/** Tentang: the app, its version, Laporkan masalah, the licences; under the card, that it isn't ITB's. */
export function AboutSettings({ version, relay }: { version: string; relay: boolean }) {
  const t = useT();
  return (
    <SettingsGroup title={t("settings.about")} note={t("settings.unofficial")}>
      {/* The app's own icon at the row's end: every row of Settings starts its words at the same edge. */}
      <SettingRow
        title="Edunex Plus"
        meta={t("settings.openSource")}
        trailing={<Image source={require("../../../assets/icon.png")} style={{ width: 40, height: 40, borderRadius: 12 }} accessibilityIgnoresInvertColors />}
      />
      <CheckForUpdates version={version} />
      {/* What the app found the first time it read Edunex and SIX: about the app, not an account (round 1's council). */}
      <SettingRow
        title={t("mobile.settings.firstFound")}
        onPress={() => router.push("/first-scan")}
        label={`${t("settings.firstScan.show")}: ${t("mobile.settings.firstFound")}`}
        hint={t("settings.firstScan.hint")}
        trailing={<Chevron />}
        testID="action.firstScan"
      />
      {/* The tour again, whenever the Student wants it (the desktop's row, in the same place). */}
      <SettingRow title={t("settings.guide")} hint={t("settings.guide.hint")} onPress={() => startGuide()} trailing={<Chevron />} testID="action.guide" />
      {Platform.OS === "ios" && <LivePreviewRow />}
      <SettingRow
        title={t("report.title")}
        hint={t(relay ? "report.settingsHintRelay" : "report.settingsHint")}
        onPress={() => openReport({})}
        trailing={<Chevron />}
        testID="action.report"
      />
      <SettingRow
        title={t("licences.title")}
        label={t("licences.viewAll")}
        hint={t("licences.hint")}
        onPress={() => router.push("/licences")}
        trailing={<Chevron />}
        testID="action.licences"
      />
    </SettingsGroup>
  );
}

/**
 * "Versi …": the row asks GitHub now (Periksa pembaruan). With a newer version out (found now or by the daily check),
 * Android downloads it with its progress on the row and opens its installer ("Unduh & pasang", ../../host/apk-update.ts);
 * an iPhone, which can't install an app itself, opens the release page.
 */
function CheckForUpdates({ version }: { version: string }) {
  const t = useT();
  const bridge = useBridge();
  const update = useDataset("app.update");
  const install = useUpdateInstall();
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
  const title = t("settings.version", { version });
  if (!update) {
    const answer = found && found !== "newer" ? t(`update.checked.${found}`) : null;
    return (
      <SettingRow
        title={title}
        meta={<Line>{answer ?? t("update.checkHint")}</Line>}
        label={factsLabel(title, answer ?? t("update.checkHint"), t("update.check"))}
        busy={checking}
        onPress={() => void check()}
        testID="action.checkUpdate"
      />
    );
  }
  // A download of an older notice's version doesn't count for this one.
  const step = !install.blocked && install.version === update.version ? install.step : "idle";
  const percent = Math.round((install.progress ?? 0) * 100);
  const meta =
    step === "downloading"
      ? install.progress === null
        ? t("update.downloading", { version: update.version })
        : t("update.progress", { percent })
      : step === "ready"
        ? t("mobile.update.ready", { version: update.version })
        : step === "failed" && install.problem
          ? t(`update.problem.${install.problem}`)
          : t("update.checked.newer", { version: update.version });
  const action = install.blocked
    ? t("update.download")
    : step === "ready"
      ? t("mobile.update.install")
      : step === "failed"
        ? t("update.retry")
        : step === "downloading"
          ? null
          : t("update.install");
  const press = () => {
    if (install.blocked) void bridge.invoke("app.openRelease", {}).catch(() => undefined);
    else if (step === "ready") void bridge.invoke("app.installUpdate", {}).catch(() => undefined);
    else if (step !== "downloading") void bridge.invoke("app.downloadUpdate", {}).catch(() => undefined);
  };
  return (
    <SettingRow
      title={title}
      meta={<Line>{meta}</Line>}
      label={factsLabel(title, meta, action ?? "")}
      busy={step === "downloading"}
      onPress={press}
      trailing={action ? <Pill tone="brand">{action}</Pill> : undefined}
      testID={install.blocked ? "action.openRelease" : step === "ready" ? "action.installUpdate" : "action.downloadUpdate"}
    />
  );
}

/**
 * "Coba Aktivitas Langsung" (iPhone only): starts the class's Live Activity with a made-up class, to look at on the
 * Lock Screen and in the Dynamic Island. Its line says until when it runs, or that iOS has Live Activities off.
 */
function LivePreviewRow() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const [starting, setStarting] = useState(false);
  const [said, setSaid] = useState<{ text: string; ok: boolean } | null>(null);
  const start = async () => {
    setStarting(true);
    setSaid(null);
    const result = await previewIosLive(lang);
    if (result.started) haptic.confirm();
    setSaid(
      result.started
        ? { text: t("mobile.livePreview.started", { time: f.time(result.until) }), ok: true }
        : { text: t(result.why === "off" ? "mobile.livePreview.off" : "mobile.livePreview.failed"), ok: false },
    );
    setStarting(false);
  };
  return (
    <SettingRow
      title={t("mobile.livePreview.title")}
      meta={said ? <Line tone={said.ok ? "ok" : "red"}>{said.text}</Line> : undefined}
      label={`${t("settings.guide.start")}: ${t("mobile.livePreview.title")}`}
      hint={t("mobile.livePreview.hint")}
      busy={starting}
      onPress={() => void start()}
      testID="action.livePreview"
    />
  );
}

/** A meta line read out when it changes (what the check found, what a tried action did). */
function Line({ children, tone = "muted" }: { children: string; tone?: "muted" | "ok" | "red" }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyMedium" accessibilityLiveRegion="polite" style={{ color: tone === "ok" ? v.okFg : tone === "red" ? v.redFg : v.muted }}>
      {children}
    </Text>
  );
}

/** "Keluar dari semua akun", in its own card, confirmed in a sheet that says what goes for good. */
export function SignOutAll({ report }: { report: Report }) {
  const t = useT();
  const v = useTheme().v4;
  const bridge = useBridge();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await bridge.invoke("auth.signOut", {});
      haptic.confirm();
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
    <>
      <SettingsGroup>
        <SettingRow
          title={t("settings.signOutAll.label")}
          tone="danger"
          hint={t("settings.signOutAllHint")}
          onPress={() => setConfirming(true)}
          testID="action.signOutAll"
        />
      </SettingsGroup>
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={<SheetTitle>{t("settings.signOutAllConfirm")}</SheetTitle>}
        background={v.card}
        testID="sheet.signOutAll"
      >
        <Text size="bodyMedium" style={{ color: v.fg2 }}>
          {t("settings.signOutAllBody")}
        </Text>
        <View style={{ gap: space[2], marginTop: space[6], marginBottom: space[2] }}>
          <Button variant="danger" size="lg" busy={busy} onPress={() => void signOut()} testID="action.signOutAllConfirm">
            {t("settings.signOutAll")}
          </Button>
          <Button size="lg" variant="ghost" onPress={() => setConfirming(false)}>
            {t("action.cancel")}
          </Button>
        </View>
      </Sheet>
    </>
  );
}
