// The app asking about problem reports (ADR 0014), the phone's src/app/shell/report-ask.tsx: a quiet
// card over the bottom of the screen, above the tabs, only while the app has the maintainer's relay.
// The first time it keeps a problem it asks once whether reports like it should go by themselves
// ("Kirim otomatis", "Tanya tiap kali", "Jangan kirim"); closed, that's "ask each time". In that
// mode, each new problem asks again, with a way to look at its report, which "Kirim langsung" sends
// from. A report that went by itself while the app was open says so, with the box for the Student's
// story. Nothing here sends a report: the engine does, as the Student said (src/engine/report/outbox.ts).
// It stays out of the way of "Laporkan masalah" itself.
import { usePathname } from "expo-router";
import { type ReactNode, useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorKey } from "../../../../src/app/bridge";
import { useLang, useT } from "../../../../src/app/i18n";
import { useBridge, useDataset, useStore } from "../../../../src/app/store";
import type { ReportAsking, ReportSending, SentReport } from "../../../../src/core/models";
import { problemHeading, systemOf } from "../../../../src/core/report";
import type { StringKey } from "../../../../src/core/strings";
import { openReport } from "../../parts/report";
import { Button, IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { ReportSent } from "./sent";

export function ReportAskCard() {
  const store = useStore();
  const reports = useDataset("app.reports");
  const path = usePathname();
  // Reports that went before the app opened were said then.
  const [before] = useState(() => new Set((reports?.sent ?? []).map(sentKey)));
  const [closed, setClosed] = useState<string | null>(null);
  if (path === "/report") return null;
  const asking = store.relay ? reports?.asking : null;
  const fresh = store.relay && !asking ? reports?.sent.find((sent) => sent.how === "auto" && !before.has(sentKey(sent))) : undefined;
  if (asking) return <Asking key={`ask ${asking.feed} ${asking.at}`} asking={asking} />;
  if (fresh && sentKey(fresh) !== closed)
    return (
      <Corner key={`sent ${sentKey(fresh)}`} label={null} onClose={() => setClosed(sentKey(fresh))}>
        <ReportSent id={fresh.id} issue={fresh.issue} />
      </Corner>
    );
  return null;
}

const sentKey = (sent: SentReport) => `${sent.at} ${sent.id}`;

function Asking({ asking }: { asking: ReportAsking }) {
  const t = useT();
  const lang = useLang();
  const theme = useTheme();
  const bridge = useBridge();
  const [pending, setPending] = useState<ReportSending | null>(null);
  const [problem, setProblem] = useState<StringKey | null>(null);
  const heading = problemHeading({ feed: asking.feed, kind: asking.kind, rows: asking.rowsLeftOut }, lang);
  const choose = (reportSending: ReportSending) => {
    if (pending) return;
    setPending(reportSending);
    setProblem(null);
    void bridge
      .invoke("settings.update", { reportSending, reportAsked: true })
      .catch((error: unknown) => setProblem(errorKey(error)))
      .finally(() => setPending(null));
  };
  const close = () => void bridge.invoke("report.dismiss", {}).catch((error: unknown) => setProblem(errorKey(error)));
  const look = () => openReport({ source: systemOf(asking), datasets: asking.datasets.length ? asking.datasets : undefined });
  const said = problem && (
    <Text size="small" tone="danger" style={{ marginTop: space[2] }} accessibilityLiveRegion="assertive">
      {t(problem)}
    </Text>
  );

  if (!asking.first)
    return (
      <Corner label={heading} onClose={close}>
        <Text size="small" tone="muted">
          {t("report.ask.each")}
        </Text>
        <View style={{ flexDirection: "row", marginTop: space[3] }}>
          <Button size="sm" variant="primary" onPress={look} testID="action.reportAskSee">
            {t("report.ask.seeReport")}
          </Button>
        </View>
        {said}
      </Corner>
    );
  return (
    <Corner label={t("report.ask.title")} onClose={close}>
      <Text size="small" tone="muted">
        {heading}. {t("report.ask.body")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
        <Button size="sm" variant="primary" busy={pending === "auto"} onPress={() => choose("auto")} testID="action.reportAskAuto">
          {t("report.ask.auto")}
        </Button>
        <Button size="sm" busy={pending === "ask"} onPress={() => choose("ask")} testID="action.reportAskAsk">
          {t("report.ask.ask")}
        </Button>
        <Button size="sm" variant="ghost" busy={pending === "never"} onPress={() => choose("never")} testID="action.reportAskNever">
          {t("report.ask.never")}
        </Button>
      </View>
      <View style={{ flexDirection: "row", marginTop: space[1], marginLeft: -space[2] }}>
        <Button size="sm" variant="ghost" icon={<Icons.Eye size={14} color={theme.color.muted} />} onPress={look} testID="action.reportAskLook">
          {t("report.ask.see")}
        </Button>
      </View>
      {said}
    </Corner>
  );
}

/** A quiet card over the bottom of the screen, above the tabs: a title (or none), what it says, and a way to close it. */
function Corner({ label, onClose, children }: { label: string | null; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      pointerEvents="box-none"
      style={{ position: "absolute", left: space[3], right: space[3], bottom: insets.bottom + 72, zIndex: 40 }}
    >
      <View
        testID="card.reportAsk"
        accessibilityLabel={label ?? t("report.sentTitle")}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space[2],
          borderRadius: radius.xxl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.color.edge,
          backgroundColor: theme.color.raised,
          padding: space[4],
          elevation: 8,
          shadowColor: "#101828",
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <Text size="body" weight="semibold" style={{ marginBottom: space[1] }} accessibilityRole="header">
              {label}
            </Text>
          )}
          {children}
        </View>
        <View style={{ marginTop: -space[2.5], marginRight: -space[2.5] }}>
          <IconButton label={t("action.close")} onPress={onClose} testID="action.reportAskClose">
            <Icons.X size={16} color={theme.color.muted} />
          </IconButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
