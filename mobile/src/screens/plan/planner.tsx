// Rencana studi › Rencana on the phone (src/app/screens/plan/planner.tsx, S12; round 2, v4): semesters from now to
// graduation, courses from SIX's public catalog and retakes, every rule checked live, and expected grades projecting
// each semester's IP, the IPK at graduation, honors and what the one shared target needs. Same functions as the
// desktop (src/core/planner), so the two never disagree.
//
// v4, top to bottom: one card led by the semester the plan graduates in (big, counting up once) and the IPK it
// graduates with, the SKS against the need as a bar (planner-summary.tsx); the semesters behind the Student folded in
// one row; this semester and each planned one as a heading with its one line and its courses as rows in one card,
// each course in its colour's tile (planner-term.tsx); adding a semester; then, a frame each, the rules
// (planner-rules.tsx), the outlook with the chart on its own card (planner-outlook.tsx) and the minors
// (planner-minors.tsx). Explanations are a tap deeper (a rule's sheet, the plan's "about" sheet).
//
// The desktop clicks and hovers; the phone taps and uses sheets: a course's grade is a sheet of grades, its other
// actions (move it to another semester, remove it, leave it out this semester) a sheet from a tap on its row (or a long
// press), adding a course a sheet with search (planner-add.tsx), a minor up close a sheet. Every change commits with a
// haptic, and one that loses something can be taken back from its toast. The plan stays on this phone; the app never
// sends a KRS.

import { type ComponentRef, useCallback, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import { type PlanState, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import type { StudyPlan } from "../../../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  addCourse,
  addShortTerm,
  addTerm,
  addToNow,
  canRemoveTerm,
  checkPlan,
  courseRole,
  defaultPlan,
  expectedGrade,
  hasWhatIfs,
  isHidden,
  leaveOut,
  livePlan,
  MAX_SKS,
  putBack,
  type Rule,
  removeCourse,
  removeTerm,
  removeTried,
  SHORT_SKS,
  type StudentRecord,
  semesterOf,
  setGrade,
  shortTermToAdd,
  termKind,
  untried,
  withWhatIf,
} from "../../../../src/core/planner";
import { useGradeWords } from "../../parts/hide-grades";
import { SixPageNote, UnreadNote, useChangedPage } from "../../parts/six-page-note";
import { dismissToast, toast } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { Rise } from "../../ui/expressive";
import { Group, GroupRow, IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { ActionSheet, type SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { Later } from "./deferred";
import { useScrollToView } from "./page-scroll";
import { AddCourse } from "./planner-add";
import { commitHaptic, type Undoable } from "./planner-kit";
import { Minors } from "./planner-minors";
import { AboutPlan, Outlook } from "./planner-outlook";
import { Rules, useFlagText, useRuleText } from "./planner-rules";
import { PastTerms, PlanHero, PlannerSkeleton } from "./planner-summary";
import { CourseRow, DroppedRow, EmptyRow, TermSection } from "./planner-term";
import { useTermLabel } from "./projection";
import { SixNeeded } from "./six-needed";

/** The screen's id for its first-mount stagger (`Rise`). */
const SCREEN = "plan-planner";

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const record = useStudentRecord();
  const state = usePlan(record);
  const six = useStatus("six");
  const changed = useChangedPage(["six.curriculum", "six.transcript"]);
  if (!record || !state) {
    // SIX is being read: the plan's shape, never a spinner on a blank page.
    if (!changed && (six.state === "connecting" || six.state === "live")) return <PlannerSkeleton />;
    return (
      <SixNeeded
        datasets={["six.curriculum", "six.transcript"]}
        icon={<Icons.BookOpen size={20} color={theme.v4.fg2} />}
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
  }
  return <Planner real={record} record={state.record} state={state} />;
}

/**
 * A plan change that can be taken back: a toast with "Urungkan". `offer` does the same for a
 * change kept apart from the plan (a required course the program will add), so the newest change
 * is always the one taken back, whatever kind it is. Each commits with a haptic.
 */
function useUndoable(state: PlanState): Undoable {
  const t = useT();
  const last = useRef<(() => void) | null>(null);
  const shown = useRef<number | null>(null);
  const offer = (undo: () => void, message: string) => {
    commitHaptic();
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
  const gradeWords = useGradeWords();
  const f = useFormat();
  const theme = useTheme();
  const termLabel = useTermLabel();
  const ruleText = useRuleText(record);
  const flagText = useFlagText();
  const { plan, projection, update } = state;
  const [adding, setAdding] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting | null>(null);
  const undoable = useUndoable(state);
  const rulesRef = useRef<ComponentRef<typeof View>>(null);
  const scrollTo = useScrollToView();
  const onCheck = useCallback(() => scrollTo(rulesRef.current), [scrollTo]);
  // What the screen works out from the plan, once per change to it (not on every draw).
  const rules = useMemo(() => checkPlan(record, plan, projection), [record, plan, projection]);
  const minor = useMemo(() => activeMinor(record, plan), [record, plan]);
  const spec = useMemo(() => activeSpecialization(record, plan), [record, plan]);
  const stepOf = useMemo(() => new Map(projection.steps.map((s) => [s.term, s])), [projection]);
  const past = useMemo(() => projection.steps.filter((s) => !s.projected && s.term !== record.term), [projection, record.term]);
  const short = useMemo(() => shortTermToAdd(plan, record), [plan, record]);
  const loss = useMemo(() => resetLoss(real, state.base), [real, state.base]);
  const lossParts = [
    loss.grades && t("planner.reset.grades", { n: loss.grades, count: loss.grades }),
    loss.added && t("planner.reset.added", { n: loss.added, count: loss.added }),
    loss.terms && t("planner.reset.terms", { n: loss.terms, count: loss.terms }),
    loss.removed && t("planner.reset.removed", { n: loss.removed, count: loss.removed }),
    loss.whatIfs && t("planner.reset.whatIfs", { n: loss.whatIfs, count: loss.whatIfs }),
    loss.other && t("planner.reset.other"),
  ].filter((part): part is string => Boolean(part));
  // A course's own warning (odd/even, earlier than the curriculum), shown on its row unless the Student hid it.
  const flags = useMemo(() => {
    const out = new Map<string, Extract<Rule, { id: "parity" | "early" }>>();
    for (const rule of rules) if ((rule.id === "parity" || rule.id === "early") && !isHidden(rule, plan)) out.set(`${rule.term}|${rule.code}`, rule);
    return out;
  }, [rules, plan]);
  const whatIf = useMemo(() => hasWhatIfs(plan, record), [plan, record]);
  const added = new Set(record.thisTermAdded);
  const leftOut = new Set(record.thisTermDropped.map((c) => c.code));
  // This semester in SIX's KRS order, a course left out crossed out where it was, then the ones tried.
  const nowCourses = [...real.thisTerm, ...record.thisTerm.filter((c) => added.has(c.code))];
  const nowLabel = record.semesterNow ? t("planner.now", { n: record.semesterNow }) : t("planner.nowPlain");
  const sksOf = (term: string) => plan.terms.find((p) => p.term === term)?.courses.reduce((sum, c) => sum + c.sks, 0) ?? 0;
  const limitOf = (term: string) => (termKind(term) === "short" ? SHORT_SKS : MAX_SKS);
  /** A change made here, committed with a haptic (one that loses something goes through `undoable`, which does the same). */
  const commit = (change: (p: StudyPlan) => StudyPlan) => {
    commitHaptic();
    update(change);
  };
  /** Only "Wajib" earns a tag: the other kinds (electives, specialization, minor) are most rows, and the rules already count them. */
  const roleTag = (code: string): string | null => {
    if (courseRole(record, code, minor, spec) !== "required") return null;
    const semester = record.required.get(code)?.semester ?? record.requiredLeft.find((c) => c.code === code)?.semester;
    return t("planner.role.required", { n: semester ?? "-" });
  };
  /** A flagged course's sheet starts with its warning: the whole reason, and the way to the rules. */
  const flagChoice = (flag: Extract<Rule, { id: "parity" | "early" }> | undefined): SheetChoice[] =>
    flag
      ? [
          {
            label: flagText(flag),
            hint: ruleText(flag).detail,
            icon: <Icons.AlertTriangle size={20} color={theme.color.warningFg} />,
            onPress: onCheck,
            testID: "action.courseFlag",
          },
        ]
      : [];
  // The rules, the outlook and the minors sit below the semesters: they come after the first screenful, a frame each
  // (Later), so their arrival draws only themselves.
  const confirmReset = () =>
    Alert.alert(t("planner.resetTitle"), lossParts.length ? t("planner.resetBody", { list: f.list(lossParts) }) : t("planner.resetNothing"), [
      { text: t("action.cancel"), style: "cancel" },
      { text: t("planner.resetConfirm"), style: "destructive", onPress: () => undoable((p) => defaultPlan(real, p.hidden), t("planner.resetDone")) },
    ]);

  return (
    <View style={{ gap: space[3] }}>
      <SixPageNote datasets={["six.curriculum"]} />
      <UnreadNote record={record} />
      <Rise screen={SCREEN} index={0}>
        <PlanHero record={record} plan={plan} projection={projection} rules={rules} onCheck={onCheck} />
      </Rise>
      <Rise screen={SCREEN} index={1}>
        <PastTerms record={record} steps={past} />
      </Rise>
      {/* Shown while this term's KRS is still empty too: that's when trying courses matters most. */}
      {record.term ? (
        <Rise screen={SCREEN} index={2}>
          <TermSection
            term={record.term}
            title={nowLabel}
            whatIf={whatIf}
            sks={record.thisTerm.reduce((sum, c) => sum + c.sks, 0)}
            limit={whatIf ? limitOf(record.term) : null}
            step={stepOf.get(record.term)}
            onAdd={() => setAdding(record.term)}
            addLabel={t("planner.addWhatIf")}
          >
            {nowCourses.map((course, i) => {
              const mine = added.has(course.code);
              const term = record.term!;
              if (leftOut.has(course.code))
                return (
                  <DroppedRow
                    key={course.code}
                    first={i === 0}
                    code={course.code}
                    name={course.name}
                    sks={course.sks}
                    onPutBack={() => undoable((p) => putBack(p, term, course.code), t("planner.putBackDone", { code: course.code }))}
                  />
                );
              const flag = mine ? flags.get(`${term}|${course.code}`) : undefined;
              // A course SIX already graded stays: there's nothing to try without it.
              const choices: SheetChoice[] =
                course.grade === null
                  ? [
                      ...flagChoice(flag),
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
                <CourseRow
                  key={course.code}
                  first={i === 0}
                  code={course.code}
                  name={course.name}
                  sks={course.sks}
                  tag={mine ? t("planner.whatIfTag") : roleTag(course.code)}
                  flag={flag && flagText(flag)}
                  grade={course.grade ?? expectedGrade(record, plan, course.code)}
                  guess={plan.expected[course.code] === undefined}
                  posted={course.grade !== null}
                  onGrade={(grade) => commit((p) => ({ ...p, expected: { ...p.expected, [course.code]: grade } }))}
                  onMore={choices.length ? () => setActing({ code: course.code, name: course.name, choices }) : undefined}
                />
              );
            })}
            {nowCourses.length === 0 && <EmptyRow text={t("planner.nowEmpty")} />}
          </TermSection>
        </Rise>
      ) : null}
      {plan.terms.map((term, index) => {
        const semester = semesterOf(term.term, record.entryTerm);
        const label = termLabel(term.term, semester);
        return (
          <Rise key={term.term} screen={SCREEN} index={Math.min(3 + index, 5)}>
            <TermSection
              term={term.term}
              title={label}
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
              {term.courses.map((course, i) => {
                const flag = flags.get(`${term.term}|${course.code}`);
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
                  <CourseRow
                    key={course.code}
                    first={i === 0}
                    code={course.code}
                    name={course.name}
                    sks={course.sks}
                    tag={course.retake ? t("planner.role.retake", { grade: gradeWords(record.graded.get(course.code)?.grade ?? "-") }) : roleTag(course.code)}
                    flag={flag && flagText(flag)}
                    grade={course.grade}
                    onGrade={(grade) => commit((p) => setGrade(p, term.term, course.code, grade))}
                    onMore={() =>
                      setActing({
                        code: course.code,
                        name: course.name,
                        choices: [
                          ...flagChoice(flag),
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
              {term.courses.length === 0 && <EmptyRow text={t("planner.nothing")} />}
            </TermSection>
          </Rise>
        );
      })}
      {/* The plan's own actions, each a row; resetting only once there's something to reset. */}
      <Group style={{ marginTop: space[3] }}>
        <GroupRow
          first
          leading={<IconTile icon={(color) => <Icons.Plus size={22} color={color} weight="bold" />} />}
          title={t("planner.addTerm")}
          onPress={() => commit((p) => addTerm(p, record))}
          testID="action.addTerm"
        />
        {short ? (
          <GroupRow
            leading={<IconTile icon={(color) => <Icons.Plus size={22} color={color} weight="bold" />} />}
            title={t("planner.addShort")}
            onPress={() => commit((p) => addShortTerm(p, record))}
            testID="action.addShortTerm"
          />
        ) : null}
        {lossParts.length ? (
          <GroupRow
            leading={<IconTile tone="plain" icon={(color) => <Icons.RefreshCw size={22} color={color} />} />}
            title={t("planner.reset")}
            onPress={confirmReset}
            testID="action.resetPlan"
          />
        ) : null}
      </Group>
      <View ref={rulesRef} collapsable={false} style={{ marginTop: space[3], gap: space[3] }}>
        <Later frame={1}>
          <Rules record={record} rules={rules} plan={plan} undoable={undoable} />
        </Later>
        <Later frame={2}>
          <Outlook record={record} state={state} />
        </Later>
        <Later frame={3}>
          <Minors record={record} state={state} undoable={undoable} />
          <AboutPlan />
        </Later>
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
              : commit((p) => addCourse(p, adding, course))
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

/** "Hanya di rencana": a course tried in the plan, dashed because it isn't real (Kurikulum's rows use it too). */
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
