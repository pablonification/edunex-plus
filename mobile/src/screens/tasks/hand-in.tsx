// Handing in on the phone (S3): src/app/screens/tasks.tsx's HandIn, with the same rules and the same
// words. The state lives in `useHandIn`, shared by the card in the page (status, the answer, its
// files, attaching from the phone) and the bar stuck to the bottom (Simpan draf, Kumpulkan, and why
// Kumpulkan can't be pressed), within a thumb's reach. The answer box is a plain multi-line text
// box: an answer Edunex holds with formatting stays as it is, changed on Edunex.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { ActionError, errorKey } from "../../../../src/app/bridge";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone } from "../../../../src/app/snoozes";
import { useBridge, useDataset, useStatus } from "../../../../src/app/store";
import { answerFileProblem, type HandInResult, type PickedFile } from "../../../../src/core/actions/tasks";
import { taskDoneKey } from "../../../../src/core/done";
import type { DoneHow, Task, TaskFile, TaskStatus } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import {
  edunexTaskUrl,
  type HandInCheck,
  handInChecks,
  isOpenStatus,
  matchesNaming,
  namingPattern,
  requiredFileType,
  submittedAt,
  takesAnswers,
} from "../../../../src/core/tasks";
import { dayWord } from "../../parts/day-word";
import { FileBadge, useEdunexFile } from "../../parts/files";
import { boxEditable, boxHtml, boxText, editableInApp, plainText } from "../../parts/html";
import { LecturerHtml } from "../../parts/lecturer-html";
import { useRefresh, useSignIn } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { Button, IconButton } from "../../ui/controls";
import { Card, ProgressBar, StatusGlyph } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { ActionSheet, Sheet } from "../../ui/sheet";
import { Text, type TextTone, useFieldColors } from "../../ui/text";
import { type Palette, radius, space, useTheme } from "../../ui/theme";
import { formatScore } from "./rows";

/** A file the Student attached in this visit, before it's in Edunex's answer. */
interface Attached {
  key: string;
  name: string;
  size: number;
  state: "waiting" | "uploading" | "uploaded" | "failed";
  file?: TaskFile;
  problem?: StringKey;
}

/** A file Edunex wouldn't take (its kind or size): never sent, so there's nothing to try again, only to remove. */
const refused = (item: Attached) => item.problem === "handIn.tooBig" || item.problem === "handIn.wrongType";

interface Notice {
  tone: "danger" | "warning" | "neutral";
  text: StringKey;
  action?: "signIn" | "edunex";
}

/** Answers the Student changed and hasn't saved, by Student and Task: kept while the app runs, so leaving the page loses nothing. */
const unsavedText = new Map<string, string>();

/** Two box texts that read the same: spacing at the ends and inside lines doesn't count. */
const same = (a: string, b: string) => {
  const norm = (text: string) =>
    text
      .split("\n")
      .map((line) => line.replace(/[ \t ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  return norm(a) === norm(b);
};

/**
 * The Student's written answer: what Edunex has, what's in the box, and whether they differ. A
 * change on Edunex replaces the box's text only when the Student hasn't changed it; their own
 * change is kept (across leaving the page too) until they save it or discard it.
 */
function useAnswerText(task: Task) {
  const account = useDataset("edunex.account");
  const key = `${account?.nim ?? ""}:${task.id}`;
  const saved = task.answer?.text ?? "";
  const savedText = useMemo(() => boxText(saved), [saved]);
  const [base, setBase] = useState(savedText);
  const [text, setText] = useState(() => unsavedText.get(key) ?? savedText);
  const dirty = !same(text, base);

  useEffect(() => {
    if (savedText === base) return;
    if (dirty && !same(text, savedText)) return;
    setBase(savedText);
    setText(savedText);
  }, [savedText, base, dirty, text]);

  useEffect(() => {
    if (dirty) unsavedText.set(key, text);
    else unsavedText.delete(key);
  }, [dirty, key, text]);

  const discard = () => {
    unsavedText.delete(key);
    setText(base);
  };
  return { text, setText, saved, dirty, discard };
}

function uploadProblem(error: unknown): StringKey {
  if (error instanceof ActionError && error.kind === "Offline") return "handIn.uploadOffline";
  if (error instanceof ActionError && error.kind === "Unauthorized") return "handIn.uploadExpired";
  if (error instanceof ActionError && error.kind === "Rejected") return "handIn.unreadable";
  return "handIn.uploadFailed";
}

function noticeFor(error: unknown): Notice {
  const kind = error instanceof ActionError ? error.kind : "Failed";
  switch (kind) {
    case "Offline":
      return { tone: "danger", text: "handIn.error.offline" };
    case "Unauthorized":
      return { tone: "warning", text: "handIn.error.expired", action: "signIn" };
    case "VendorChanged":
      return { tone: "danger", text: "handIn.error.changed", action: "edunex" };
    case "Rejected":
      return { tone: "danger", text: "handIn.error.rejected", action: "edunex" };
    default:
      return { tone: "danger", text: "handIn.error.failed" };
  }
}

/** A soft hint under a file that isn't what the lecturer asked for (type, name). */
function fileHint(t: Translate, name: string, pattern: string | null, type: string | null): string | null {
  if (type && !name.toLowerCase().endsWith(`.${type}`)) return t("handIn.typeHint", { type: type.toUpperCase() });
  if (pattern && !matchesNaming(pattern, name)) return t("handIn.namingHint", { pattern });
  return null;
}

/** Everything the card and the bar share: the answer, its files, the checks, and what each press does. */
export function useHandIn(task: Task, status: TaskStatus) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bridge = useBridge();
  const edunex = useStatus("edunex");
  const presence = useDataset("edunex.presence");
  const countedIn = useAttendance()?.courses.find((entry) => entry.course.code === task.courseCode)?.health.countedIn;
  const [attached, setAttached] = useState<Attached[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const uploads = useRef<Promise<void>>(Promise.resolve());

  // Signed in again after the session ended: the way is clear.
  useEffect(() => {
    if (edunex.state === "live") setNotice((current) => (current?.action === "signIn" ? null : current));
  }, [edunex.state]);

  const sent = status === "submitted" || status === "in_review";
  // A group Task is handed in by the group on Edunex's own pages.
  const editable = !task.group && takesAnswers(task, now);
  const answer = useAnswerText(task);
  // An answer the plain box can't hold without losing something stays as it is.
  const textLocked = useMemo(() => Boolean(answer.saved) && !boxEditable(answer.saved), [answer.saved]);
  const richLocked = useMemo(() => textLocked && !editableInApp(answer.saved), [textLocked, answer.saved]);
  const hasText = textLocked ? Boolean(answer.saved.trim()) : Boolean(answer.text.trim());
  const saved = (task.answer?.files ?? []).filter((file) => !removed.includes(file.url));
  const uploaded = attached.flatMap((item) => (item.state === "uploaded" && item.file ? [item.file] : []));
  const files = [...saved, ...uploaded];
  const uploading = attached.some((item) => item.state === "waiting" || item.state === "uploading");
  const failed = attached.some((item) => item.state === "failed");
  const hasAnswer = hasText && (files.length > 0 || !task.fileRequired);
  const textChanged = !textLocked && answer.dirty;
  const changed = uploaded.length > 0 || removed.length > 0 || textChanged;
  const guard = handInChecks(task, { now, sessions: presence?.[task.courseCode] ?? [], edunex: edunex.state, files, countedIn });
  const wait = guard.waitForWindow && hasAnswer;
  const idle = editable && !uploading && !failed && busy === null;
  const canSave = idle && changed && hasAnswer && !guard.blocked;
  const canSubmit = idle && hasAnswer && !guard.blocked;
  const pattern = namingPattern(task.instructions);
  const type = requiredFileType(task.instructions);
  const early = guard.checks.find((check) => check.kind === "attendanceEarly");
  const whenWindow = early ? `${dayWord(f, t, early.opensAt)}, ${f.timeRange(early.opensAt, early.closesAt)}` : "";

  const change = (key: string, patch: Partial<Attached>) => setAttached((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  // One upload at a time, in the order the files were attached.
  const upload = (items: Attached[]) => {
    for (const item of items) {
      uploads.current = uploads.current.then(async () => {
        change(item.key, { state: "uploading", problem: undefined });
        try {
          const file = await bridge.invoke("tasks.upload", { fileId: item.key, taskId: task.id });
          change(item.key, { state: "uploaded", file: { name: file.name, url: file.url } });
        } catch (error) {
          change(item.key, { state: "failed", problem: uploadProblem(error) });
        }
      });
    }
  };

  const attach = (picked: PickedFile[]) => {
    const items: Attached[] = picked.map((file) => {
      const problem = answerFileProblem(file.name, file.size);
      return problem
        ? { key: file.id, name: file.name, size: file.size, state: "failed", problem: problem === "size" ? "handIn.tooBig" : "handIn.wrongType" }
        : { key: file.id, name: file.name, size: file.size, state: "waiting" };
    });
    setAttached((list) => [...list, ...items]);
    upload(items.filter((item) => item.state === "waiting"));
  };

  const pick = async () => {
    try {
      attach((await bridge.invoke("tasks.pickFiles", {})).files);
    } catch (error) {
      setNotice(noticeFor(error));
    }
  };

  const settle = (kind: "draft" | "submit", result: HandInResult) => {
    switch (result.outcome) {
      case "saved":
        setAttached([]);
        setRemoved([]);
        setJustDone(true);
        return;
      case "submitted": {
        setAttached([]);
        setRemoved([]);
        const at = result.task ? submittedAt(result.task) : null;
        if (kind === "submit" && at !== null) setJustDone(true);
        else setNotice({ tone: "neutral", text: "handIn.alreadySubmitted" });
        return;
      }
      case "unconfirmed":
        setNotice({ tone: "warning", text: "handIn.unconfirmed", action: "edunex" });
        return;
      case "closed":
        setNotice({ tone: "danger", text: "handIn.closed" });
        return;
      case "not-open":
        setNotice({ tone: "warning", text: "handIn.notOpen" });
        return;
      case "gone":
        toast(t("handIn.gone"), "danger");
    }
  };

  const run = async (kind: "draft" | "submit") => {
    setBusy(kind);
    setNotice(null);
    try {
      // The text goes only when the Student changed it; otherwise Edunex keeps its own, exactly.
      const input = { taskId: task.id, files, ...(textChanged ? { text: boxHtml(answer.text) } : {}) };
      const result = await bridge.invoke(kind === "draft" ? "tasks.saveDraft" : "tasks.submit", input);
      settle(kind, result);
    } catch (error) {
      setNotice(noticeFor(error));
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return {
    task,
    status,
    sent,
    editable,
    answer,
    textLocked,
    richLocked,
    hasText,
    hasAnswer,
    saved,
    attached,
    files,
    uploading,
    failed,
    changed,
    textChanged,
    guard,
    wait,
    canSave,
    canSubmit,
    pattern,
    type,
    early,
    whenWindow,
    busy,
    notice,
    confirming,
    justDone,
    setConfirming,
    pick,
    run,
    removeSaved: (url: string) => setRemoved((list) => [...list, url]),
    removeAttached: (key: string) => setAttached((list) => list.filter((item) => item.key !== key)),
    retry: (item: Attached) => {
      change(item.key, { state: "waiting", problem: undefined });
      upload([item]);
    },
  };
}

export type HandInState = ReturnType<typeof useHandIn>;

const GLYPH_TONE: Record<TaskStatus, keyof Palette> = {
  not_started: "neutralFg",
  draft: "statusDraftFg",
  submitted: "statusSubmittedFg",
  overdue: "statusOverdueFg",
  closed: "statusClosedFg",
  in_review: "statusReviewFg",
};

/** The submission card: status, the Student's answer, its files, attaching from the phone, and what's marked about it. */
export function HandInCard({ h }: { h: HandInState }) {
  const fieldColors = useFieldColors();
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const c = theme.color;
  const open = useOpenExternal();
  const { signIn, busy: signingIn } = useSignIn();
  const { task, status } = h;
  const sentAt = submittedAt(task);
  const draftAt = task.answer?.updatedAt ?? task.answer?.createdAt ?? null;
  const subtitle =
    status === "not_started"
      ? ""
      : status === "draft"
        ? draftAt !== null
          ? factsLabel(t("handIn.draftSaved", { when: f.dayTimeWord(draftAt) }), t("handIn.draftStatus").toLowerCase())
          : t("handIn.draftStatus")
        : status === "overdue"
          ? t("handIn.lateStill")
          : status === "closed"
            ? t("handIn.closedStatus")
            : sentAt !== null
              ? t("handIn.recorded", { when: f.dayTimeWord(sentAt) })
              : "";
  const inFlight = h.attached.filter((item) => item.state !== "failed");
  const done = inFlight.filter((item) => item.state === "uploaded").length;
  const glyph = c[GLYPH_TONE[status]];

  return (
    <Card testID="card.handIn">
      <View style={{ padding: space[4], gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <StatusGlyph status={status} size={20} color={glyph} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="lead" weight="semibold">
              {t(`taskStatus.${status}`)}
            </Text>
            {subtitle ? <Meta>{subtitle}</Meta> : null}
          </View>
          {(task.score !== null || status === "in_review") && (
            <View style={{ alignItems: "flex-end" }}>
              <Text size="caption" tone="muted">
                {t("task.score")}
              </Text>
              <Text size="title" weight="semibold" tabular>
                {task.score !== null ? formatScore(task.score, f) : "-"}
              </Text>
            </View>
          )}
        </View>

        <View>
          {(!task.group || h.saved.length > 0) && (
            <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2] }}>
              {t("handIn.yourAnswer")}
            </Text>
          )}
          {h.editable && !h.textLocked ? (
            <View style={{ marginBottom: space[3] }}>
              <TextInput
                {...fieldColors}
                testID="input.answer"
                multiline
                value={h.answer.text}
                onChangeText={h.answer.setText}
                placeholder={t("handIn.textPlaceholder")}
                placeholderTextColor={c.faint}
                accessibilityLabel={t("handIn.yourAnswer")}
                textAlignVertical="top"
                style={[styles.box, { borderColor: c.fieldEdge, color: c.fg, backgroundColor: c.surface }]}
              />
              {h.textChanged && (
                <View style={{ marginTop: space[1.5], flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
                  <Text size="caption" tone="muted">
                    {t("handIn.textUnsaved")}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={h.answer.discard} hitSlop={10} testID="action.discardText">
                    <Text size="caption" weight="medium" tone="accent">
                      {t("handIn.textDiscard")}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            !task.group &&
            (h.textLocked || plainText(h.answer.saved)) && (
              <View style={{ marginBottom: space[3], gap: space[2] }}>
                <View style={{ borderRadius: radius.lg, backgroundColor: c.fill, paddingHorizontal: space[3], paddingVertical: space[2.5] }}>
                  <LecturerHtml html={h.answer.saved} pictureAlt={t("image.altYours")} />
                </View>
                {h.editable && h.textLocked && (
                  <View style={{ gap: space[2], alignItems: "flex-start" }}>
                    <Text size="caption" tone="muted">
                      {h.richLocked ? t("handIn.textRich") : t("mobile.handIn.textPlain")}
                    </Text>
                    <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(edunexTaskUrl(task.id))}>
                      {t("handIn.editOnEdunex")}
                    </Button>
                  </View>
                )}
              </View>
            )
          )}
          {(h.saved.length > 0 || h.attached.length > 0) && (
            <View style={{ marginBottom: space[2], gap: space[1.5] }}>
              {h.saved.map((file) => (
                <SavedFileRow
                  key={file.url}
                  file={file}
                  hint={h.editable ? fileHint(t, file.name, h.pattern, h.type) : null}
                  onRemove={h.editable ? () => h.removeSaved(file.url) : undefined}
                />
              ))}
              {h.attached.map((item) => (
                <FileRow
                  key={item.key}
                  name={item.name}
                  state={item.state}
                  detail={
                    item.state === "failed"
                      ? t(item.problem ?? "handIn.uploadFailed")
                      : item.state === "uploaded" || item.state === "uploading"
                        ? factsLabel(t(item.state === "uploaded" ? "handIn.notSaved" : "handIn.uploading"), f.fileSize(item.size))
                        : t("handIn.waiting")
                  }
                  hint={item.state === "uploaded" ? fileHint(t, item.name, h.pattern, h.type) : null}
                  onRetry={item.state === "failed" && !refused(item) ? () => h.retry(item) : undefined}
                  onRemove={h.editable ? () => h.removeAttached(item.key) : undefined}
                  file={item.file}
                />
              ))}
            </View>
          )}
          {h.editable && (
            <Pressable
              testID="action.attach"
              accessibilityRole="button"
              accessibilityLabel={factsLabel(
                t("handIn.attach"),
                task.fileRequired ? t("handIn.fileRequired") : null,
                h.type ? t("handIn.ruleType", { type: h.type.toUpperCase() }) : null,
              )}
              onPress={() => void h.pick()}
              android_ripple={{ color: c.selected }}
              style={[styles.attach, { borderColor: c.track }]}
            >
              <Icons.Upload size={18} color={c.muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="small" weight="semibold" tone="accent">
                  {t("handIn.attach")}
                </Text>
                {(task.fileRequired || h.type) && (
                  <Meta size="caption" tone="faint">
                    {task.fileRequired ? t("handIn.fileRequired") : ""}
                    {h.type ? t("handIn.ruleType", { type: h.type.toUpperCase() }) : ""}
                  </Meta>
                )}
              </View>
            </Pressable>
          )}
          {task.group && !h.sent && status !== "closed" && (
            <View style={{ gap: space[2], alignItems: "flex-start" }}>
              <Text size="small" tone="muted">
                {t("handIn.group")}
              </Text>
              <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(edunexTaskUrl(task.id))}>
                {t("action.openInEdunex")}
              </Button>
              {isOpenStatus(status) && <MarkHandedIn task={task} />}
            </View>
          )}
          {!task.group && !h.editable && !h.sent && status !== "closed" && task.opensAt !== null && (
            <Quiet>{t("handIn.notOpenYet", { when: f.dayTimeWord(task.opensAt) })}</Quiet>
          )}
          {status === "closed" && <Quiet>{task.answer ? t("handIn.draftNeverSent") : t("handIn.nothingHandedIn")}</Quiet>}
        </View>

        {h.uploading && inFlight.length > 1 && (
          <View style={{ gap: space[1.5] }}>
            <Text size="caption" tone="muted">
              {t("handIn.progress", { done, count: inFlight.length })}
            </Text>
            <ProgressBar value={done / inFlight.length} label={t("handIn.progress", { done, count: inFlight.length })} />
          </View>
        )}

        {h.notice && (
          <View
            accessibilityRole="alert"
            style={[styles.notice, { backgroundColor: h.notice.tone === "danger" ? c.dangerBg : h.notice.tone === "warning" ? c.warningBg : c.fill }]}
          >
            <Icons.AlertTriangle size={14} color={h.notice.tone === "danger" ? c.dangerFg : h.notice.tone === "warning" ? c.warningFg : c.muted} />
            <View style={{ flex: 1, minWidth: 0, gap: space[2], alignItems: "flex-start" }}>
              <Text size="small" tone={h.notice.tone === "danger" ? "danger" : h.notice.tone === "warning" ? "warning" : "muted"}>
                {t(h.notice.text)}
              </Text>
              {h.notice.action === "signIn" && (
                <Button size="sm" variant="primary" busy={signingIn} onPress={() => void signIn("edunex")}>
                  {t("action.signInAgain")}
                </Button>
              )}
              {h.notice.action === "edunex" && (
                <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} onPress={() => open(edunexTaskUrl(task.id))}>
                  {t("action.openInEdunex")}
                </Button>
              )}
            </View>
          </View>
        )}

        {h.editable && (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
              <Icons.Lock size={14} color={c.muted} />
              <Text size="caption" tone="muted" style={{ flex: 1 }}>
                {t("handIn.explainer")}
              </Text>
            </View>
            <MarkHandedIn task={task} />
          </>
        )}
        {h.sent && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
            <Icons.ShieldCheck size={14} color={c.successFg} />
            <Text size="caption" tone="muted" style={{ flex: 1 }}>
              {status === "in_review" ? t("handIn.inReview") : t("handIn.final")}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: theme.color.fill, paddingHorizontal: space[3], paddingVertical: space[2.5] }}>
      <Text size="small" tone="muted">
        {children}
      </Text>
    </View>
  );
}

/** Why Kumpulkan can't be pressed, or what pressing it now would cost; with the fix next to it (the desktop's `why`). */
function useWhy(h: HandInState): { tone: "warning" | "neutral" | "danger"; text: string; fix?: ReactNode } | null {
  const t = useT();
  const { signIn, busy: signingIn } = useSignIn();
  const { refresh, busy: refreshing } = useRefresh();
  if (!h.editable) return null;
  if (h.guard.blocked)
    return h.guard.checks[0]?.kind === "offline"
      ? {
          tone: "danger",
          text: t("handIn.why.offline"),
          fix: (
            <Button size="sm" busy={refreshing} onPress={() => void refresh("edunex")}>
              {t("action.tryAgain")}
            </Button>
          ),
        }
      : {
          tone: "warning",
          text: t("handIn.why.expired"),
          fix: (
            <Button size="sm" variant="primary" busy={signingIn} onPress={() => void signIn("edunex")}>
              {t("action.signInAgain")}
            </Button>
          ),
        };
  if (h.failed)
    return h.attached.some((item) => item.state === "failed" && !refused(item))
      ? { tone: "danger", text: t("handIn.why.failed") }
      : { tone: "neutral", text: t("handIn.why.refused") };
  if (h.uploading) return { tone: "neutral", text: t("handIn.why.uploading") };
  if (!h.hasText) return { tone: "neutral", text: t("handIn.why.noText") };
  if (!h.hasAnswer) return { tone: "neutral", text: t("handIn.why.noFile") };
  if (h.early)
    return { tone: "warning", text: t(h.changed || h.status === "not_started" ? "handIn.why.early" : "handIn.why.earlySaved", { when: h.whenWindow }) };
  return null;
}

const WHY_TONE: Record<"warning" | "neutral" | "danger", TextTone> = { warning: "warning", neutral: "muted", danger: "danger" };

/** Simpan draf and Kumpulkan at the bottom of the screen, with why Kumpulkan can't be pressed above them. */
export function HandInBar({ h }: { h: HandInState }) {
  const t = useT();
  const theme = useTheme();
  const why = useWhy(h);
  if (!h.editable) return null;
  const submitLabel = h.status === "overdue" ? t("handIn.submitLate") : t("handIn.submit");
  return (
    <View
      style={{
        backgroundColor: theme.color.canvas,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.color.line,
        paddingHorizontal: space.page,
        paddingTop: space[3],
        paddingBottom: space[3],
        gap: space[2.5],
      }}
    >
      {why && !(h.notice?.action === "signIn" && h.guard.blocked) && (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {/* The icon on the first line (19 high) when the hint wraps; the hint as a whole level with its fix. */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
            <View style={{ paddingTop: 2.5 }}>
              <Icons.Info size={14} color={theme.color[why.tone === "danger" ? "dangerFg" : why.tone === "warning" ? "warningFg" : "muted"]} />
            </View>
            <Text size="small" tone={WHY_TONE[why.tone]} style={{ flex: 1 }}>
              {why.text}
            </Text>
          </View>
          {why.fix}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <Button
          testID="action.saveDraft"
          size="lg"
          variant={h.wait && h.canSave ? "primary" : "secondary"}
          disabled={!h.canSave}
          busy={h.busy === "draft"}
          onPress={() => void h.run("draft")}
          style={{ flex: 1 }}
        >
          {t("handIn.saveDraft")}
        </Button>
        <Button
          testID="action.submit"
          size="lg"
          variant={h.wait ? "secondary" : "primary"}
          disabled={!h.canSubmit}
          busy={h.busy === "submit"}
          onPress={() => h.setConfirming(true)}
          style={{ flex: 1.4 }}
        >
          {submitLabel}
        </Button>
      </View>
      <HandInSheet h={h} submitLabel={h.status === "overdue" ? submitLabel : t("handIn.submitNow")} />
    </View>
  );
}

const CHECK_TONE: Record<HandInCheck["tone"], TextTone> = { block: "danger", warn: "warning", ok: "success" };

/** A check as one honest sentence (the desktop's HandInDialog). */
function sentence(t: Translate, f: Format, check: HandInCheck): string {
  const range = (opensAt: number, closesAt: number) => `${dayWord(f, t, opensAt)}, ${f.timeRange(opensAt, closesAt)}`;
  switch (check.kind) {
    case "attendanceEarly":
      return t("handIn.check.attendanceEarly", { when: range(check.opensAt, check.closesAt) });
    case "attendanceMissed":
      return t("handIn.check.attendanceMissed", { when: range(check.opensAt, check.closesAt) });
    case "attendanceIn":
      return t("handIn.check.attendanceIn");
    case "late":
      return t("handIn.check.late", { when: f.dayTimeWord(check.dueAt) });
    case "fileType":
      return t("handIn.check.fileType", { type: check.type.toUpperCase(), files: f.list(check.files), count: check.files.length });
    case "naming":
      return t("handIn.check.naming", { pattern: check.pattern });
    case "offline":
      return t("handIn.why.offline");
    case "expired":
      return t("handIn.why.expired");
  }
}

/**
 * Before the final hand-in: the files, then each thing that matters as one honest sentence, and the
 * right default. Outside the attendance window the main button keeps the work as a draft; handing
 * in anyway stays one press away. A sheet from the bottom, where the thumb already is.
 */
function HandInSheet({ h, submitLabel }: { h: HandInState; submitLabel: string }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { files, guard, busy } = h;
  const close = () => {
    if (busy === null) h.setConfirming(false);
  };
  const saveDraft = () => (h.changed ? void h.run("draft") : h.setConfirming(false));
  return (
    <Sheet
      open={h.confirming}
      onClose={close}
      title={t("handIn.confirmTitle")}
      // Handing in stays in view however many checks the sheet lists.
      footer={
        guard.waitForWindow ? (
          <>
            <Button variant="primary" size="lg" busy={busy === "draft"} disabled={busy === "submit"} onPress={saveDraft} testID="action.saveInstead">
              {h.changed ? t("handIn.saveInstead") : t("handIn.notNow")}
            </Button>
            <Button size="lg" busy={busy === "submit"} disabled={busy === "draft"} onPress={() => void h.run("submit")} testID="action.submitAnyway">
              {t("handIn.submitAnyway")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" busy={busy === "submit"} onPress={() => void h.run("submit")} testID="action.submitConfirm">
              {submitLabel}
            </Button>
            <Button size="lg" onPress={close}>
              {t("action.cancel")}
            </Button>
          </>
        )
      }
      testID="sheet.submit"
    >
      <Text size="body" tone="muted">
        {files.length
          ? t("handIn.confirmBody", { files: files.length === 1 ? files[0]!.name : t("handIn.fileCount", { count: files.length }) })
          : t("handIn.confirmBodyText")}
      </Text>
      {guard.checks.length > 0 && (
        <View style={{ marginTop: space[4], paddingTop: space[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line, gap: space[2] }}>
          {guard.checks.map((check) => {
            const tone = CHECK_TONE[check.tone];
            const color = theme.color[tone === "danger" ? "dangerFg" : tone === "warning" ? "warningFg" : "successFg"];
            return (
              <View key={check.kind} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2.5] }}>
                {check.tone === "ok" ? <Icons.CheckCircle size={16} color={color} /> : <Icons.AlertTriangle size={16} color={color} />}
                <Text size="body" tone={tone} style={{ flex: 1 }}>
                  {sentence(t, f, check)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

/** A file already in the answer, on Edunex: press to open it in the phone's app; × takes it out of the next save. */
function SavedFileRow({ file, hint, onRemove }: { file: TaskFile; hint: string | null; onRemove?: () => void }) {
  const { open, busy } = useEdunexFile(file);
  return <FileRow name={file.name} hint={hint} onRemove={onRemove} onOpen={() => void open()} opening={busy} />;
}

/** One file of the answer (the desktop's FileRow). */
function FileRow({
  name,
  state,
  detail,
  hint,
  onRemove,
  onRetry,
  onOpen,
  opening = false,
  file,
}: {
  name: string;
  state?: Attached["state"];
  detail?: string;
  hint?: string | null;
  onRemove?: () => void;
  onRetry?: () => void;
  onOpen?: () => void;
  opening?: boolean;
  /** Uploaded a moment ago: it's on Edunex, and opens from there. */
  file?: TaskFile;
}) {
  if (file && !onOpen) return <UploadedFileRow file={file} {...{ name, state, detail, hint, onRemove, onRetry }} />;
  return <FileRowView {...{ name, state, detail, hint, onRemove, onRetry, onOpen, opening }} />;
}

function UploadedFileRow(props: {
  file: TaskFile;
  name: string;
  state?: Attached["state"];
  detail?: string;
  hint?: string | null;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  const { open, busy } = useEdunexFile(props.file);
  return <FileRowView {...props} onOpen={() => void open()} opening={busy} />;
}

function FileRowView({
  name,
  state,
  detail,
  hint,
  onRemove,
  onRetry,
  onOpen,
  opening = false,
}: {
  name: string;
  state?: Attached["state"];
  detail?: string;
  hint?: string | null;
  onRemove?: () => void;
  onRetry?: () => void;
  onOpen?: () => void;
  opening?: boolean;
}) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const failed = state === "failed";
  const body = (
    <>
      <FileBadge name={name} state={state} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="body" weight="medium" numberOfLines={2}>
          {name}
        </Text>
        {detail && !failed ? (
          <Text size="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
    </>
  );
  return (
    <View style={[styles.file, { backgroundColor: failed ? c.dangerBg : c.fill }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2.5] }}>
        {onOpen && !failed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("mobile.file.openFor", { name })}
            accessibilityState={{ busy: opening }}
            onPress={onOpen}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2.5], minHeight: 44 }}
          >
            {body}
          </Pressable>
        ) : (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2.5], minHeight: 44 }}>{body}</View>
        )}
        {onRemove && !failed && (
          <IconButton label={t("handIn.remove", { name })} onPress={onRemove} testID="action.removeFile">
            <Icons.X size={16} color={c.muted} />
          </IconButton>
        )}
      </View>
      {state === "uploading" && <ProgressBar value={0} indeterminate label={t("handIn.uploading")} />}
      {failed && (
        <View style={{ marginTop: space[1.5], paddingLeft: 42, gap: space[1.5] }}>
          <Text size="small" tone="danger">
            {detail}
          </Text>
          <View style={{ flexDirection: "row", gap: space[1.5] }}>
            {onRetry && (
              <Button size="sm" icon={<Icons.RefreshCw size={14} />} label={t("handIn.retry", { name })} onPress={onRetry}>
                {t("handIn.retryShort")}
              </Button>
            )}
            {onRemove && (
              <Button size="sm" variant="ghost" label={t("handIn.remove", { name })} onPress={onRemove}>
                {t("handIn.removeShort")}
              </Button>
            )}
          </View>
        </View>
      )}
      {hint ? (
        <View style={{ marginTop: space[1], paddingLeft: 42, flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <View style={{ paddingTop: 3 }}>
            <Icons.Info size={12} color={c.warningFg} />
          </View>
          <Text size="caption" tone="warning" style={{ flex: 1 }}>
            {hint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type MarkedHow = Extract<DoneHow, "handedElsewhere" | "notHandingIn" | "groupDone">;

/**
 * For a Task Edunex won't see handed in: the Student's own word for it, kept on this phone. A Task
 * of their own: "Tidak mengumpulkan lewat Edunex? Tandai" (handed in another way, or not at all), as
 * a sheet; a group Task: "Kelompokku sudah kumpul". Once marked, one quiet line with Undo. The status
 * above stays Edunex's own.
 */
export function MarkHandedIn({ task }: { task: Task }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { done, mark, unmark } = useDone();
  const [menu, setMenu] = useState(false);
  const key = taskDoneKey(task, "due");
  const entry = done(key);
  const put = (how: MarkedHow) => void mark(key, how).catch((error: unknown) => toast(t(errorKey(error)), "danger"));
  const link = (text: string, onPress: () => void, testID: string, label?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} testID={testID}>
      <Text size="caption" weight="medium" tone="accent">
        {text}
      </Text>
    </Pressable>
  );
  if (entry)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icons.Check size={14} weight="bold" color={theme.color.successFg} />
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
          <Text size="caption" tone="muted">
            {factsLabel(t(`task.marked.${entry.how as MarkedHow}`), f.dayTimeWord(entry.at))}
          </Text>
          {link(
            t("action.undo"),
            () => void unmark(key.id).catch(() => undefined),
            "action.unmarkHandled",
            t("done.undoFor", { what: t(`task.marked.${entry.how as MarkedHow}`) }),
          )}
        </View>
      </View>
    );
  if (task.group)
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
        <Text size="caption" tone="muted">
          {t("done.groupAsk")}
        </Text>
        {link(t("done.groupDone"), () => put("groupDone"), "action.groupDone")}
      </View>
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
      <Text size="caption" tone="muted">
        {t("done.otherWay")}
      </Text>
      {/* The desktop's quiet menu button: a muted "⌄ Tandai" that opens a choice, not a link. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("done.otherWay.menuFor")}
        accessibilityState={{ expanded: menu }}
        onPress={() => setMenu(true)}
        hitSlop={10}
        testID="action.markHandled"
        style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 24 }}
      >
        <Icons.ChevronDown size={14} color={theme.color.muted} />
        <Text size="caption" weight="medium" tone="muted">
          {t("done.otherWay.menu")}
        </Text>
      </Pressable>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={t("done.otherWay.menuFor")}
        testID="sheet.handled"
        choices={(["handedElsewhere", "notHandingIn"] as const).map((how) => ({
          label: t(`done.${how}`),
          hint: t(`done.${how}.hint`),
          onPress: () => put(how),
          testID: `handled.${how}`,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 150, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space[3], paddingVertical: space[2.5], fontSize: 16, lineHeight: 22 },
  attach: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    minHeight: 56,
  },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: space[2], borderRadius: radius.lg, paddingHorizontal: space[3], paddingVertical: space[2.5] },
  file: { borderRadius: radius.lg, paddingHorizontal: space[2.5], paddingVertical: space[2] },
});
