// The comments under the Student's answer on the phone: src/app/screens/tasks.tsx's Thread, Message and CommentBox in
// one white card under Jawabanmu. Oldest first, the lecturer marked "Dosen", the Student as "Kamu", each with its day
// and time, its words and its files; then a line to write back, which opens a plain box with Batal and Kirim. Read
// fresh when the page opens and each time the app comes back to the front, as the desktop reads it on each visit.
import { useEffect, useState } from "react";
import { AppState, Pressable, TextInput, View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { useFormat, useT } from "../../../../src/app/i18n";
import { bareName, initials } from "../../../../src/app/names";
import { useBridge, useDataset, useStatus } from "../../../../src/app/store";
import type { Task, TaskMessage } from "../../../../src/core/models";
import { edunexTaskUrl } from "../../../../src/core/tasks";
import { LecturerFile } from "../../parts/files";
import { boxHtml } from "../../parts/html";
import { LecturerHtml } from "../../parts/lecturer-html";
import { toast } from "../../swaps/overlays";
import { SectionTitle } from "../../ui/card-list";
import { Button } from "../../ui/controls";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { iosPressed } from "../../ui/press";
import { Text, useFieldColors } from "../../ui/text";
import { shape, space, useTheme } from "../../ui/theme";
import { Flat as Panel } from "./flat";

/** Any personal Task with an answer has a thread (a group's is on Edunex). */
export function Thread({ task }: { task: Task }) {
  const t = useT();
  const bridge = useBridge();
  const answerId = task.answer?.id;
  const thread = useDataset("edunex.taskThreads")?.find((kept) => kept.answerId === answerId);
  const shown = answerId !== undefined && !task.group;
  const taskId = task.id;
  useEffect(() => {
    if (!shown) return;
    let reading = false;
    const read = () => {
      if (reading) return;
      reading = true;
      void bridge
        .invoke("tasks.readThread", { taskId })
        .catch(() => undefined)
        .finally(() => {
          reading = false;
        });
    };
    read();
    const back = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => back.remove();
  }, [bridge, taskId, shown]);
  if (!shown) return null;
  const messages = thread?.messages ?? [];
  return (
    <View testID="section.thread">
      <SectionTitle title={t("task.thread.title")} count={messages.length > 0 ? messages.length : undefined} />
      <Panel>
        {messages.length > 0 ? (
          <View style={{ gap: space[4] }}>
            {messages.map((message) => (
              <Message key={message.id} message={message} taskId={task.id} />
            ))}
          </View>
        ) : (
          <Text size="bodyMedium" tone="muted">
            {t("task.thread.empty")}
          </Text>
        )}
        <CommentBox taskId={task.id} />
      </Panel>
    </View>
  );
}

/** One message: who wrote it, when, what, and any file it carries. */
function Message({ message, taskId }: { message: TaskMessage; taskId: number }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const c = theme.color;
  const v = theme.v4;
  const account = useDataset("edunex.account");
  const mine = message.from === "me";
  return (
    <View style={{ flexDirection: "row", gap: space[3] }} testID={`row.comment.${message.id}`}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mine ? c.infoBg : c.fill,
        }}
      >
        <Text size="labelSmall" weight="bold" style={{ color: mine ? c.infoFg : v.muted }}>
          {initials(mine && account ? account.name : message.name) || "?"}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space[2] }}>
          <Text size="bodyMedium" weight="semibold" numberOfLines={1} style={{ color: v.fg, flexShrink: 1 }}>
            {mine ? t("task.thread.me") : bareName(message.name)}
          </Text>
          {message.from === "lecturer" && (
            <Text size="bodySmall" weight="medium" style={{ color: c.infoFg }}>
              {t("task.thread.lecturer")}
            </Text>
          )}
          {message.at !== null && (
            <Text size="bodySmall" tabular style={{ color: v.muted }}>
              {f.dueLabel(message.at)}
            </Text>
          )}
        </View>
        <View style={{ marginTop: 2 }}>
          <LecturerHtml html={message.html} size="small" edunexUrl={edunexTaskUrl(taskId)} />
        </View>
        {message.files.length > 0 && (
          <View style={{ marginTop: space[2], gap: space[2] }}>
            {message.files.map((file) => (
              <LecturerFile key={file.url} file={file} edunexUrl={edunexTaskUrl(taskId)} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** Where the Student writes back: a line to press, then a plain box with Batal and Kirim. Closes again once sent. */
function CommentBox({ taskId }: { taskId: number }) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const v = theme.v4;
  const fieldColors = useFieldColors();
  const bridge = useBridge();
  const edunex = useStatus("edunex");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const reason =
    edunex.state === "offline" ? t("task.thread.offline") : edunex.state === "expired" || edunex.state === "signed-out" ? t("task.thread.signIn") : null;
  const ready = text.trim() !== "" && !sending && reason === null;
  const close = () => {
    setOpen(false);
    setText("");
  };
  const send = async () => {
    if (!ready) return;
    setSending(true);
    try {
      const result = await bridge.invoke("tasks.comment", { taskId, text: boxHtml(text) });
      if (result.outcome === "gone") return void toast(t("handIn.gone"), "danger");
      // Sent: felt, as every commit is.
      haptic.confirm();
      close();
      if (result.outcome === "unconfirmed") toast(t("task.thread.unconfirmed"));
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    } finally {
      setSending(false);
    }
  };
  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        android_ripple={{ color: c.selected }}
        testID="action.comment"
        style={({ pressed }) => [
          {
            marginTop: space[4],
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            paddingHorizontal: space[3],
            borderRadius: shape.sm,
            borderWidth: 1,
            borderColor: c.outline,
          },
          iosPressed(pressed),
        ]}
      >
        <Icons.Chat size={18} color={v.muted} />
        <Text size="bodyMedium" style={{ color: v.muted, flex: 1 }}>
          {t("task.thread.placeholder")}
        </Text>
      </Pressable>
    );
  return (
    <View style={{ marginTop: space[4], gap: space[2] }}>
      <TextInput
        {...fieldColors}
        testID="input.comment"
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder={t("task.thread.placeholder")}
        placeholderTextColor={c.onSurfaceVariant}
        accessibilityLabel={t("task.thread.label")}
        textAlignVertical="top"
        style={{
          minHeight: 96,
          borderRadius: shape.xs,
          borderWidth: 2,
          borderColor: c.primary,
          paddingHorizontal: space[4] - 1,
          paddingVertical: space[3] - 1,
          fontSize: 16,
          lineHeight: 24,
          color: c.onSurface,
          backgroundColor: v.card,
        }}
      />
      {reason && (
        <Text size="bodySmall" tone="muted">
          {reason}
        </Text>
      )}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space[2] }}>
        <Button size="sm" variant="ghost" onPress={close} disabled={sending} testID="action.commentCancel">
          {t("action.cancel")}
        </Button>
        <Button size="sm" variant="primary" busy={sending} disabled={!ready} onPress={() => void send()} testID="action.commentSend">
          {t("task.thread.send")}
        </Button>
      </View>
    </View>
  );
}
