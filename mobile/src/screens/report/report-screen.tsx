// "Laporkan masalah" (ADR 0007) as a screen: the desktop's dialog (src/app/shell/report-dialog.tsx),
// the same steps in one column. First what goes to the app's maintainer, said plainly before anything
// does (what went wrong and on which page, that the page goes along with the Student's details taken
// out, the app and the phone's system; the engine's own words and the page itself in a folded
// technical part), an optional note, and the ways to send it: "Kirim langsung" first when the app has
// the maintainer's relay (ADR 0014), then LINE and GitHub. Kirim sends it at once and says so, with a
// box for the Student's story; LINE and GitHub go step by step, one thing to do at a time. The phone's
// way: the report's file goes out through the share sheet instead of a folder, and LINE's ID is looked
// up in LINE on this phone instead of a QR code scanned with it.
import * as Clipboard from "expo-clipboard";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { useFormat, useLang, useT } from "../../../../src/app/i18n";
import { useBridge, useSettings, useStore } from "../../../../src/app/store";
import type { ActionOutput } from "../../../../src/core/contract";
import { MAINTAINER_LINE } from "../../../../src/core/links";
import { type ReportImpact, reportSendingOf } from "../../../../src/core/models";
import { pageLabel, problemHeading, type ReportPreview } from "../../../../src/core/report";
import type { StringKey } from "../../../../src/core/strings";
import { useNav } from "../../nav";
import { BottomBar } from "../../parts/bottom-bar";
import { type ReportAsk, useReportAsk } from "../../parts/report";
import { toast } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { Card, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta, Notice, Page } from "../../ui/layout";
import { Text } from "../../ui/text";
import { font, radius, space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { AppMark, GitHubMark, LineLogo } from "./marks";
import { NoteField, ReportSent } from "./sent";

type Via = "line" | "github";
type Saved = { name: string; bytes: number } | null;
type Sent = Extract<ActionOutput<"report.send">, { result: "filed" | "stored" }>;

/** Why "Kirim" didn't send it, in the Student's words. */
const NOT_SENT: Record<Exclude<ActionOutput<"report.send">["result"], Sent["result"]>, StringKey> = {
  personal: "report.sendPersonal",
  "too-big": "report.sendTooBig",
  busy: "report.sendBusy",
  failed: "report.sendFailed",
};

/** Opened without an ask (the app came back on this screen): a report about nothing in particular, as from Settings. */
const SETTINGS_ASK: ReportAsk = { about: {}, at: 0 };

export function ReportScreen() {
  const t = useT();
  const nav = useNav();
  const bridge = useBridge();
  const ask = useReportAsk() ?? SETTINGS_ASK;
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<Via | "relay" | null>(null);
  const [chosen, setChosen] = useState<{ via: Via; file: Saved } | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  /** Why "Kirim langsung" didn't send it, said beside the ways (and the other two still there). */
  const [notSent, setNotSent] = useState<StringKey | null>(null);
  const relay = useStore().relay;
  const settings = useSettings();
  const auto = relay && reportSendingOf(settings) === "auto";

  // Each ask is a fresh report: what the app has kept now, scrubbed now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is "Coba lagi"; it changing is what asks again
  useEffect(() => {
    let current = true;
    setPreview(null);
    setFailed(false);
    setNote("");
    setChosen(null);
    setSent(null);
    setNotSent(null);
    bridge.invoke("report.preview", ask.about).then(
      (report) => current && setPreview(report),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [ask, bridge, attempt]);

  // "Kirim langsung": the report shown, with the note, to the maintainer's relay.
  const send = async () => {
    if (!preview) return;
    setSaving("relay");
    setNotSent(null);
    try {
      const answer = await bridge.invoke("report.send", { id: preview.id, note });
      if (answer.result === "filed" || answer.result === "stored") setSent(answer);
      else setNotSent(NOT_SENT[answer.result]);
    } catch (error) {
      setNotSent(errorKey(error, "report.sendFailed"));
    } finally {
      setSaving(null);
    }
  };

  const choose = async (via: Via) => {
    if (!preview) return;
    setSaving(via);
    try {
      setChosen({ via, file: (await bridge.invoke("report.save", { id: preview.id, via, note })).file });
    } catch {
      toast(t("report.saveFailed"), "danger");
    } finally {
      setSaving(null);
    }
  };

  const done = () => nav.back();

  if (chosen && preview)
    // "Kembali": to what's sent, to read it again or take the other way; the note stays.
    return <Steps preview={preview} note={note} {...chosen} onBack={() => setChosen(null)} onDone={done} />;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Page testID="screen.report" header={<TopBar title={t("report.title")} />}>
        {failed ? (
          <Notice
            tone="danger"
            title={t("report.failed")}
            action={
              <Button size="sm" onPress={() => setAttempt((n) => n + 1)} testID="action.tryAgain">
                {t("action.tryAgain")}
              </Button>
            }
          />
        ) : !preview ? (
          <View style={{ gap: space[3] }}>
            <Skeleton height={40} />
            <Skeleton height={160} />
            <Skeleton height={72} />
          </View>
        ) : sent ? (
          <ReportSent id={sent.id} issue={sent.issue} duplicate={sent.duplicate} />
        ) : (
          <View style={{ gap: space[6] }}>
            <Text size="body" tone="muted">
              {t(auto ? "report.leadAuto" : "report.lead")}
            </Text>
            <WhatsSent preview={preview} />
            <NoteField
              label={t("report.note")}
              value={note}
              onChange={setNote}
              placeholder={t("report.notePlaceholder")}
              hint={relay ? t("report.notePublic") : undefined}
              testID="input.note"
            />
            <View>
              <Label>{t("report.how")}</Label>
              {notSent && (
                <View style={{ marginBottom: space[3] }}>
                  <Notice tone="danger" title={t(notSent)} />
                </View>
              )}
              {/* With the relay, one press first. Then LINE, since most Students have it and fewer have GitHub. */}
              <View style={{ gap: space[3] }}>
                {relay && (
                  <Way
                    logo={<AppMark size={32} />}
                    label={t("report.relay")}
                    hint={t("report.relayHint")}
                    busy={saving === "relay"}
                    disabled={saving !== null}
                    onPress={() => void send()}
                    testID="action.reportRelay"
                  />
                )}
                <Way
                  logo={<LineLogo size={32} />}
                  label={t("report.line")}
                  hint={t("report.lineHint", { id: MAINTAINER_LINE.id })}
                  busy={saving === "line"}
                  disabled={saving !== null}
                  onPress={() => void choose("line")}
                  testID="action.reportLine"
                />
                <Way
                  logo={<GitHubMarkInk />}
                  label={t("report.github")}
                  hint={t("report.githubHint")}
                  busy={saving === "github"}
                  disabled={saving !== null}
                  onPress={() => void choose("github")}
                  testID="action.reportGitHub"
                />
              </View>
            </View>
          </View>
        )}
      </Page>
      {sent && (
        <BottomBar>
          <Button variant="primary" size="lg" onPress={done} style={{ flex: 1 }} testID="action.reportDone">
            {t("report.done")}
          </Button>
        </BottomBar>
      )}
    </KeyboardAvoidingView>
  );
}

function GitHubMarkInk() {
  return <GitHubMark size={30} color={useTheme().color.fg} />;
}

/** A small heading over a part of the screen. */
function Label({ children }: { children: string }) {
  return (
    <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2], paddingHorizontal: space[1] }} accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * Each problem in a sentence, that its page goes along without the Student's details, that what the
 * app did goes too, the app and the system; the technical part folded away: the engine's own words,
 * how the scrubbed page reads again, what it cost, the rows as the page wrote them, the pages
 * themselves and the app's log, all exactly as they go.
 */
function WhatsSent({ preview }: { preview: ReportPreview }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const theme = useTheme();
  const [technical, setTechnical] = useState(false);
  const { report } = preview;
  const log = report.log ?? [];
  const part = { paddingHorizontal: space[4], paddingVertical: space[3] };
  const rule = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line };
  return (
    <View>
      <Label>{t("report.sent")}</Label>
      <Card>
        {report.problems.map((problem, i) => (
          <View key={problem.feed} style={[part, { gap: space[1.5] }, i > 0 && rule]}>
            <Text size="body" weight="medium">
              {problemHeading(problem, lang)}
            </Text>
            {problem.kind === "skipped" &&
              problem.rows.map((row) => (
                <Text key={`${row.row} ${row.why}`} size="small" tone="muted">
                  {row.row}
                </Text>
              ))}
            {problem.pages.length > 0 && (
              <Text size="small" tone="muted">
                {t("report.pageGoes")}
              </Text>
            )}
          </View>
        ))}
        {report.problems.length === 0 && (
          <Text size="small" tone="muted" style={part}>
            {t("mobile.report.nothingKept")}
          </Text>
        )}
        {log.length > 0 && (
          <Text size="small" tone="muted" style={[part, rule]}>
            {t("report.logGoes")}
          </Text>
        )}
        <Text size="small" tone="muted" style={[part, rule]}>
          {t("report.app", { version: report.version, os: preview.os })}
        </Text>
        {(report.problems.length > 0 || log.length > 0) && (
          <View style={[{ paddingHorizontal: space[2], paddingVertical: space[1.5] }, rule]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: technical }}
              onPress={() => setTechnical(!technical)}
              hitSlop={4}
              style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44, paddingHorizontal: space[2] }}
              testID="action.reportDetails"
            >
              <View style={{ transform: [{ rotate: technical ? "90deg" : "0deg" }] }}>
                <Icons.ChevronRight size={14} color={theme.color.muted} />
              </View>
              <Text size="small" weight="semibold" tone="muted">
                {t("report.details")}
              </Text>
            </Pressable>
            {technical && (
              <View style={{ gap: space[3], paddingHorizontal: space[2], paddingTop: space[1.5], paddingBottom: space[2] }}>
                {report.problems.map((problem) => (
                  <View key={problem.feed} style={{ gap: space[2] }}>
                    {(problem.kind === "changed" ? [problem.check] : problem.rows.map((row) => row.why)).map((line) => (
                      <Text key={line} size="caption" tone="muted" style={{ fontFamily: font.mono }}>
                        {line}
                      </Text>
                    ))}
                    {problem.reproduces && (
                      <Text size="caption" tone="muted">
                        {t(`report.reproduces.${problem.reproduces}`)}
                      </Text>
                    )}
                    {problem.impact && <Impact impact={problem.impact} />}
                    {problem.cells?.map((cell) => (
                      <View key={cell.row}>
                        <Text size="caption" tone="faint" style={{ fontFamily: font.mono, marginBottom: space[1] }}>
                          {t("report.cell", { shape: cell.shape })}
                        </Text>
                        {cell.html && <Code>{[cell.header, cell.html].filter(Boolean).join("\n")}</Code>}
                      </View>
                    ))}
                    {problem.pages.map((page) => (
                      <View key={page.path}>
                        <Text size="caption" tone="faint" style={{ fontFamily: font.mono, marginBottom: space[1] }}>
                          {pageLabel(page.path)}
                        </Text>
                        <Code>{page.body}</Code>
                      </View>
                    ))}
                  </View>
                ))}
                {log.length > 0 && (
                  <View>
                    <Text size="caption" tone="faint" style={{ marginBottom: space[1] }}>
                      {t("report.log")}
                    </Text>
                    <Code>{log.map((entry) => `${f.time(entry.at)}  ${entry.level}  ${entry.area}  ${entry.message}`).join("\n")}</Code>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </Card>
    </View>
  );
}

/** Technical text as it goes: the engine's lines, the page's markup. Long pages scroll in their own box. */
function Code({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={{ maxHeight: 224, borderRadius: radius.lg, backgroundColor: theme.color.fill, overflow: "hidden" }}>
      <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: space[3] }}>
        <Text size="caption" selectable style={{ fontFamily: font.mono }}>
          {children}
        </Text>
      </ScrollView>
    </View>
  );
}

/** What a problem cost: what it touched, the rows it left out or left blank, when that data last read whole. */
function Impact({ impact }: { impact: ReportImpact }) {
  const t = useT();
  const f = useFormat();
  return (
    <Meta size="caption">
      {[
        impact.datasets.join(", "),
        impact.rowsLeftOut > 0 && t("report.impact.rows", { count: impact.rowsLeftOut }),
        impact.detailsBlank > 0 && t("report.impact.blank", { count: impact.detailsBlank }),
        impact.lastGoodAt === null ? t("report.impact.neverGood") : t("report.impact.lastGood", { when: f.dayTime(impact.lastGoodAt) }),
      ]}
    </Meta>
  );
}

/** One way to send it, as one big button: the service's own mark, its name and who reads it there, and a round arrow. */
function Way({
  logo,
  label,
  hint,
  busy,
  disabled,
  onPress,
  testID,
}: {
  logo: ReactNode;
  label: string;
  hint: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.color;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      accessibilityState={{ disabled, busy }}
      onPress={disabled ? undefined : onPress}
      android_ripple={{ color: c.selected, foreground: true }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space[3.5],
        padding: space[4],
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.edge,
        backgroundColor: c.surface,
        overflow: "hidden",
        opacity: disabled && !busy ? 0.6 : 1,
        elevation: theme.scheme === "dark" ? 0 : 1,
        transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
      })}
    >
      {/* The marks keep their own room: nothing touches them. */}
      <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator size="small" color={c.muted} /> : logo}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="body" weight="semibold">
          {label}
        </Text>
        <Text size="small" tone="muted" style={{ marginTop: 2 }}>
          {hint}
        </Text>
      </View>
      <View style={{ width: 32, height: 32, borderRadius: 16, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: c.fill }}>
        <Icons.ArrowRight size={16} color={c.fg} weight="bold" />
      </View>
    </Pressable>
  );
}

interface Step {
  title: string;
  hint?: string;
  done?: boolean;
  body?: ReactNode;
}

/**
 * The chosen way, step by step: the file is ready (shown as a file), then what's left for the
 * Student, one thing at a time. On LINE: add the maintainer (their ID, searched in LINE on this
 * phone), then share the file into that chat. On GitHub: open the issue, filled in, then attach the
 * file, saved first through the share sheet. The one primary button is the step's own action;
 * "Selesai" waits at the bottom.
 */
function Steps({
  preview,
  note,
  via,
  file,
  onBack,
  onDone,
}: {
  preview: ReportPreview;
  note: string;
  via: Via;
  file: Saved;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const [opened, setOpened] = useState(false);
  const [shared, setShared] = useState(false);
  const id = MAINTAINER_LINE.id;
  const line = via === "line";
  // Android's Back is "Kembali" here too: back to what's sent, the note kept.
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [onBack]);

  const openGitHub = () =>
    void bridge.invoke("report.open", { id: preview.id, note }).then(
      () => setOpened(true),
      () => toast(t("report.openFailed", { place: "GitHub" }), "danger"),
    );
  const share = () =>
    void bridge.invoke("report.reveal", { id: preview.id }).then(
      () => setShared(true),
      () => toast(t("mobile.report.shareFailed"), "danger"),
    );
  const copyId = () =>
    void Clipboard.setStringAsync(id).then(
      () => toast(t("mobile.report.idCopied", { id }), "success"),
      () => undefined,
    );
  const shareButton = (
    <Button
      variant={shared ? "secondary" : "primary"}
      icon={<Icons.Upload size={16} color={shared ? theme.color.fg : theme.color.onAccent} />}
      onPress={share}
      testID="action.reportShare"
    >
      {t("mobile.report.share")}
    </Button>
  );

  const steps: Step[] = [];
  if (file) steps.push({ title: t("mobile.report.ready"), done: true, body: <FileItem file={file} /> });
  if (line) {
    steps.push({
      title: t("report.lineAdd", { id }),
      hint: t("mobile.report.lineAddHint", { id }),
      body: (
        <Button size="sm" icon={<Icons.Link size={14} color={theme.color.fg} />} onPress={copyId} testID="action.copyLineId">
          {t("mobile.report.copyId")}
        </Button>
      ),
    });
    steps.push({ title: t("report.lineSend", { id }), hint: t("mobile.report.lineSendHint", { id }), body: shareButton });
  } else {
    steps.push({
      title: t("report.githubOpen"),
      hint: t("report.githubOpenHint"),
      done: opened,
      body: opened ? (
        <Button size="sm" onPress={openGitHub} testID="action.githubOpenAgain">
          {t("report.openAgain")}
        </Button>
      ) : (
        <Button variant="primary" onPress={openGitHub} testID="action.githubOpen">
          {t("report.githubOpenButton")}
        </Button>
      ),
    });
    if (file) steps.push({ title: t("mobile.report.githubAttach"), hint: t("mobile.report.githubAttachHint"), body: opened ? shareButton : undefined });
    else steps.push({ title: t("report.githubSubmit") });
  }

  return (
    <View style={{ flex: 1 }}>
      <Page testID="screen.report" header={<TopBar title={t("report.title")} onBack={onBack} />}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2.5], marginBottom: space[6] }}>
          {line ? <LineLogo size={24} /> : <GitHubMark size={24} color={theme.color.fg} />}
          <Text size="title" weight="semibold" accessibilityRole="header">
            {line ? t("report.line") : t("report.github")}
          </Text>
        </View>
        <View style={{ gap: space[5] }}>
          {steps.map((step, i) => (
            <View key={step.title} style={{ flexDirection: "row", gap: space[3.5] }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: step.done ? theme.color.successBg : theme.color.fill,
                }}
              >
                {step.done ? (
                  <Icons.Check size={14} color={theme.color.successFg} weight="bold" />
                ) : (
                  <Text size="small" weight="semibold" tabular>
                    {String(i + 1)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <Text
                  size="body"
                  weight="medium"
                  tone={step.done ? "muted" : "fg"}
                  accessibilityLabel={step.done ? `${step.title}, ${t("report.stepDone")}` : undefined}
                >
                  {step.title}
                </Text>
                {step.hint && (
                  <Text size="small" tone="muted" style={{ marginTop: 2 }}>
                    {step.hint}
                  </Text>
                )}
                {step.body && <View style={{ marginTop: space[2.5], flexDirection: "row" }}>{step.body}</View>}
              </View>
            </View>
          ))}
        </View>
      </Page>
      <BottomBar>
        <Button size="lg" onPress={onBack} style={{ flex: 1 }} testID="action.back.report">
          {t("action.back")}
        </Button>
        <Button variant={line || opened ? "primary" : "secondary"} size="lg" onPress={onDone} style={{ flex: 1 }} testID="action.reportDone">
          {t("report.done")}
        </Button>
      </BottomBar>
    </View>
  );
}

/** The report as a file: its name and size. */
function FileItem({ file }: { file: NonNullable<Saved> }) {
  const f = useFormat();
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.color.line,
        backgroundColor: theme.color.surface,
        paddingHorizontal: space[3],
        paddingVertical: space[2.5],
      }}
    >
      <Icons.FileText size={20} color={theme.color.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="small" weight="medium" numberOfLines={1}>
          {file.name}
        </Text>
        <Text size="caption" tone="muted" tabular>
          {f.fileSize(file.bytes)}
        </Text>
      </View>
    </View>
  );
}
