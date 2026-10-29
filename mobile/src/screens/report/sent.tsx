// After a report went to the maintainer's relay (ADR 0014), from "Kirim langsung" or by itself: the
// phone's src/app/report-sent.tsx. It says so, names its public issue and opens it, and takes the
// Student's story, which goes on that issue for anyone to read (said under the box). Also the box
// itself, which "Laporkan masalah" uses for its note.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { useT } from "../../../../src/app/i18n";
import { useBridge } from "../../../../src/app/store";
import type { ReportIssue } from "../../../../src/core/models";
import { MAX_NOTE } from "../../../../src/core/report";
import type { StringKey } from "../../../../src/core/strings";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text, useFieldColors } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

/** Why a story didn't go, in the Student's words. */
const STORY_PROBLEM: Record<"personal" | "gone" | "busy" | "failed", StringKey> = {
  personal: "report.storyPersonal",
  gone: "report.storyGone",
  busy: "report.sendBusy",
  failed: "report.storyFailed",
};

/** A short box for the Student's own words: its question, and what happens to them under it. */
export function NoteField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
  testID?: string;
}) {
  const fieldColors = useFieldColors();
  const c = useTheme().color;
  return (
    <View>
      <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2], paddingHorizontal: space[1] }}>
        {label}
      </Text>
      <TextInput
        {...fieldColors}
        testID={testID}
        multiline
        value={value}
        maxLength={MAX_NOTE}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        accessibilityLabel={label}
        textAlignVertical="top"
        style={{
          minHeight: 72,
          borderWidth: 1,
          borderRadius: radius.lg,
          borderColor: c.fieldEdge,
          backgroundColor: c.surface,
          color: c.fg,
          paddingHorizontal: space[3],
          paddingVertical: space[2.5],
          fontSize: 16,
          lineHeight: 22,
        }}
      />
      {hint && (
        <Text size="caption" tone="faint" style={{ marginTop: space[1.5], paddingHorizontal: space[1] }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

export function ReportSent({ id, issue, duplicate = false }: { id: string | null; issue: ReportIssue | null; duplicate?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const [story, setStory] = useState("");
  const [sending, setSending] = useState(false);
  const [added, setAdded] = useState(false);
  const [problem, setProblem] = useState<StringKey | null>(null);

  const openIssue = (number: number) =>
    void bridge.invoke("report.openIssue", { number }).then(
      () => setProblem(null),
      () => setProblem("report.openIssueFailed"),
    );
  const addStory = async () => {
    if (!id || !story.trim() || sending) return;
    setSending(true);
    setProblem(null);
    try {
      const { result } = await bridge.invoke("report.note", { sent: id, note: story.trim() });
      if (result === "added") setAdded(true);
      else setProblem(STORY_PROBLEM[result]);
    } catch (error) {
      setProblem(errorKey(error, "report.storyFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: space[3] }}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.CheckCircle size={16} color={theme.color.successFg} weight="bold" />
          <Text size="body" weight="semibold" accessibilityRole="header">
            {t("report.sentTitle")}
          </Text>
        </View>
        <Text size="small" tone="muted" style={{ marginTop: 2 }}>
          {issue ? t(duplicate ? "report.sentDuplicate" : "report.sentIssue", { number: issue.number }) : t("report.sentLater")}
        </Text>
      </View>
      {issue && (
        <View style={{ flexDirection: "row" }}>
          <Button size="sm" icon={<Icons.ArrowUpRight size={14} color={theme.color.fg} />} onPress={() => openIssue(issue.number)} testID="action.seeIssue">
            {t("report.seeIssue")}
          </Button>
        </View>
      )}
      {id &&
        (added ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }} accessibilityLiveRegion="polite">
            <Icons.Check size={14} color={theme.color.successFg} weight="bold" />
            <Text size="small" tone="muted">
              {t("report.storyAdded")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: space[2] }}>
            <NoteField
              label={t("report.story")}
              value={story}
              onChange={setStory}
              placeholder={t("report.storyPlaceholder")}
              hint={t("report.storyPublic")}
              testID="input.story"
            />
            <View style={{ flexDirection: "row" }}>
              <Button size="sm" busy={sending} disabled={!story.trim()} onPress={() => void addStory()} testID="action.storySend">
                {t("report.storySend")}
              </Button>
            </View>
          </View>
        ))}
      {problem && (
        <Text size="small" tone="danger" accessibilityLiveRegion="assertive">
          {t(problem)}
        </Text>
      )}
    </View>
  );
}
