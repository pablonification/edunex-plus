// The Nilai tab on the phone (S18, src/app/screens/course/grades.tsx): Edunex's grade only once the
// lecturer publishes it, and the course-contract calculator. The answer comes first, as a sentence
// for the letter the Student aims for; it's only given when it can be trusted: the weights must add
// up to 100, example weights say so loudly, and a score outside 0–100 is explained, not quietly
// changed. Numbers are typed on the number keypad. What the Student enters stays on this phone
// ("local.courseWeights", saved as the desktop saves it).
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useBridge, useDataset } from "../../../../src/app/store";
import { percent } from "../../../../src/core/attendance";
import { EXAMPLE_CONTRACT, EXAMPLE_PART_IDS, letterFor, partScore, standing } from "../../../../src/core/course-contract";
import { CONTRACT_LETTERS, type ContractLetter, type ContractPart, type CourseContract } from "../../../../src/core/models";
import { dismissToast, toast } from "../../swaps/overlays";
import { Button, IconButton, Segmented } from "../../ui/controls";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

// The letter aimed for, per course, while the app runs (the desktop keeps it in the page's place in history).
const aims = new Map<string, ContractLetter>();

export function GradesTab({ page, onOpenModules }: { page: CoursePage; onOpenModules?: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const grade = page.outline?.grade ?? null;
  return (
    <View style={{ gap: space[6] }}>
      <Calculator page={page} onOpenModules={onOpenModules} />
      <Card style={{ paddingHorizontal: space[4], paddingVertical: space[3.5] }}>
        <Text size="small" weight="semibold" tone="muted">
          {t("grade.edunex")}
        </Text>
        {grade ? (
          <Text size="heading" weight="semibold" tabular style={{ marginTop: space[2] }}>
            {`${f.number(grade.total, 1)}  ${grade.letter}`}
          </Text>
        ) : (
          <View style={{ marginTop: space[2], flexDirection: "row", gap: space[2] }}>
            <Icons.EyeOff size={14} color={theme.color.muted} />
            <Text size="body" tone="muted" style={{ flex: 1 }}>
              {t("grade.unpublished")}
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

/** "80" → 80; "" → null; anything else, or outside 0–100, is a problem to say, not to fix silently. */
function readScore(text: string, required = false): { value: number | null; problem: "range" | "number" | null } {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return { value: null, problem: required ? "number" : null };
  const value = Number(clean);
  if (!Number.isFinite(value)) return { value: null, problem: "number" };
  if (value < 0 || value > 100) return { value: null, problem: "range" };
  return { value, problem: null };
}

/**
 * A number from 0 to 100 that keeps what was typed: a valid number is saved at once; an invalid one
 * stays visible, marked, with the reason under it, and nothing is saved.
 */
function ScoreInput({
  label,
  value,
  onValue,
  placeholder,
  highlight = false,
  width = 64,
  required = false,
  onProblem,
  testID,
}: {
  label: string;
  value: number | null;
  onValue: (value: number | null) => void;
  placeholder?: string;
  highlight?: boolean;
  width?: number;
  required?: boolean;
  /** Told whether the box holds something that can't be used, so the answer can wait for it. */
  onProblem?: (bad: boolean) => void;
  testID?: string;
}) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value).replace(".", ","));
  const { problem } = readScore(shown, required);
  const bad = problem !== null;
  const report = useRef(onProblem);
  report.current = onProblem;
  useEffect(() => report.current?.(bad), [bad]);
  useEffect(() => () => report.current?.(false), []);
  return (
    <View style={{ alignItems: "flex-end" }}>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={problem ? t(problem === "range" ? "grade.range" : "grade.notNumber") : undefined}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        value={shown}
        selectTextOnFocus
        onChangeText={(next) => {
          setText(next);
          const read = readScore(next, required);
          if (!read.problem) onValue(read.value);
        }}
        onBlur={() => {
          if (!readScore(shown, required).problem) setText(null);
        }}
        style={[
          styles.input,
          {
            width,
            color: c.fg,
            backgroundColor: c.surface,
            borderColor: problem ? c.dangerFg : highlight ? c.warningFg : c.fieldEdge,
            borderWidth: problem || highlight ? 2 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      />
      {problem && (
        <Text size="caption" weight="medium" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: 2 }}>
          {t(problem === "range" ? "grade.range" : "grade.notNumber")}
        </Text>
      )}
    </View>
  );
}

/** A part's name, with a pencil to rename it; renaming types over it in place. */
function PartName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const t = useT();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <TextInput
        accessibilityLabel={t("grade.partName")}
        autoFocus
        defaultValue={name}
        maxLength={80}
        returnKeyType="done"
        onEndEditing={(event) => {
          onRename(event.nativeEvent.text.trim());
          setEditing(false);
        }}
        style={[
          styles.input,
          { flex: 1, textAlign: "left", color: theme.color.fg, borderColor: theme.color.fieldEdge, borderWidth: StyleSheet.hairlineWidth * 2 },
        ]}
      />
    );
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" }}>
      <Text size="body" weight="medium" numberOfLines={2} style={{ flexShrink: 1 }}>
        {name}
      </Text>
      <IconButton label={t("grade.rename", { part: name })} onPress={() => setEditing(true)}>
        <Icons.PenLine size={14} color={theme.color.faint} />
      </IconButton>
    </View>
  );
}

function Calculator({ page, onOpenModules }: { page: CoursePage; onOpenModules?: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const c = theme.color;
  const bridge = useBridge();
  const code = page.course.code;
  const saved = useDataset("local.courseWeights");
  const [draft, setDraft] = useState<CourseContract | null>(null);
  const [target, setTargetState] = useState<ContractLetter | null>(aims.get(code) ?? null);
  const setTarget = (letter: ContractLetter) => {
    aims.set(code, letter);
    setTargetState(letter);
  };
  // Boxes holding something unusable: no answer is given from numbers the Student can't see.
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const mark = (key: string) => (bad: boolean) =>
    setProblems((current) => {
      if (current.has(key) === bad) return current;
      const next = new Set(current);
      if (bad) next.add(key);
      else next.delete(key);
      return next;
    });
  const contract = draft ?? saved?.[code] ?? EXAMPLE_CONTRACT;
  const isExample = !draft && !saved?.[code];
  const attendance = page.course.attendance && page.course.attendance.held > 0 ? percent(page.course.attendance.attended, page.course.attendance.held) : null;
  const result = standing(contract, attendance);
  const fix = problems.size > 0;
  const sumOk = Math.abs(result.totalWeight - 100) < 1e-9;
  const weightsOk = !fix && sumOk;
  // The course contract, when the lecturer put it in a module ("Kontrak Belajar").
  const contractFile = (page.materials ?? []).some((m) => /kontrak/i.test(m.title)) || (page.outline?.modules ?? []).some((m) => /kontrak/i.test(m.title));

  // "Kembali ke contoh" can be taken back until the table changes again or the tab closes.
  const undo = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (undo.current !== null) dismissToast(undo.current);
    },
    [],
  );

  const save = (next: CourseContract | null) => {
    if (undo.current !== null) dismissToast(undo.current);
    undo.current = null;
    setDraft(next);
    const all = { ...(saved ?? {}) };
    if (next) all[code] = next;
    else delete all[code];
    void bridge.invoke("local.set", { name: "local.courseWeights", value: all }).catch(() => undefined);
  };
  const reset = () => {
    const before = contract;
    save(null);
    undo.current = toast(t("grade.resetDone"), "neutral", { label: t("action.undo"), onClick: () => save(before) });
  };
  const setPart = (id: string, patch: Partial<ContractPart>) => save({ ...contract, parts: contract.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const nameOf = (part: ContractPart) =>
    part.name ||
    ((EXAMPLE_PART_IDS as readonly string[]).includes(part.id) ? t(`grade.part.${part.id as (typeof EXAMPLE_PART_IDS)[number]}`) : t("grade.part.new"));

  // The letter to answer for: the Student's pick, else the best one still open.
  const aim = target ?? result.needs.find((need) => !need.reached && need.need !== null)?.letter ?? "A";
  const need = result.needs.find((n) => n.letter === aim)!;
  const open = contract.parts.filter((part) => partScore(part, attendance) === null && part.weight > 0).map(nameOf);
  const listed = f.list(open);
  const best = result.secured + result.openWeight;

  let answer: string;
  if (fix) answer = t("grade.answer.fix");
  else if (!weightsOk) answer = t("grade.answer.weights", { total: f.number(result.totalWeight, 0) });
  else if (result.final !== null) answer = t("grade.answer.final", { score: f.number(result.final, 1), letter: result.letter ?? "E" });
  else if (need.reached) answer = t("grade.answer.secured", { letter: aim });
  else if (need.need === null) answer = t("grade.answer.out", { letter: aim, best: f.number(best, 1), bestLetter: letterFor(best, contract.cutoffs) });
  else answer = t("grade.answer.need", { letter: aim, need: need.need, parts: listed });
  const answerTone = !weightsOk ? "warning" : need.need === null && !need.reached && result.final === null ? "danger" : "fg";

  return (
    // The warning, the answer, then the table it comes from.
    <View>
      {isExample && (
        <View style={{ marginBottom: space[5] }}>
          <Notice
            tone="warning"
            title={t("grade.exampleNotice", { code })}
            action={
              contractFile && onOpenModules ? (
                <Button size="sm" onPress={onOpenModules}>
                  {t("grade.openContract")}
                </Button>
              ) : undefined
            }
          >
            {t("grade.exampleHint")}
          </Notice>
        </View>
      )}

      <View accessibilityLiveRegion="polite">
        {weightsOk && result.final === null && (
          <View style={{ marginBottom: space[3], gap: space[1.5] }}>
            <Text size="small" weight="medium" tone="muted">
              {t("grade.target")}
            </Text>
            <Segmented
              testID="segment.gradeTarget"
              label={t("grade.target")}
              value={aim}
              onChange={setTarget}
              options={CONTRACT_LETTERS.slice(0, 5).map((letter) => ({ value: letter, label: letter }))}
            />
          </View>
        )}
        <Text size="heading" weight="semibold" tone={answerTone}>
          {answer}
        </Text>
        {weightsOk && result.final === null && (
          <Text size="small" tone="muted" style={{ marginTop: space[2] }}>
            {`${t("grade.answer.others")}:`}
            {result.needs
              .filter((n) => n.letter !== aim)
              .map((n) => (
                <Text key={n.letter} size="small" tone={n.need === null && !n.reached ? "faint" : "muted"} tabular>
                  {"   "}
                  <Text size="small" weight="semibold">
                    {n.letter}
                  </Text>
                  {` ${n.reached ? t("grade.secured") : n.need === null ? t("grade.outOfReach") : `≥ ${n.need}`}`}
                </Text>
              ))}
          </Text>
        )}
      </View>

      <View style={{ marginTop: space[5], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>
        <View style={[styles.tableRow, { paddingVertical: space[1.5] }]}>
          <Text size="caption" weight="medium" tone="faint" style={{ flex: 1 }}>
            {t("grade.part")}
          </Text>
          <Text
            size="caption"
            weight={!fix && !sumOk ? "semibold" : "medium"}
            tone={!fix && !sumOk ? "warning" : "faint"}
            style={{ width: COL_WEIGHT, textAlign: "right" }}
          >
            {t("grade.weight")}
          </Text>
          <Text size="caption" weight="medium" tone="faint" style={{ width: COL_SCORE, textAlign: "right" }}>
            {t("grade.score")}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        {contract.parts.map((part) => {
          const name = nameOf(part);
          const fromSix = part.attendance && attendance !== null;
          return (
            <View
              key={part.id}
              testID={`row.gradePart.${part.id}`}
              style={[styles.tableRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
            >
              <PartName name={name} onRename={(next) => setPart(part.id, { name: next })} />
              <View style={{ width: COL_WEIGHT, flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-start", gap: 4 }}>
                <ScoreInput
                  testID={`input.gradeWeight.${part.id}`}
                  label={t("grade.weightOf", { part: name })}
                  value={part.weight}
                  required
                  highlight={!fix && !sumOk}
                  width={52}
                  onProblem={mark(`w:${part.id}`)}
                  onValue={(value) => setPart(part.id, { weight: value ?? 0 })}
                />
                <Text size="body" tone="faint" style={{ paddingTop: 10 }}>
                  %
                </Text>
              </View>
              <View style={{ width: COL_SCORE, alignItems: "flex-end" }}>
                {fromSix ? (
                  // One text, the figure over where it comes from ("66 dari SIX").
                  <Text size="body" weight="semibold" tabular style={{ textAlign: "right", paddingTop: 4 }}>
                    {String(partScore(part, attendance))}
                    {"\n"}
                    <Text size="caption" weight="regular" tone="faint">
                      {t("grade.fromSixShort")}
                    </Text>
                  </Text>
                ) : (
                  <ScoreInput
                    testID={`input.gradeScore.${part.id}`}
                    label={t("grade.scoreOf", { part: name })}
                    value={part.score}
                    placeholder="-"
                    onProblem={mark(`s:${part.id}`)}
                    onValue={(value) => setPart(part.id, { score: value })}
                  />
                )}
              </View>
              <IconButton
                label={t("grade.remove", { part: name })}
                onPress={() => save({ ...contract, parts: contract.parts.filter((p) => p.id !== part.id) })}
              >
                <Icons.X size={14} color={c.muted} />
              </IconButton>
            </View>
          );
        })}
        {/* What changes the table, at its foot: a part more, or the example weights back; and the total. */}
        <View style={[styles.tableRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, alignItems: "center" }]}>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", marginLeft: -space[3] }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icons.Plus size={14} color={c.muted} />}
              disabled={contract.parts.length >= 20}
              testID="action.gradeAdd"
              onPress={() => save({ ...contract, parts: [...contract.parts, { id: `p${Date.now().toString(36)}`, name: "", weight: 0, score: null }] })}
            >
              {t("grade.add")}
            </Button>
            {!isExample && (
              <Button variant="ghost" size="sm" onPress={reset} testID="action.gradeReset">
                {t("grade.reset")}
              </Button>
            )}
          </View>
          <Text
            size="body"
            weight="semibold"
            tabular
            tone={fix || sumOk ? "muted" : "warning"}
            style={{ width: COL_WEIGHT, textAlign: "right", paddingRight: 14 }}
          >
            {`${f.number(result.totalWeight, 0)}%`}
          </Text>
          <View style={{ width: COL_SCORE + 44 }} />
        </View>
        <View style={{ marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>
          <Text size="small" tone="muted" style={{ marginBottom: space[2] }} accessibilityRole="header">
            {t("grade.cutoffs")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[2] }}>
            {CONTRACT_LETTERS.map((letter) => (
              <View key={letter} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <Text size="small" weight="semibold" style={{ paddingTop: 10, minWidth: 30 }}>
                  {`${letter} ≥`}
                </Text>
                <ScoreInput
                  testID={`input.gradeCutoff.${letter}`}
                  label={t("grade.cutoffOf", { letter })}
                  value={contract.cutoffs[letter]}
                  required
                  width={52}
                  onProblem={mark(`c:${letter}`)}
                  onValue={(value) => save({ ...contract, cutoffs: { ...contract.cutoffs, [letter]: value ?? 0 } })}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const COL_WEIGHT = 76;
const COL_SCORE = 68;

const styles = StyleSheet.create({
  tableRow: { flexDirection: "row", alignItems: "flex-start", gap: space[2], paddingVertical: space[2] },
  input: { height: 40, borderRadius: radius.md, paddingHorizontal: space[2], textAlign: "right", fontSize: 16, fontVariant: ["tabular-nums"] },
});
