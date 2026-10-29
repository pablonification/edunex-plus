// Rencana studi › Rencana on the phone (src/app/screens/plan/planner.tsx, S12): semesters from now
// to graduation, courses from SIX's public catalog and retakes, every rule checked live, and
// expected grades projecting each semester's IP, the IPK at graduation, honors and what the one
// shared target needs. Same functions as the desktop (src/core/planner), so the two never
// disagree. The desktop clicks and hovers; the phone taps and uses sheets: a course's grade is a
// sheet of grades, its other actions (move it to another semester, remove it, leave it out this
// semester) a sheet behind its ⋯ or a long press, adding a course a sheet with search, a minor
// up close a sheet. Every change that loses something can be taken back from its toast. The plan
// stays on this phone; the app never sends a KRS.
import { type ReactNode, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { type PlanState, useCurriculumFix, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { nearestLetter } from "../../../../src/core/honors";
import type { HideReason, LetterGrade, PlannedCourse, StudyPlan } from "../../../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  addCourse,
  addShortTerm,
  addTerm,
  addToNow,
  type CourseInfo,
  type CourseState,
  canRemoveTerm,
  checkPlan,
  courseInfo,
  courseRole,
  courseState,
  defaultPlan,
  expectedGrade,
  hasWhatIfs,
  hideReasons,
  hideRule,
  isHidden,
  leaveOut,
  livePlan,
  MAX_SKS,
  type MinorOption,
  minorProgress,
  NORMAL_SKS,
  notContinuing,
  onlyFor,
  type ProjectedStep,
  packageKey,
  passedSks,
  planMinor,
  plannedCodes,
  programElectives,
  putBack,
  type Rule,
  type RuleLevel,
  rankedMinors,
  removeCourse,
  removeTerm,
  removeTried,
  retakeCandidates,
  ruleKey,
  SHORT_SKS,
  type Shortfall,
  type SksModel,
  type StudentRecord,
  searchCourses,
  semesterOf,
  setGrade,
  shortTermToAdd,
  showRule,
  sksModel,
  startingIpk,
  stopFollowing,
  targetOf,
  termKind,
  untried,
  withWhatIf,
} from "../../../../src/core/planner";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { dismissToast, toast } from "../../swaps/overlays";
import { Button, Chip, ChipRow, IconButton } from "../../ui/controls";
import { Card, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { ActionSheet, Sheet, type SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { type Palette, radius, space, type, useTheme } from "../../ui/theme";
import { usePlaceState } from "./place-state";
import { GradeSelect, HonorsList, IpkChart, NeedText, predicateFor, TargetControl, usePredicate, useTermLabel } from "./projection";
import { SixNeeded } from "./six-needed";

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const record = useStudentRecord();
  const state = usePlan(record);
  if (!record || !state)
    return (
      <SixNeeded
        datasets={["six.curriculum", "six.transcript"]}
        icon={<Icons.BookOpen size={20} color={theme.color.muted} />}
        title={t("planner.needSix")}
        body={t("planner.needSixBody")}
        action={
          onCalendar && (
            <Button variant="ghost" onPress={onCalendar} testID="action.toCalendar">
              {t("plan.toCalendar")}
            </Button>
          )
        }
      />
    );
  return <Planner real={record} record={state.record} state={state} />;
}

/** Changes the plan, offering to take it back; `offer` offers taking back a change made elsewhere. */
type Undoable = ((edit: (plan: StudyPlan) => StudyPlan, message: string) => void) & { offer(undo: () => void, message: string): void };

/**
 * A plan change that can be taken back: a toast with "Urungkan". `offer` does the same for a
 * change kept apart from the plan (a required course the program will add), so the newest change
 * is always the one taken back, whatever kind it is.
 */
function useUndoable(state: PlanState): Undoable {
  const t = useT();
  const last = useRef<(() => void) | null>(null);
  const shown = useRef<number | null>(null);
  const offer = (undo: () => void, message: string) => {
    const take = () => {
      if (last.current !== take) return;
      undo();
      last.current = null;
      if (shown.current !== null) dismissToast(shown.current);
    };
    last.current = take;
    // Only the latest change can be taken back (an older undo would throw away what came after it), so its toast replaces the last one.
    if (shown.current !== null) dismissToast(shown.current);
    shown.current = toast(message, "neutral", { label: t("planner.undo"), onClick: take });
  };
  const edit = (change: (plan: StudyPlan) => StudyPlan, message: string) => {
    const before = state.base;
    state.update(change);
    offer(() => state.update(() => before), message);
  };
  return Object.assign(edit, { offer });
}

/** How many of the plan's what-ifs still change this term. */
function whatIfCount(record: StudentRecord, plan: StudyPlan): number {
  const applied = withWhatIf(record, plan);
  return applied.thisTermAdded.length + applied.thisTermDropped.length;
}

/** What a reset would throw away, compared with the starting plan (from SIX's own record: a reset ends this term's what-ifs). Hidden warnings stay. */
function resetLoss(record: StudentRecord, plan: StudyPlan): { grades: number; added: number; removed: number; terms: number; whatIfs: number; other: boolean } {
  const start = livePlan(defaultPlan(record, plan.hidden), record);
  const startCourses = new Map(start.terms.flatMap((term) => term.courses.map((c) => [c.code, c] as const)));
  // A course tried this semester still counts where it was planned: its what-if is counted on its own.
  const live = livePlan(untried(plan), record);
  const now = live.terms.flatMap((term) => term.courses);
  const startTerms = new Set(start.terms.map((term) => term.term));
  return {
    grades: Object.keys(plan.expected).length + now.filter((c) => startCourses.has(c.code) && startCourses.get(c.code)!.grade !== c.grade).length,
    added: now.filter((c) => !startCourses.has(c.code)).length,
    removed: [...startCourses.keys()].filter((code) => !now.some((c) => c.code === code)).length,
    terms: live.terms.filter((term) => !startTerms.has(term.term)).length,
    whatIfs: whatIfCount(record, plan),
    other: plan.target !== null || plan.minor !== start.minor,
  };
}

/** A course's sheet: who it is, and what the Student can do with it there. */
interface Acting {
  code: string;
  name: string;
  choices: SheetChoice[];
}

/** `real`: SIX's own record; `record`: with this term's what-ifs, which every figure here counts. */
function Planner({ real, record, state }: { real: StudentRecord; record: StudentRecord; state: PlanState }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const termLabel = useTermLabel();
  const { plan, projection, update } = state;
  const [adding, setAdding] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting | null>(null);
  const undoable = useUndoable(state);
  const rules = checkPlan(record, plan, projection);
  const minor = activeMinor(record, plan);
  const spec = activeSpecialization(record, plan);
  const stepOf = new Map(projection.steps.map((s) => [s.term, s]));
  const short = shortTermToAdd(plan, record);
  const loss = resetLoss(real, state.base);
  const lossParts = [
    loss.grades && t("planner.reset.grades", { n: loss.grades, count: loss.grades }),
    loss.added && t("planner.reset.added", { n: loss.added, count: loss.added }),
    loss.terms && t("planner.reset.terms", { n: loss.terms, count: loss.terms }),
    loss.removed && t("planner.reset.removed", { n: loss.removed, count: loss.removed }),
    loss.whatIfs && t("planner.reset.whatIfs", { n: loss.whatIfs, count: loss.whatIfs }),
    loss.other && t("planner.reset.other"),
  ].filter((part): part is string => Boolean(part));
  // A course's own warning (odd/even, earlier than the curriculum), shown on its row unless the Student hid it.
  const flags = new Map<string, Extract<Rule, { id: "parity" | "early" }>>();
  for (const rule of rules) if ((rule.id === "parity" || rule.id === "early") && !isHidden(rule, plan)) flags.set(`${rule.term}|${rule.code}`, rule);
  const whatIf = hasWhatIfs(plan, record);
  const added = new Set(record.thisTermAdded);
  const leftOut = new Set(record.thisTermDropped.map((c) => c.code));
  // This semester in SIX's KRS order, a course left out crossed out where it was, then the ones tried.
  const nowCourses = [...real.thisTerm, ...record.thisTerm.filter((c) => added.has(c.code))];
  const nowLabel = record.semesterNow ? t("planner.now", { n: record.semesterNow }) : t("planner.nowPlain");
  const sksOf = (term: string) => plan.terms.find((p) => p.term === term)?.courses.reduce((sum, c) => sum + c.sks, 0) ?? 0;
  const limitOf = (term: string) => (termKind(term) === "short" ? SHORT_SKS : MAX_SKS);
  const confirmReset = () =>
    Alert.alert(t("planner.resetTitle"), lossParts.length ? t("planner.resetBody", { list: f.list(lossParts) }) : t("planner.resetNothing"), [
      { text: t("action.cancel"), style: "cancel" },
      { text: t("planner.resetConfirm"), style: "destructive", onPress: () => undoable((p) => defaultPlan(real, p.hidden), t("planner.resetDone")) },
    ]);

  return (
    <View style={{ gap: space[4] }}>
      <SixPageNote datasets={["six.curriculum"]} />
      <UnreadNote record={record} />
      <Summary record={record} state={state} rules={rules} />
      <Past record={record} steps={projection.steps.filter((s) => !s.projected && s.term !== record.term)} />
      {/* Shown while this term's KRS is still empty too: that's when trying courses matters most. */}
      {record.term ? (
        <TermBlock
          term={record.term}
          title={nowLabel}
          subtitle={whatIf ? t("planner.nowWhatIf") : t("planner.nowSub")}
          whatIf={whatIf}
          sks={record.thisTerm.reduce((sum, c) => sum + c.sks, 0)}
          limit={whatIf ? limitOf(record.term) : null}
          step={stepOf.get(record.term)}
          onAdd={() => setAdding(record.term)}
          addLabel={t("planner.addWhatIf")}
        >
          {nowCourses.map((course) => {
            const mine = added.has(course.code);
            const term = record.term!;
            if (leftOut.has(course.code))
              return (
                <DroppedLine
                  key={course.code}
                  code={course.code}
                  name={course.name}
                  sks={course.sks}
                  onPutBack={() => undoable((p) => putBack(p, term, course.code), t("planner.putBackDone", { code: course.code }))}
                />
              );
            // A course SIX already graded stays: there's nothing to try without it.
            const choices: SheetChoice[] =
              course.grade === null
                ? [
                    {
                      label: t(mine ? "planner.removeCourse" : "planner.leaveOut", { code: course.code }),
                      icon: mine ? <Icons.X size={20} color={theme.color.dangerFg} /> : <Icons.Minus size={20} color={theme.color.fg} />,
                      tone: mine ? "danger" : "fg",
                      onPress: () =>
                        undoable(
                          (p) => (mine ? removeTried(p, term, course.code) : leaveOut(p, term, course.code)),
                          t(mine ? "planner.removedNow" : "planner.leftOut", { code: course.code }),
                        ),
                      testID: "action.removeCourse",
                    },
                  ]
                : [];
            return (
              <CourseLine
                key={course.code}
                code={course.code}
                name={course.name}
                sks={course.sks}
                tag={mine ? <WhatIfTag /> : <RoleTag record={record} code={course.code} minor={minor} spec={spec} />}
                flag={mine ? flags.get(`${term}|${course.code}`) : undefined}
                grade={course.grade ?? expectedGrade(record, plan, course.code)}
                guess={plan.expected[course.code] === undefined}
                posted={course.grade !== null}
                onGrade={(grade) => update((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                onMore={choices.length ? () => setActing({ code: course.code, name: course.name, choices }) : undefined}
              />
            );
          })}
          {nowCourses.length === 0 && <Empty text={t("planner.nowEmpty")} />}
        </TermBlock>
      ) : null}
      {plan.terms.map((term) => {
        const semester = semesterOf(term.term, record.entryTerm);
        const label = termLabel(term.term, semester);
        return (
          <TermBlock
            key={term.term}
            term={term.term}
            title={label}
            subtitle={t("planner.plannedSub")}
            sks={term.courses.reduce((sum, c) => sum + c.sks, 0)}
            limit={termKind(term.term) === "short" ? 9 : 24}
            step={stepOf.get(term.term)}
            onRemove={
              canRemoveTerm(plan, term.term)
                ? () =>
                    // The courses the Student sees: a hidden copy of one taken already (in the KRS, passed) isn't lost with it.
                    undoable((p) => removeTerm(p, term.term), t("planner.removedTerm", { term: label, count: term.courses.length }))
                : undefined
            }
            removeLabel={t("planner.removeTerm", { term: label })}
            onAdd={() => setAdding(term.term)}
          >
            {term.courses.map((course) => {
              // Moving is the phone's way of the desktop's planning a course in another semester: one tap, the same addCourse.
              const moves: SheetChoice[] = plan.terms
                .filter((other) => other.term !== term.term)
                .map((other) => {
                  const otherLabel = termLabel(other.term, semesterOf(other.term, record.entryTerm));
                  return {
                    label: t("mobile.planner.moveTo", { term: otherLabel }),
                    hint: `${sksOf(other.term)} / ${limitOf(other.term)} SKS`,
                    icon: <Icons.ArrowRight size={20} color={theme.color.fg} />,
                    onPress: () => undoable((p) => addCourse(p, other.term, course), t("mobile.planner.moved", { code: course.code, term: otherLabel })),
                    testID: `action.moveTo.${other.term}`,
                  };
                });
              return (
                <CourseLine
                  key={course.code}
                  code={course.code}
                  name={course.name}
                  sks={course.sks}
                  tag={
                    course.retake ? (
                      <Tag>{t("planner.role.retake", { grade: record.graded.get(course.code)?.grade ?? "-" })}</Tag>
                    ) : (
                      <RoleTag record={record} code={course.code} minor={minor} spec={spec} />
                    )
                  }
                  flag={flags.get(`${term.term}|${course.code}`)}
                  grade={course.grade}
                  onGrade={(grade) => update((p) => setGrade(p, term.term, course.code, grade))}
                  onMore={() =>
                    setActing({
                      code: course.code,
                      name: course.name,
                      choices: [
                        ...moves,
                        {
                          label: t("planner.removeCourse", { code: course.code }),
                          icon: <Icons.X size={20} color={theme.color.dangerFg} />,
                          tone: "danger",
                          onPress: () => undoable((p) => removeCourse(p, term.term, course.code), t("planner.removedCourse", { code: course.code })),
                          testID: "action.removeCourse",
                        },
                      ],
                    })
                  }
                />
              );
            })}
            {term.courses.length === 0 && <Empty text={t("planner.nothing")} />}
          </TermBlock>
        );
      })}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
        <Button icon={<Icons.Plus size={14} />} onPress={() => update((p) => addTerm(p, record))} testID="action.addTerm">
          {t("planner.addTerm")}
        </Button>
        {short ? (
          <Button icon={<Icons.Plus size={14} />} onPress={() => update((p) => addShortTerm(p, record))} testID="action.addShortTerm">
            {t("planner.addShort")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          icon={<Icons.RefreshCw size={14} color={theme.color.muted} />}
          disabled={!lossParts.length}
          onPress={confirmReset}
          testID="action.resetPlan"
        >
          {t("planner.reset")}
        </Button>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icons.Lock size={12} color={theme.color.faint} />
        <Text size="caption" tone="faint" style={{ flex: 1 }}>
          {t("planner.local")}
        </Text>
      </View>
      <View style={{ marginTop: space[4], gap: space[4] }}>
        <Rules record={record} rules={rules} plan={plan} undoable={undoable} />
        <Outlook record={record} state={state} />
        <Minors record={record} state={state} undoable={undoable} />
      </View>
      {adding && (
        <AddCourse
          record={record}
          state={state}
          now={adding === record.term}
          title={
            adding === record.term
              ? t("planner.addToNow", { term: nowLabel })
              : t("planner.addTo", { term: termLabel(adding, semesterOf(adding, record.entryTerm)) })
          }
          onAdd={(course) =>
            adding === record.term
              ? undoable((p) => addToNow(p, adding, course), t("planner.addedNow", { code: course.code }))
              : update((p) => addCourse(p, adding, course))
          }
          onClose={() => setAdding(null)}
        />
      )}
      <ActionSheet
        open={acting !== null}
        onClose={() => setActing(null)}
        title={acting ? `${acting.code} ${acting.name}` : undefined}
        choices={acting?.choices ?? []}
        testID="sheet.plannedCourse"
      />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Text size="small" tone="faint" style={{ paddingHorizontal: space[4], paddingVertical: space[3] }}>
      {text}
    </Text>
  );
}

// ------------------------------------------------------------ summary

/** "kurang 5 SKS dan 2 mata kuliah wajib": what stands between the plan and graduating. */
function useShortfallText(): (shortfall: Shortfall) => string {
  const t = useT();
  const f = useFormat();
  return (s) =>
    f.list(
      [
        s.sks > 0 && t("planner.short.sks", { n: s.sks }),
        s.required > 0 && t("planner.short.required", { n: s.required, count: s.required }),
        s.electives > 0 && t("planner.short.electives", { n: s.electives }),
        s.other > 0 && t("planner.short.other", { n: s.other, count: s.other }),
      ].filter((part): part is string => Boolean(part)),
    );
}

function Summary({ record, state, rules }: { record: StudentRecord; state: PlanState; rules: Rule[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const predicate = usePredicate();
  const shortfall = useShortfallText();
  const { plan, projection } = state;
  const sks = sksModel(record, plan);
  const finish = rules.find((r): r is Extract<Rule, { id: "finish" }> => r.id === "finish");
  const warnings = rules.filter((r) => r.level === "warn" && !isHidden(r, plan)).length;
  const word = predicate(predicateFor(projection.finalIpk, projection.path));
  return (
    <Card variant="raised" style={{ paddingHorizontal: space[4], paddingVertical: space[4] }} testID="card.planSummary">
      {record.program && (
        <Text size="small" weight="medium" tone="muted">
          {t("planner.program", { name: record.program.name })}
        </Text>
      )}
      <Text size="heading" weight="semibold" tabular style={{ marginTop: space[1], letterSpacing: -0.3 }}>
        {sks.short ? t("planner.sksShort", { total: sks.total, need: sks.need }) : t("planner.sksDone", { need: sks.need })}
        {sks.short || sks.extra ? (
          <Text size="body" weight="semibold" tone={sks.short ? "danger" : "success"}>
            {`  ${sks.short ? t("planner.sksShortBy", { short: sks.short }) : t("planner.sksSpare", { extra: sks.extra })}`}
          </Text>
        ) : null}
      </Text>
      <View style={{ marginTop: space[3], flexDirection: "row", gap: space[6] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="caption" weight="medium" tone="muted">
            {t("planner.graduate")}
          </Text>
          {finish?.blocked ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icons.AlertTriangle size={16} color={theme.color.dangerFg} />
                <Text size="title" weight="semibold" tone="danger">
                  {t("planner.notYet")}
                </Text>
              </View>
              <Text size="caption" tone="muted" accessibilityLiveRegion="polite">
                {t("planner.shortfall", { list: shortfall(finish.blocked) })}
              </Text>
            </>
          ) : (
            <>
              <Text size="title" weight="semibold">
                {finish ? t("planner.semester", { n: finish.semester }) : "-"}
              </Text>
              <Text size="caption" weight="medium" tone={warnings ? "warning" : "muted"} accessibilityLiveRegion="polite">
                {warnings
                  ? t("planner.toCheck", { count: warnings })
                  : finish && finish.semester > finish.normal
                    ? t("planner.late", { normal: finish.normal })
                    : t("planner.onTime")}
              </Text>
            </>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="caption" weight="medium" tone="muted">
            {t("grades.graduation")}
          </Text>
          <Text size="title" weight="semibold" tabular>
            {projection.finalIpk === null ? "-" : f.number(projection.finalIpk, 2)}
          </Text>
          {word ? (
            <Text size="caption" weight={projection.honor ? "semibold" : "regular"} tone={projection.honor ? "success" : "muted"}>
              {word}
            </Text>
          ) : null}
        </View>
      </View>
      <SksBar sks={sks} />
    </Card>
  );
}

/** Passed, this semester and planned against what graduating needs, with its legend. */
function SksBar({ sks }: { sks: SksModel }) {
  const t = useT();
  const theme = useTheme();
  const scale = Math.max(sks.need, sks.total) || 1;
  const share = (n: number) => `${(n / scale) * 100}%` as const;
  const parts: { n: number; label: string; color: keyof Palette; opacity: number }[] = [
    { n: sks.passed, label: t("planner.legend.passed", { n: sks.passed }), color: "meterSuccess", opacity: 1 },
    { n: sks.inProgress, label: t("planner.legend.now", { n: sks.inProgress }), color: "meterSuccess", opacity: 0.45 },
    { n: sks.planned, label: t("planner.legend.planned", { n: sks.planned }), color: "infoFg", opacity: 0.55 },
    // Only once the Student said their program will add a required course.
    ...(sks.byProgram ? [{ n: sks.byProgram, label: t("planner.legend.byProgram", { n: sks.byProgram }), color: "infoFg" as const, opacity: 0.25 }] : []),
  ];
  return (
    <View style={{ marginTop: space[4] }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t("planner.progress")}
        accessibilityValue={{ min: 0, max: sks.need, now: Math.min(sks.total, sks.need) }}
        // The meters' own track and green, so what has passed reads 3:1 on it in both themes.
        style={{ flexDirection: "row", gap: 2, height: 10, borderRadius: radius.full, overflow: "hidden", backgroundColor: theme.color.meterTrack }}
      >
        {parts.map((part) => (
          <View key={part.label} style={{ height: "100%", width: share(part.n), backgroundColor: theme.color[part.color], opacity: part.opacity }} />
        ))}
        {sks.total > sks.need && <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, left: share(sks.need), backgroundColor: theme.color.fg }} />}
      </View>
      <View style={{ marginTop: space[2], flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[1] }}>
        {parts.map((part) => (
          <View key={part.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color[part.color], opacity: part.opacity }} />
            <Text size="caption" tone="muted" tabular>
              {part.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------ semesters

/** The semesters behind the Student, folded: "Semester 1–6 · 125 SKS lulus · IPK 3,26". `action.planner.past` opens it. */
function Past({ record, steps }: { record: StudentRecord; steps: ProjectedStep[] }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const termLabel = useTermLabel();
  const [open, setOpen] = usePlaceState("planner.past", false);
  if (!steps.length) return null;
  const ipk = record.transcript ? (record.transcript.ipk.six ?? record.transcript.ipk.computed) : null;
  const last = steps.at(-1)?.semester ?? steps.length;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        android_ripple={{ color: theme.color.selected }}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 52 }}
        testID="action.planner.past"
      >
        <View testID={open ? "action.planner.past.open" : undefined} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icons.ChevronRight size={16} color={theme.color.faint} />
        </View>
        <View style={{ flex: 1 }}>
          <Meta tone="muted">
            <Text size="body" weight="semibold">
              {t("planner.past", { n: last })}
            </Text>
            {t("planner.pastMeta", { sks: passedSks(record) ?? "-", ipk: ipk === null ? "-" : f.number(ipk, 2) })}
          </Meta>
        </View>
      </Pressable>
      {open && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.color.line,
            backgroundColor: theme.color.sunken,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            gap: space[2.5],
          }}
        >
          {steps.map((s) => (
            <View key={s.term}>
              <Text size="small" weight="medium">
                {termLabel(s.term, s.semester)}
              </Text>
              <Meta>
                {`IP ${s.ip === null ? "-" : f.number(s.ip, 2)}`}
                {`${s.sks ?? "-"} SKS`}
              </Meta>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function TermBlock({
  term,
  title,
  subtitle,
  whatIf = false,
  sks,
  limit,
  step,
  onAdd,
  addLabel,
  onRemove,
  removeLabel,
  children,
}: {
  term: string;
  title: string;
  subtitle: string;
  /** The semester holds what-ifs: the subtitle says they're only in the plan. */
  whatIf?: boolean;
  sks: number;
  limit: number | null;
  step: ProjectedStep | undefined;
  onAdd?: () => void;
  addLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const over = limit !== null && sks > limit;
  return (
    <Card testID={`card.term.${term}`}>
      <View style={{ paddingLeft: space[4], paddingRight: onRemove ? space[1] : space[4], paddingVertical: space[2.5], gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text size="body" weight="semibold" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </Text>
          {onRemove && (
            <IconButton label={removeLabel ?? ""} onPress={onRemove} testID={`action.removeTerm.${term}`}>
              <Icons.X size={16} color={theme.color.muted} />
            </IconButton>
          )}
        </View>
        {whatIf ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityLiveRegion="polite">
            <Icons.Info size={12} color={theme.color.infoFg} weight="bold" />
            <Meta size="caption" tone="fg">
              <Text size="caption" weight="medium" tone="info">
                {subtitle}
              </Text>
            </Meta>
          </View>
        ) : (
          <Text size="caption" tone="faint">
            {subtitle}
          </Text>
        )}
        <View style={{ marginTop: space[1], flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space[3], rowGap: 2 }}>
          <Text size="small" weight="semibold" tone={over ? "danger" : "muted"} tabular>
            {`${sks}${limit !== null ? ` / ${limit}` : ""} SKS`}
          </Text>
          {step && (
            <>
              <Text size="small" weight="semibold" tabular>
                {`IP ${step.ip === null ? "-" : f.number(step.ip, 2)}`}
              </Text>
              <Text size="caption" tone="faint" tabular>
                {t("planner.ipkAfter", { ipk: step.ipk === null ? "-" : f.number(step.ipk, 2) })}
              </Text>
            </>
          )}
        </View>
      </View>
      {children}
      {onAdd && (
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          android_ripple={{ color: theme.color.selected }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            minHeight: 48,
            paddingHorizontal: space[4],
            borderTopWidth: 1,
            borderTopColor: theme.color.line,
          }}
          testID={`action.addCourse.${term}`}
        >
          <Icons.Plus size={14} color={theme.color.accentFg} />
          <Text size="small" weight="semibold" tone="accent">
            {addLabel ?? t("planner.addCourse")}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

/** "Hanya di rencana": a course tried in the plan, dashed because it isn't real. */
export function WhatIfTag() {
  const t = useT();
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radius.tag,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: theme.color.infoFg,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text size="micro" weight="semibold" tone="info">
        {t("planner.whatIfTag")}
      </Text>
    </View>
  );
}

/** Only "Wajib" earns a tag: the other kinds (electives, specialization, minor) are most rows, and the rules already count them. */
function RoleTag({ record, code, minor, spec }: { record: StudentRecord; code: string; minor: MinorOption | null; spec: StudentRecord["specialization"] }) {
  const t = useT();
  if (courseRole(record, code, minor, spec) !== "required") return null;
  const semester = record.required.get(code)?.semester ?? record.requiredLeft.find((c) => c.code === code)?.semester;
  return <Tag tone="info">{t("planner.role.required", { n: semester ?? "-" })}</Tag>;
}

/**
 * A course's row in a semester: its name, then its code, tag and SKS on the line under it (a phone's
 * width keeps the name readable), its grade, and ⋯ for what else can be done with it (a long press
 * opens the same sheet).
 */
function CourseLine({
  code,
  name,
  sks,
  tag,
  flag,
  grade,
  guess,
  posted,
  onGrade,
  onMore,
}: {
  code: string;
  name: string;
  sks: number;
  tag: ReactNode;
  flag?: Extract<Rule, { id: "parity" | "early" }>;
  grade: LetterGrade;
  guess?: boolean;
  posted?: boolean;
  onGrade: (grade: LetterGrade) => void;
  onMore?: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable
      onLongPress={onMore}
      accessibilityLabel={factsLabel(code, name, `${sks} SKS`)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        paddingLeft: space[4],
        paddingRight: onMore ? space[1] : space[4],
        paddingVertical: space[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.color.line,
      }}
      testID={`row.course.${code}`}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size="body" numberOfLines={3}>
          {name}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2], rowGap: 2 }}>
          <Text size="small" weight="semibold" tabular>
            {code}
          </Text>
          {tag}
          <Text size="small" tone="muted" tabular>
            {`${sks} SKS`}
          </Text>
        </View>
        {flag && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icons.AlertTriangle size={12} color={theme.color.warningFg} weight="bold" />
            <Text size="caption" weight="medium" tone="warning">
              {flag.id === "parity"
                ? t("planner.flag.parity", { kind: t(flag.semester % 2 === 1 ? "rule.parity.odd" : "rule.parity.even") })
                : t("planner.flag.early")}
            </Text>
          </View>
        )}
      </View>
      {posted ? (
        <View
          accessibilityLabel={`${t("grades.sixGrade")}: ${grade}`}
          style={{ minWidth: 60, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.neutralBg }}
        >
          <Text size="small" weight="bold" style={{ color: theme.color.neutralFg }}>
            {grade}
          </Text>
        </View>
      ) : (
        <GradeSelect label={t("grades.expectedOf", { code })} value={grade} guess={guess} onChange={onGrade} testID={`action.grade.${code}`} />
      )}
      {onMore ? (
        <IconButton label={t("mobile.planner.options", { code })} onPress={onMore} testID={`action.courseOptions.${code}`}>
          <Icons.MoreHorizontal size={20} color={theme.color.muted} />
        </IconButton>
      ) : null}
    </Pressable>
  );
}

/** A KRS course the Student left out as a what-if: crossed out where it was, with the way back. */
function DroppedLine({ code, name, sks, onPutBack }: { code: string; name: string; sks: number; onPutBack: () => void }) {
  const t = useT();
  const theme = useTheme();
  const struck = { textDecorationLine: "line-through" } as const;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        paddingLeft: space[4],
        paddingRight: space[2],
        paddingVertical: space[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.color.line,
      }}
      testID={`row.course.${code}`}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size="body" tone="muted" style={struck}>
          {name}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
          <Text size="small" weight="semibold" tone="muted" tabular style={struck}>
            {code}
          </Text>
          <Text size="small" tone="muted" tabular style={struck}>
            {`${sks} SKS`}
          </Text>
        </View>
        <Text size="caption" tone="info">
          {t("planner.droppedTag")}
        </Text>
      </View>
      <Button size="sm" variant="ghost" label={t("planner.putBackCode", { code })} onPress={onPutBack} testID={`action.putBack.${code}`}>
        <Text size="small" weight="semibold" tone="accent">
          {t("planner.putBack")}
        </Text>
      </Button>
    </View>
  );
}

// ------------------------------------------------------------ rules and the outlook

const LEVEL_MARK: Record<RuleLevel, { bg: keyof Palette; fg: keyof Palette; label: "planner.ruleOk" | "planner.ruleWarn" | "planner.ruleError" }> = {
  ok: { bg: "successBg", fg: "successFg", label: "planner.ruleOk" },
  warn: { bg: "warningBg", fg: "warningFg", label: "planner.ruleWarn" },
  error: { bg: "dangerBg", fg: "dangerFg", label: "planner.ruleError" },
};

function useRuleText(record: StudentRecord): (rule: Rule) => { title: string; detail: string } {
  const t = useT();
  const termLabel = useTermLabel();
  const shortfall = useShortfallText();
  const list = (items: { code: string; name: string }[]) => items.map((c) => `${c.code} ${c.name}`).join(", ");
  return (rule) => {
    switch (rule.id) {
      case "total": {
        const extra = rule.have - rule.need;
        return {
          title:
            extra > 0
              ? t("rule.total.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.total.exact", { need: rule.need })
                : t("rule.total", { have: rule.have, need: rule.need }),
          detail: rule.level === "ok" ? t("rule.total.ok") : t("rule.total.short", { short: rule.need - rule.have }),
        };
      }
      case "required": {
        const detail = rule.missing.length
          ? t("rule.missing", { list: list(rule.missing) })
          : rule.total
            ? t("rule.required.okCount", { count: rule.total })
            : t("rule.required.ok");
        // Honest about what the Student's own corrections decided.
        const corrected = rule.corrected.length ? t("rule.required.corrected", { list: list(rule.corrected), count: rule.corrected.length }) : null;
        const byProgram = rule.byProgram.length ? t("rule.required.byProgram", { list: list(rule.byProgram) }) : null;
        return { title: t("rule.required"), detail: [detail, corrected, byProgram].filter(Boolean).join(" ") };
      }
      case "electives": {
        const extra = rule.have - rule.need;
        return {
          title: t("rule.electives"),
          detail:
            extra > 0
              ? t("rule.electives.done", { need: rule.need, extra })
              : extra === 0
                ? t("rule.electives.exact", { need: rule.need })
                : t("rule.electives.short", { have: rule.have, need: rule.need, short: -extra }),
        };
      }
      case "specialization":
        return {
          title: rule.name,
          detail: rule.missing.length ? t("rule.missing", { list: list(rule.missing) }) : t("rule.specialization.ok", { count: rule.total }),
        };
      case "minor":
        return { title: t("rule.minor", { name: rule.name }), detail: t("rule.minor.detail", { have: rule.have, need: rule.need }) };
      case "load":
        return {
          title: termLabel(rule.term, semesterOf(rule.term, record.entryTerm)),
          detail:
            rule.level === "error" ? t("rule.load.over", { sks: rule.sks, limit: rule.limit }) : t("rule.load.advisor", { sks: rule.sks, limit: rule.limit }),
        };
      case "parity": {
        const odd = rule.semester % 2 === 1;
        return {
          title: `${rule.code} ${rule.name}`,
          detail: t("rule.parity", {
            semester: rule.semester,
            parity: t(odd ? "rule.parity.odd" : "rule.parity.even"),
            kind: t(odd ? "rule.parity.even" : "rule.parity.odd"),
          }),
        };
      }
      case "early":
        return { title: `${rule.code} ${rule.name}`, detail: t("rule.early", { semester: rule.semester }) };
      case "finish":
        if (rule.blocked) return { title: t("rule.finish.blocked"), detail: t("rule.finish.blockedDetail", { list: shortfall(rule.blocked) }) };
        return {
          title: t("rule.finish", { n: rule.semester }),
          detail:
            rule.level === "ok"
              ? t("rule.finish.ok", { normal: rule.normal })
              : rule.semester <= 9
                ? t("rule.finish.late", { normal: rule.normal })
                : t("rule.finish.tooLate"),
        };
    }
  };
}

const ruleAnchor = (rule: Rule) => `rule-${rule.id}${"code" in rule ? `-${rule.code}` : ""}${"term" in rule ? `-${rule.term}` : ""}`;

/** What the Student set aside, in the quiet list under the rules: why, and how it comes back. */
interface SetAside {
  key: string;
  anchor: string;
  title: string;
  reason: HideReason;
  show: () => void;
}

/** A specialization's or minor's "not continuing", in the same step as its courses only it asks for leaving the plan, or staying. */
function useNotContinuing(record: StudentRecord, plan: StudyPlan, undoable: Undoable) {
  const t = useT();
  const f = useFormat();
  return ({
    key,
    title,
    codes,
    keep,
    label,
  }: {
    key: string;
    title: string;
    codes: readonly string[];
    keep: readonly string[];
    label: string;
  }): SheetChoice[] => {
    const drop = onlyFor(record, plan, codes, keep).map((c) => c.code);
    const stop = (gone: string[]) =>
      undoable(
        (p) => stopFollowing(p, key, Date.now(), gone),
        gone.length ? t("planner.notContinuingDropped", { title, count: gone.length }) : t("planner.notContinuingDone", { title }),
      );
    return [
      { label, hint: t(drop.length ? "planner.notContinuing.keepHint" : "planner.hideReason.not-continuingHint"), onPress: () => stop([]) },
      ...(drop.length
        ? [{ label: t("planner.notContinuing.drop"), hint: t("planner.notContinuing.dropHint", { list: f.list(drop) }), onPress: () => stop(drop) }]
        : []),
    ];
  };
}

/**
 * The rules, each warning with "Sembunyikan" and a reason; hidden ones wait in a quiet list to be
 * shown again. Errors decide graduating: they can't be hidden, but a required course the
 * Student's program will add can be settled right there (kept with the curriculum corrections,
 * listed with the hidden warnings, and taken back from there).
 */
function Rules({ record, rules, plan, undoable }: { record: StudentRecord; rules: Rule[]; plan: StudyPlan; undoable: Undoable }) {
  const t = useT();
  const theme = useTheme();
  const text = useRuleText(record);
  const setFix = useCurriculumFix();
  const notContinuingItems = useNotContinuing(record, plan, undoable);
  const [showHidden, setShowHidden] = usePlaceState("planner.hidden", false);
  const [menu, setMenu] = useState<{ title: string; choices: SheetChoice[] } | null>(null);
  const minor = activeMinor(record, plan);
  const spec = activeSpecialization(record, plan);
  const shownAgain = (title: string, edit: (p: StudyPlan) => StudyPlan) => () => undoable(edit, t("planner.shownDone", { title }));
  const hidden: SetAside[] = rules
    .filter((rule) => isHidden(rule, plan))
    .map((rule) => {
      const key = ruleKey(rule)!;
      const { title } = text(rule);
      return { key, anchor: ruleAnchor(rule), title, reason: plan.hidden?.[key]?.reason ?? "other", show: shownAgain(title, (p) => showRule(p, key)) };
    });
  // Not continuing still counts once the warning is gone (every course covered, or the minor no longer followed): it stays here to be taken back.
  const registeredSpec = record.specialization;
  const specKey = registeredSpec ? packageKey("specialization", registeredSpec.name) : null;
  if (registeredSpec && specKey && !spec && !hidden.some((h) => h.key === specKey))
    hidden.push({
      key: specKey,
      anchor: specKey,
      title: registeredSpec.name,
      reason: "not-continuing",
      show: shownAgain(registeredSpec.name, (p) => showRule(p, specKey)),
    });
  const registeredMinor = record.minors.find((m) => m.key === record.registeredMinor);
  if (registeredMinor && notContinuing(plan, "minor", registeredMinor.name)) {
    const key = packageKey("minor", registeredMinor.name);
    const title = t("rule.minor", { name: registeredMinor.name });
    hidden.push({ key, anchor: key, title, reason: "not-continuing", show: shownAgain(title, (p) => planMinor(p, registeredMinor)) });
  }
  for (const course of record.byProgram) {
    const title = `${course.code} ${course.name}`;
    hidden.push({
      key: `program-adds|${course.code}`,
      anchor: `program-adds-${course.code}`,
      title,
      reason: "program-adds",
      show: () => {
        const before = setFix(course.code, null);
        undoable.offer(() => setFix(course.code, before), t("planner.shownDone", { title }));
      },
    });
  }
  /** A required course the Student's program will add: covered from now on, with the curriculum corrections, until they take it back. */
  const settle = (course: { code: string; name: string; slot: string }) => {
    const before = setFix(course.slot, { kind: "program-adds", at: Date.now() });
    undoable.offer(() => setFix(course.slot, before), t("planner.programAddsDone", { course: `${course.code} ${course.name}` }));
  };
  const hideItems = (rule: Rule, key: string, title: string): SheetChoice[] =>
    hideReasons(rule).flatMap((reason): SheetChoice[] => {
      if (reason === "not-continuing" && (rule.id === "specialization" || rule.id === "minor")) {
        const codes = rule.id === "specialization" ? (record.specialization?.courses.map((c) => c.code) ?? []) : (minor?.courses ?? []);
        // A course the other package still asks for stays.
        const keep = rule.id === "specialization" ? (minor?.courses ?? []) : (spec?.courses.map((c) => c.code) ?? []);
        const label = t(rule.id === "minor" ? "planner.hideReason.not-continuingMinor" : "planner.hideReason.not-continuing");
        return notContinuingItems({ key, title, codes, keep, label });
      }
      return [
        { label: t(`planner.hideReason.${reason}`), onPress: () => undoable((p) => hideRule(p, key, reason, Date.now()), t("planner.hiddenDone", { title })) },
      ];
    });
  return (
    <Card testID="card.rules">
      <Text size="body" weight="semibold" accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3.5] }}>
        {t("planner.rules")}
      </Text>
      <View style={{ paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[3], gap: space[3] }}>
        {rules
          .filter((rule) => !isHidden(rule, plan))
          .map((rule) => {
            const { title, detail } = text(rule);
            const mark = LEVEL_MARK[rule.level];
            const key = ruleKey(rule);
            const settleable = rule.id === "required" ? rule.missing.filter((c): c is { code: string; name: string; slot: string } => c.slot !== null) : [];
            return (
              <View key={ruleAnchor(rule)} style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2.5] }} testID={`rule.${rule.id}`}>
                <View
                  accessibilityLabel={t(mark.label)}
                  style={{
                    marginTop: 2,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.color[mark.bg],
                  }}
                >
                  {rule.level === "ok" ? (
                    <Icons.Check size={12} color={theme.color[mark.fg]} weight="bold" />
                  ) : (
                    <Text size="micro" weight="bold" style={{ color: theme.color[mark.fg] }}>
                      !
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="small" weight="semibold">
                    {title}
                  </Text>
                  <Text size="small" tone="muted">
                    {detail}
                  </Text>
                  {key ? (
                    <View style={{ flexDirection: "row", marginLeft: -space[3] }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icons.EyeOff size={14} color={theme.color.muted} />}
                        label={t("planner.hideRule", { title })}
                        onPress={() => setMenu({ title: t("planner.hideRule", { title }), choices: hideItems(rule, key, title) })}
                        testID={`action.hideRule.${key}`}
                      >
                        {t("planner.hide")}
                      </Button>
                    </View>
                  ) : null}
                  {/* The one way an error is settled here: the program adds the course (Kerja Praktik, say), so it isn't the Student's to plan. */}
                  {settleable.length > 0 && (
                    <View style={{ flexDirection: "row", marginLeft: -space[3] }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icons.ClipboardCheck size={14} color={theme.color.muted} />}
                        label={
                          settleable.length === 1
                            ? t("planner.programAddsCode", { course: `${settleable[0]!.code} ${settleable[0]!.name}` })
                            : t("planner.programAddsWhich")
                        }
                        onPress={() =>
                          settleable.length === 1
                            ? settle(settleable[0]!)
                            : setMenu({
                                title: t("planner.programAddsWhich"),
                                choices: settleable.map((c) => ({ label: `${c.code} ${c.name}`, onPress: () => settle(c) })),
                              })
                        }
                        testID="action.programAdds"
                      >
                        {settleable.length === 1 ? t("planner.hideReason.program-adds") : t("planner.programAddsWhich")}
                      </Button>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
      </View>
      {hidden.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.color.line, paddingHorizontal: space[4], paddingVertical: space[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showHidden }}
            onPress={() => setShowHidden(!showHidden)}
            hitSlop={8}
            style={{ minHeight: 32, justifyContent: "center" }}
            testID="action.hiddenRules"
          >
            <Text size="caption" tone="muted">
              {`${t("planner.hidden", { count: hidden.length })}  ·  `}
              <Text size="caption" weight="medium" tone="accent">
                {t(showHidden ? "planner.hiddenClose" : "planner.hiddenShow")}
              </Text>
            </Text>
          </Pressable>
          {showHidden &&
            hidden.map(({ anchor, title, reason, show }) => (
              <View key={anchor} style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: space[1] }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="small">{title}</Text>
                  <Text size="caption" tone="muted">
                    {t(`planner.reasonShort.${reason}`)}
                  </Text>
                </View>
                <Button size="sm" variant="ghost" label={t("planner.showAgainRule", { title })} onPress={show}>
                  {t("planner.showAgain")}
                </Button>
              </View>
            ))}
        </View>
      )}
      <ActionSheet open={menu !== null} onClose={() => setMenu(null)} title={menu?.title} choices={menu?.choices ?? []} testID="sheet.rule" />
    </Card>
  );
}

/** The one shared target, what the rest needs for it, the IPK path, and the honors ladder. */
function Outlook({ record, state }: { record: StudentRecord; state: PlanState }) {
  const t = useT();
  const theme = useTheme();
  const { plan, projection } = state;
  const target = targetOf(record, plan);
  return (
    <Card testID="card.outlook">
      <Text size="body" weight="semibold" accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3.5] }}>
        {t("planner.outlook")}
      </Text>
      <View style={{ paddingHorizontal: space[4], paddingTop: space[2.5], gap: space[2] }}>
        <TargetControl record={record} state={state} />
        <NeedText need={projection.need(target)} target={target} sks={projection.variableSks} scope="rest" />
      </View>
      <View style={{ paddingHorizontal: space[3], paddingTop: space[3] }}>
        <IpkChart steps={projection.steps} target={target} height={156} />
      </View>
      <View style={{ marginTop: space[3], borderTopWidth: 1, borderTopColor: theme.color.line, paddingHorizontal: space[4], paddingVertical: space[3] }}>
        <Text size="caption" weight="medium" tone="muted" style={{ marginBottom: space[1.5] }}>
          {t("honors.title")}
        </Text>
        <HonorsList projection={projection} />
      </View>
      <Text size="small" tone="faint" style={{ borderTopWidth: 1, borderTopColor: theme.color.line, paddingHorizontal: space[4], paddingVertical: space[2.5] }}>
        {t("honors.rule")}
      </Text>
    </Card>
  );
}

// ------------------------------------------------------------ minors

function Minors({ record, state, undoable }: { record: StudentRecord; state: PlanState; undoable: Undoable }) {
  const t = useT();
  const theme = useTheme();
  const { plan } = state;
  const [open, setOpen] = useState<string | null>(null);
  const ranked = rankedMinors(record, plan);
  const active = activeMinor(record, plan)?.key ?? null;
  const pinned = (key: string) => key === active || key === record.registeredMinor;
  const shown = [...ranked.filter((m) => pinned(m.key)), ...ranked.filter((m) => !pinned(m.key) && m.have > 0).slice(0, 4)];
  const opened = record.minors.find((m) => m.key === open);
  return (
    <Card testID="card.minors">
      <Text size="body" weight="semibold" accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3.5], paddingBottom: space[1] }}>
        {t("planner.minors")}
      </Text>
      {shown.map((m) => {
        const on = active === m.key;
        const registered = record.registeredMinor === m.key;
        const stopped = registered && notContinuing(plan, "minor", m.name);
        return (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            onPress={() => setOpen(m.key)}
            android_ripple={{ color: theme.color.selected }}
            style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2.5], minHeight: 52 }}
            testID={`row.minor.${m.key}`}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="small" weight="semibold">
                {m.name}
              </Text>
              <Text size="caption" tone="muted">
                {m.program}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text size="caption" weight="semibold" tabular>
                {t("planner.minorSks", { have: m.have, need: m.need })}
              </Text>
              {stopped ? (
                <Text size="caption" tone="muted">
                  {t("planner.reasonShort.not-continuing")}
                </Text>
              ) : (
                (on || registered) && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icons.Check size={12} color={theme.color.accentFg} weight="bold" />
                    <Text size="caption" weight="medium" tone="accent">
                      {registered ? t("planner.minorRegistered") : t("planner.minorPlanned")}
                    </Text>
                  </View>
                )
              )}
            </View>
            <Icons.ChevronRight size={14} color={theme.color.faint} />
          </Pressable>
        );
      })}
      {shown.length === 0 && (
        <Text size="small" tone="faint" style={{ paddingHorizontal: space[4], paddingVertical: space[1] }}>
          {t("planner.minorNone")}
        </Text>
      )}
      <View style={{ height: space[2] }} />
      {opened && <MinorSheet record={record} state={state} minor={opened} undoable={undoable} onClose={() => setOpen(null)} />}
    </Card>
  );
}

/** The first planned regular semester a course still fits in at the normal load, else the last one. */
function termFor(plan: StudyPlan, sks: number): string | null {
  const regular = plan.terms.filter((term) => termKind(term.term) !== "short");
  return (regular.find((term) => term.courses.reduce((sum, c) => sum + c.sks, 0) + sks <= NORMAL_SKS) ?? regular.at(-1))?.term ?? null;
}

/** A minor up close: SIX's rules, each course with where it stands and a way to plan it, and planning the minor itself, said plainly. */
function MinorSheet({
  record,
  state,
  minor,
  undoable,
  onClose,
}: {
  record: StudentRecord;
  state: PlanState;
  minor: MinorOption;
  undoable: Undoable;
  onClose: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const termLabel = useTermLabel();
  const notContinuingItems = useNotContinuing(record, state.plan, undoable);
  const { plan } = state;
  const registered = record.registeredMinor === minor.key;
  const on = activeMinor(record, plan)?.key === minor.key;
  const stopped = registered && notContinuing(plan, "minor", minor.name);
  const progress = minorProgress(record, plan, minor);
  const have = progress.passed + progress.now + progress.planned;
  const grade = nearestLetter(startingIpk(record));
  const label = (term: string) => termLabel(term, semesterOf(term, record.entryTerm));
  const stateText = (code: string, st: CourseState) =>
    st === "passed" ? t("planner.state.passed", { grade: record.graded.get(code)?.grade ?? "" }) : st ? t(`planner.state.${st}`) : null;
  const termOf = (code: string) => (courseState(record, plan, code) ? null : termFor(plan, courseInfo(record, code).sks));
  // Toasts are drawn under a sheet: a decision about the minor closes it first, so its Undo is in view.
  // Adding its courses keeps the sheet open (each row turns into its new state, and the course's ⋯ removes it).
  const decide = (change: () => void) => {
    onClose();
    change();
  };
  const stop =
    on && registered
      ? // Registered on SIX: not continuing it is for good (a reset doesn't plan it again), its courses only it asks for leaving the plan if the Student wants.
        notContinuingItems({
          key: packageKey("minor", minor.name),
          title: t("rule.minor", { name: minor.name }),
          codes: minor.courses,
          keep: activeSpecialization(record, plan)?.courses.map((c) => c.code) ?? [],
          label: t("planner.hideReason.not-continuingMinor"),
        })
      : [];
  return (
    <Sheet open onClose={onClose} title={t("rule.minor", { name: minor.name })} testID="sheet.minor">
      <Meta>
        {minor.program}
        {registered ? t(stopped ? "curriculum.notContinuing" : "planner.minorRegistered") : ""}
      </Meta>
      <View style={{ marginTop: space[3], gap: 2 }}>
        <Text size="title" weight="semibold" tabular>
          {t("planner.minorSks", { have, need: progress.need })}
        </Text>
        <Meta>{t("planner.minorSplit", { passed: progress.passed, now: progress.now, planned: progress.planned })}</Meta>
      </View>
      {minor.note ? (
        <View style={{ marginTop: space[4] }}>
          <Text size="caption" weight="medium" tone="muted">
            {t("planner.minorRules")}
          </Text>
          <Text size="small" style={{ marginTop: space[1] }}>
            {minor.note}
          </Text>
        </View>
      ) : null}
      <View style={{ marginTop: space[4] }}>
        <Text size="caption" weight="medium" tone="muted">
          {t("planner.minorCourses")}
        </Text>
        {minor.courses.map((code, i) => {
          const info = courseInfo(record, code);
          const st = courseState(record, plan, code);
          const term = termOf(code);
          return (
            <View
              key={code}
              style={[
                { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], minHeight: 52 },
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.color.line },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="body">{info.name}</Text>
                <Meta size="caption">
                  <Text size="caption" weight="semibold" tabular>
                    {code}
                  </Text>
                  {`${info.sks} SKS`}
                </Meta>
              </View>
              {st ? (
                <Text size="caption" weight="semibold" tone={st === "this-term" ? "info" : "faint"}>
                  {stateText(code, st)}
                </Text>
              ) : term ? (
                <Button
                  size="sm"
                  label={t("planner.addCodeTo", { code, term: label(term) })}
                  onPress={() =>
                    undoable(
                      (p) => addCourse(p, term, { code, name: info.name, sks: info.sks, grade, retake: false }),
                      t("planner.addedTo", { code, term: label(term) }),
                    )
                  }
                  testID={`action.minorAdd.${code}`}
                >
                  {t("planner.add")}
                </Button>
              ) : (
                <Text size="caption" tone="faint">
                  {t("planner.state.left")}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <Text size="caption" tone="muted" style={{ marginTop: space[3] }}>
        {t("planner.minorWhat")}
      </Text>
      <View style={{ marginTop: space[4], marginBottom: space[2], gap: space[2] }}>
        {on && registered ? (
          // One button, or the choice of keeping or removing its planned courses when there are some (both in view: no menu on a sheet).
          stop.map((choice) => (
            <View key={choice.label} style={{ gap: space[1] }}>
              <Button onPress={() => decide(choice.onPress)} testID="action.minorStop">
                {choice.label}
              </Button>
              {stop.length > 1 && choice.hint ? (
                <Text size="caption" tone="muted">
                  {choice.hint}
                </Text>
              ) : null}
            </View>
          ))
        ) : on ? (
          <Button
            onPress={() => decide(() => undoable((p) => ({ ...p, minor: null }), t("planner.minorStopped", { name: minor.name })))}
            testID="action.minorStop"
          >
            {t("planner.minorStop")}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<Icons.Target size={16} color={theme.color.onAccent} />}
            onPress={() => decide(() => undoable((p) => planMinor(p, minor), t("planner.minorPlannedDone", { name: minor.name })))}
            testID="action.minorPlan"
          >
            {t("planner.minorPlan")}
          </Button>
        )}
      </View>
    </Sheet>
  );
}

// ------------------------------------------------------------ adding a course

type AddTab = "needed" | "program" | "minors" | "all";

/** `now`: adding to this semester, as a what-if; a course planned for later can move into it. */
function AddCourse({
  record,
  state,
  now,
  title,
  onAdd,
  onClose,
}: {
  record: StudentRecord;
  state: PlanState;
  now: boolean;
  title: string;
  onAdd: (course: PlannedCourse) => void;
  onClose: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { plan } = state;
  const [tab, setTab] = useState<AddTab>("needed");
  const [query, setQuery] = useState("");
  const minor = activeMinor(record, plan);
  const spec = activeSpecialization(record, plan);
  const grade = nearestLetter(startingIpk(record));
  const add = (code: string, retake: boolean) => {
    const info = courseInfo(record, code);
    onAdd({ code, name: info.name, sks: info.sks, grade, retake });
    onClose();
  };
  const planned = plannedCodes(plan);
  const canAdd = (st: CourseState) => st === null || (now && st === "planned");
  const open = (code: string) => !planned.has(code) && courseState(record, plan, code) === null;
  const needed: { code: string; why: string }[] = [
    ...record.requiredLeft.map((c) => ({ code: c.code, why: t("planner.why.required") })),
    ...(spec?.courses ?? [])
      .filter((c) => open(c.code) || planned.has(c.code))
      .map((c) => ({ code: c.code, why: t("planner.why.specialization", { name: spec!.name }) })),
    ...(minor?.courses ?? []).filter((code) => open(code) || planned.has(code)).map((code) => ({ code, why: t("planner.why.minor", { name: minor!.name }) })),
  ].filter((x, i, all) => all.findIndex((y) => y.code === x.code) === i);
  const retakes = retakeCandidates(record);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseInfo) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  const found = searchCourses(record, query);

  const row = (code: string, why?: string, retake?: { from: string; now: number | null; after: number | null }) => {
    const info = courseInfo(record, code);
    const st: CourseState = retake
      ? record.thisTerm.some((c) => c.code === code)
        ? "this-term"
        : planned.has(code)
          ? "planned"
          : null
      : courseState(record, plan, code);
    // The Student's own program goes without saying.
    const owner = info.owner && info.owner !== record.program?.code ? (record.programNames.get(info.owner) ?? null) : null;
    return (
      <View
        key={code}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2.5], borderTopWidth: 1, borderTopColor: theme.color.line }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="body" weight="medium">
            {info.name}
          </Text>
          <Meta size="caption">
            <Text size="caption" weight="semibold" tabular>
              {code}
            </Text>
            {`${info.sks} SKS`}
            {owner}
            {why}
            {retake && retake.now !== null && retake.after !== null
              ? t("planner.retakeGain", { now: f.number(retake.now, 2), after: f.number(retake.after, 2) })
              : null}
          </Meta>
        </View>
        {!canAdd(st) && st ? (
          <Text size="caption" weight="semibold" tone="faint">
            {st === "passed" ? t("planner.state.passed", { grade: record.graded.get(code)?.grade ?? "" }) : t(`planner.state.${st}`)}
          </Text>
        ) : (
          <Button
            size="sm"
            label={t(retake ? "planner.retakeCode" : "planner.addCode", { code })}
            onPress={() => add(code, Boolean(retake))}
            testID={`action.add.${code}`}
          >
            {retake ? t("planner.retake") : t("planner.add")}
          </Button>
        )}
      </View>
    );
  };
  const center = (text: string) => (
    <Text size="body" tone="muted" style={{ paddingVertical: space[6], textAlign: "center" }}>
      {text}
    </Text>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      testID="sheet.addCourse"
      title={
        // The search and the tabs stay in view while the list scrolls.
        <View style={{ gap: space[2] }}>
          <Text size="title" weight="semibold" accessibilityRole="header">
            {title}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              height: 44,
              borderRadius: radius.lg,
              paddingHorizontal: space[3],
              backgroundColor: theme.color.fill,
            }}
          >
            <Icons.Search size={18} color={theme.color.faint} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (text.trim().length >= 2 && tab === "needed") setTab("all");
              }}
              accessibilityLabel={t("planner.search")}
              placeholder={t("planner.search")}
              placeholderTextColor={theme.color.faint}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, color: theme.color.fg, ...type.small, paddingVertical: 0 }}
              testID="input.courseSearch"
            />
          </View>
          {now && (
            <Text size="caption" tone="info">
              {t("planner.addToNowNote")}
            </Text>
          )}
          <ChipRow>
            {(["needed", "program", "minors", "all"] as const).map((id) => (
              <Chip key={id} selected={tab === id} onPress={() => setTab(id)} testID={`tab.addCourse.${id}`}>
                {t(`planner.tab.${id}`)}
              </Chip>
            ))}
          </ChipRow>
        </View>
      }
    >
      {tab === "needed" && (
        <View>
          {needed.map((x) => row(x.code, x.why))}
          {retakes.length > 0 && (
            <>
              <Text size="small" weight="semibold" tone="muted" style={{ paddingTop: space[4], paddingBottom: space[1] }}>
                {t("planner.retakes")}
              </Text>
              <Text size="caption" tone="faint" style={{ paddingBottom: space[1] }}>
                {t("planner.retakeSumma")}
              </Text>
              {retakes.map((r) => row(r.code, t("planner.why.grade", { grade: r.grade }), { from: r.grade, now: r.ipkNow, after: r.ipkWithA }))}
            </>
          )}
        </View>
      )}
      {tab === "program" && (
        <View>
          {programElectives(record)
            .filter(matches)
            .map((c) => row(c.code))}
        </View>
      )}
      {tab === "minors" && (
        <View>
          {rankedMinors(record, plan)
            .filter((m) => !q || m.name.toLowerCase().includes(q) || m.program.toLowerCase().includes(q))
            .slice(0, 40)
            .map((m) => (
              <View key={m.key} style={{ paddingVertical: space[2.5], borderTopWidth: 1, borderTopColor: theme.color.line }}>
                <Text size="body" weight="semibold">
                  {m.name}
                </Text>
                <Meta size="caption">
                  {m.program}
                  {`${m.need} SKS`}
                </Meta>
                {m.note ? (
                  <Text size="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
                    {m.note}
                  </Text>
                ) : null}
                <View style={{ marginTop: space[1.5], flexDirection: "row", flexWrap: "wrap", gap: space[1.5] }}>
                  {m.courses.map((code) => {
                    const done = !canAdd(courseState(record, plan, code));
                    return (
                      <Pressable
                        key={code}
                        disabled={done}
                        accessibilityRole="button"
                        accessibilityLabel={done ? `${code} ${courseInfo(record, code).name}` : t("planner.addCode", { code })}
                        accessibilityState={{ disabled: done }}
                        onPress={() => add(code, false)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          minHeight: 32,
                          paddingHorizontal: space[2],
                          borderRadius: radius.md,
                          borderWidth: done ? 0 : 1,
                          borderColor: theme.color.edge,
                          backgroundColor: done ? theme.color.successBg : theme.color.surface,
                        }}
                        testID={`action.add.${code}`}
                      >
                        <Text size="caption" weight="semibold" tone={done ? "success" : "fg"} tabular>
                          {code}
                        </Text>
                        {done ? <Icons.Check size={12} color={theme.color.successFg} weight="bold" /> : <Icons.Plus size={12} color={theme.color.muted} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
        </View>
      )}
      {tab === "all" &&
        (q.length < 2 ? (
          center(t("planner.typeMore", { count: record.courses.size }))
        ) : (
          <View>
            {found.map((c) => row(c.code))}
            {found.length === 0 && center(t("planner.noMatch"))}
          </View>
        ))}
      <Text size="caption" tone="faint" style={{ paddingVertical: space[3], borderTopWidth: 1, borderTopColor: theme.color.line }}>
        {t("planner.catalogSource")}
      </Text>
    </Sheet>
  );
}
