// Rencana studi › Kurikulum on the phone (src/app/screens/plan/curriculum.tsx, S13; round 2, v4): the program's
// required courses by recommended semester with where the Student stands on each (courses passed under an older code
// matched the way SIX places them), the specializations and minors with progress, each course's syllabus on SIX's
// public pages, and the Student's own corrections where SIX's record doesn't match their curriculum, each one marked
// and reversible.
// 1. One card: the SKS passed of the curriculum's total (a big number that counts up once) over the bar of passed,
//    this semester and planned (judge round 3: the figure and the bar only).
// 2. One group of rows: what's left of the required courses and the electives, in the desktop's words ("Sisa: 2 wajib
//    (6 SKS) · pilihan terpenuhi"), the electives (the same SKS count as the planner), the curriculum's name with what's
//    worth knowing about it (an older start, courses SIX leaves off) on its line and why in its sheet, then "Sisa
//    saja", which hides what's done (kept while the app is open).
// 3. Each semester: its heading with its SKS, its courses as rows (name, code and SKS, one status at the end: the
//    grade once passed, a pill while it needs the Student).
// 4. Specializations and minors, below the fold.
// A course's syllabus and corrections are a tap (or a long press) away, in a sheet.

import { type ReactNode, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { useCurriculumFix, useDFails, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { useViewChoice } from "../../../../src/app/view-choice";
import { curriculumMap, type MapCourse, type PackageProgress, type SlotStatus, type StandIn, standIns } from "../../../../src/core/curriculum-map";
import type { CurriculumFix } from "../../../../src/core/models";
import { hasWhatIfs, type SksModel, type StudentRecord, sksModel } from "../../../../src/core/planner";
import { useGradesHidden } from "../../parts/hide-grades";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { toast } from "../../swaps/overlays";
import { Button, Switch } from "../../ui/controls";
import { Rise } from "../../ui/expressive";
import { Figure, FigureLabel, Group, GroupRow, Heading, Panel, Pill } from "../../ui/group";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { Meter } from "../../ui/meter";
import { iosPressed } from "../../ui/press";
import { ActionSheet, Sheet, type SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { Later } from "./deferred";
import { SksBar } from "./planner-summary";
import { SixNeeded } from "./six-needed";

/** SIX's public course page (no sign-in): the syllabus. */
export const syllabusUrl = (courseId: string) => `https://six.itb.ac.id/pub/matakuliah/${courseId}`;

/** Still to do: everything not passed, credited, or off the Student's list (SIX doesn't ask it of them, or they said so). */
const isLeft = (status: SlotStatus) => !["passed", "exempt", "unlisted", "not-mine", "done", "program-adds"].includes(status);

/** The semesters drawn with the screen's first frame; the rest arrive a frame each (./deferred.ts). */
const FIRST_SEMESTERS = 2;

const RISE = "plan-curriculum";

export function Tab({ onCalendar }: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  const state = usePlan(useStudentRecord());
  // With this term's what-ifs, like the planner: the two tabs never disagree.
  const record = state?.record;
  const setFix = useCurriculumFix();
  const [onlyLeft, setOnlyLeft] = useViewChoice("curriculum.onlyLeft", false);
  const [picking, setPicking] = useState<MapCourse | null>(null);
  const [acting, setActing] = useState<{ course: MapCourse; required: boolean } | null>(null);
  // The map and the SKS count once per plan, not on every render (the minute's tick redraws dates elsewhere).
  const map = useMemo(() => (record?.curriculum && state ? curriculumMap(record, state.plan) : null), [record, state]);
  const sks = useMemo(() => (record && state ? sksModel(record, state.plan) : null), [record, state]);
  if (!record || !state || !record.curriculum || !map || !sks)
    return (
      <SixNeeded
        datasets={["six.curriculum", "six.progress"]}
        icon={<Icons.Layers size={20} color={theme.color.muted} />}
        title={t("curriculum.needSix")}
        body={t("curriculum.needSixBody")}
        action={
          onCalendar && (
            <Button variant="ghost" onPress={onCalendar} testID="action.toCalendar">
              {t("plan.toCalendar")}
            </Button>
          )
        }
      />
    );
  const semesters = map.semesters
    .map((s) => ({
      ...s,
      required: onlyLeft ? s.required.filter((c) => isLeft(c.status)) : s.required,
      others: onlyLeft ? s.others.filter((c) => isLeft(c.status)) : s.others,
    }))
    .filter((s) => s.required.length + s.others.length > 0);
  const hidden = map.semesters.length - semesters.length;
  const unlisted = map.semesters.flatMap((s) => s.required).filter((c) => c.status === "unlisted").length;
  const correct = (course: MapCourse, fix: CurriculumFix | null, message: string) => {
    const before = setFix(course.code, fix);
    haptic.confirm();
    toast(message, "neutral", { label: t("planner.undo"), onClick: () => setFix(course.code, before) });
  };
  const toggleLeft = (on: boolean) => {
    haptic.toggle(on);
    setOnlyLeft(on);
  };
  /** A row's sheet: its syllabus on SIX, then (a required course) the corrections. */
  const choicesOf = (course: MapCourse, required: boolean): SheetChoice[] => {
    const at = Date.now();
    const items: SheetChoice[] = [];
    if (course.courseId)
      items.push({
        label: t("curriculum.syllabusOf", { code: course.code }),
        icon: <Icons.FileText size={20} color={theme.color.fg} />,
        onPress: () => open(syllabusUrl(course.courseId!)),
        testID: "action.syllabus",
      });
    if (!required) return items;
    // SIX's record leaves it out: the Student can say it's theirs to take after all, as the notes at the end say.
    if (course.status === "unlisted")
      items.push({
        label: t("curriculum.fix.mine"),
        hint: t("curriculum.fix.mineHint"),
        icon: <Icons.Plus size={20} color={theme.color.fg} />,
        onPress: () => correct(course, { kind: "mine", at }, t("curriculum.fixDone.mine", { code: course.code })),
        testID: "action.fix.mine",
      });
    if (course.fix?.kind !== "not-mine")
      items.push({
        label: t("curriculum.fix.not-mine"),
        hint: t("curriculum.fix.not-mineHint"),
        icon: <Icons.Minus size={20} color={theme.color.fg} />,
        onPress: () => correct(course, { kind: "not-mine", at }, t("curriculum.fixDone.not-mine", { code: course.code })),
        testID: "action.fix.notMine",
      });
    items.push({
      label: t("curriculum.fix.counted-as"),
      hint: t("curriculum.fix.counted-asHint"),
      icon: <Icons.Route size={20} color={theme.color.fg} />,
      onPress: () => setPicking(course),
      testID: "action.fix.countedAs",
    });
    if (course.fix?.kind !== "done")
      items.push({
        label: t("curriculum.fix.done"),
        hint: t("curriculum.fix.doneHint"),
        icon: <Icons.Check size={20} color={theme.color.fg} />,
        onPress: () => correct(course, { kind: "done", at }, t("curriculum.fixDone.done", { code: course.code })),
        testID: "action.fix.done",
      });
    if (course.fix)
      items.push({
        label: t("curriculum.fix.restore"),
        hint: t("curriculum.fix.restoreHint"),
        icon: <Icons.History size={20} color={theme.color.fg} />,
        onPress: () => correct(course, null, t("curriculum.fixDone.restore", { code: course.code })),
        testID: "action.fix.restore",
      });
    return items;
  };
  const rowOf = (course: MapCourse, required: boolean, first: boolean) => {
    const actionable = required || course.courseId !== null;
    return (
      <CourseRow
        key={course.code}
        course={course}
        first={first}
        // The rows most likely to need a correction say they have a menu.
        menuHint={required && (course.status === "unlisted" || course.fix !== null)}
        onPress={actionable ? () => setActing({ course, required }) : undefined}
      />
    );
  };
  const semesterCard = (semester: (typeof semesters)[number]) => (
    <View testID={`card.curriculum.${semester.semester}`}>
      <Heading
        trailing={
          !onlyLeft ? (
            <Text size="bodyMedium" tabular style={{ color: theme.v4.muted }}>
              {t("curriculum.sks", { sks: semester.required.reduce((sum, c) => sum + c.sks, 0) })}
            </Text>
          ) : undefined
        }
      >
        {t("planner.semester", { n: semester.semester })}
      </Heading>
      <Group>
        {semester.required.map((course, i) => rowOf(course, true, i === 0))}
        {semester.others.length > 0 && (
          <>
            <View
              style={{
                paddingHorizontal: space[4],
                paddingTop: space[3],
                paddingBottom: space[1],
                borderTopWidth: semester.required.length ? 1 : 0,
                borderTopColor: theme.v4.line,
              }}
            >
              <Text size="labelLarge" style={{ color: theme.v4.muted }}>
                {t("curriculum.others")}
              </Text>
            </View>
            {semester.others.map((course, i) => rowOf(course, false, i === 0))}
          </>
        )}
      </Group>
    </View>
  );
  return (
    <View>
      <SixPageNote datasets={["six.curriculum", "six.progress"]} />
      <UnreadNote record={record} />
      <Rise screen={RISE} index={0}>
        <Totals whatIf={hasWhatIfs(state.plan, record)} sks={sks} />
      </Rise>
      <Rise screen={RISE} index={1} style={{ marginTop: space[3] }}>
        <Standing sks={sks} onlyLeft={onlyLeft} onToggle={toggleLeft}>
          <Notes name={record.curriculum.name} startedOn={map.startedOn} year={record.curriculum.year} unlisted={unlisted} />
        </Standing>
      </Rise>
      {semesters.slice(0, FIRST_SEMESTERS).map((semester, i) => (
        <Rise key={semester.semester} screen={RISE} index={2 + i}>
          {semesterCard(semester)}
        </Rise>
      ))}
      {semesters.slice(FIRST_SEMESTERS).map((semester, i) => (
        <Later key={semester.semester} frame={1 + i}>
          {semesterCard(semester)}
        </Later>
      ))}
      {onlyLeft && semesters.length === 0 && (
        <Panel style={{ marginTop: space[6], paddingHorizontal: space[5], paddingVertical: space[6], alignItems: "center", gap: space[3] }}>
          <Icons.CheckCircle size={28} color={theme.v4.okFg} />
          <Text size="bodyLarge" style={{ color: theme.v4.fg, textAlign: "center" }}>
            {t("curriculum.allDone")}
          </Text>
        </Panel>
      )}
      {onlyLeft && hidden > 0 && semesters.length > 0 && (
        <Text size="bodyMedium" style={{ color: theme.v4.muted, marginTop: space[3], marginLeft: space[1] }}>
          {t("curriculum.hiddenDone", { count: hidden })}
        </Text>
      )}
      <Later frame={Math.max(1, semesters.length - FIRST_SEMESTERS + 1)}>
        <DRule />
        {map.specializations.length > 0 && <Packages title={t("curriculum.specializations")} packages={map.specializations} id="specializations" />}
        {map.minors.length > 0 && <Packages title={t("curriculum.minors")} packages={map.minors} id="minors" />}
      </Later>
      <ActionSheet
        open={acting !== null}
        onClose={() => setActing(null)}
        title={acting ? `${acting.course.code} ${acting.course.name}` : undefined}
        choices={acting ? choicesOf(acting.course, acting.required) : []}
        testID="sheet.curriculumCourse"
      />
      {picking && (
        <PickStandIn
          record={record}
          course={picking}
          onPick={(from) => {
            const course = picking;
            setPicking(null);
            correct(course, { kind: "counted-as", code: from, at: Date.now() }, t("curriculum.fixDone.counted-as", { from, code: course.code }));
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </View>
  );
}

/** The leading card: SKS passed of the curriculum's total, big, over the bar of passed, this semester and planned. */
function Totals({ whatIf, sks }: { /** This semester holds what-ifs: every count here includes them. */ whatIf: boolean; sks: SksModel }) {
  const t = useT();
  const v = useTheme().v4;
  const of = t("mobile.curriculum.ofSks", { need: sks.need });
  return (
    <Panel testID="card.curriculumTotals" style={{ padding: space[5], gap: space[3] }}>
      <View accessible accessibilityLabel={`${t("grades.sksPassed")} ${sks.passed} ${of}`}>
        <FigureLabel>{t("grades.sksPassed")}</FigureLabel>
        <Figure id="curriculum.sksPassed" value={sks.passed} unit={of} />
      </View>
      <SksBar sks={sks} headline={false} legend={false} />
      {whatIf && (
        <Text size="bodyMedium" style={{ color: v.brandInk }}>
          {t("curriculum.withWhatIfs")}
        </Text>
      )}
    </Panel>
  );
}

/**
 * Under the card, one group: the required courses left and the electives (the same SKS count as the planner), the
 * curriculum's name with what's worth knowing about it (`children`), then "Sisa saja".
 */
function Standing({ sks, onlyLeft, onToggle, children }: { sks: SksModel; onlyLeft: boolean; onToggle: (on: boolean) => void; children?: ReactNode }) {
  const t = useT();
  const v = useTheme().v4;
  const e = sks.electives;
  const value = (text: string, extra?: number) => (
    <Text size="bodyMedium" weight="semibold" tabular style={{ color: v.fg }}>
      {text}
      {extra ? (
        <Text size="bodyMedium" weight="semibold" style={{ color: v.okFg }}>
          {`  +${extra}`}
        </Text>
      ) : null}
    </Text>
  );
  // The figure on the title's line, so the meta line under it has the row's whole width ("19 lulus · 12 semester ini ·
  // 6 direncanakan" was cut beside a figure at the row's end).
  const headline = (title: string, figure: ReactNode) => (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[3] }}>
      <Text size="bodyLarge" weight="medium" style={{ flex: 1, color: v.fg, lineHeight: 21 }}>
        {title}
      </Text>
      {figure}
    </View>
  );
  return (
    <Group testID="card.curriculumStanding">
      {/* What's left, in the desktop's words ("Sisa: 3 wajib (12 SKS), sudah direncanakan · pilihan 6 SKS"). */}
      <GroupRow
        first
        title={t("curriculum.left")}
        meta={factsLabel(
          sks.requiredLeft.count
            ? t(sks.requiredUnplanned.count === 0 ? "curriculum.left.requiredPlanned" : "curriculum.left.required", {
                count: sks.requiredLeft.count,
                sks: sks.requiredLeft.sks,
              })
            : t("curriculum.left.requiredNone"),
          sks.electiveNeed === null ? null : e.short ? t("curriculum.left.electives", { sks: e.short }) : t("curriculum.left.electivesNone"),
        )}
      />
      {sks.electiveNeed !== null && (
        <GroupRow
          title={headline(
            t("curriculum.electives"),
            value(t("curriculum.electivesValue", { have: Math.min(e.have, sks.electiveNeed), need: sks.electiveNeed }), e.extra),
          )}
          meta={
            <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted }}>
              {t("curriculum.electivesDetail", { passed: e.passed, now: e.inProgress, planned: e.planned })}
            </Text>
          }
        />
      )}
      {children}
      <GroupRow
        title={t("curriculum.onlyLeft")}
        trailing={<Switch value={onlyLeft} onChange={onToggle} label={t("curriculum.onlyLeft")} testID="action.onlyLeft" />}
      />
    </Group>
  );
}

/** Whether a D passes a course in the Student's program: on, as ITB's rules have it, unless their program asks for a C. */
function DRule() {
  const t = useT();
  const [dFails, setDFails] = useDFails();
  return (
    <Group style={{ marginTop: space[5] }}>
      <GroupRow
        first
        title={t("curriculum.dPasses")}
        meta={t("curriculum.dPassesHint")}
        trailing={<Switch value={!dFails} onChange={(on) => setDFails(!on)} label={t("curriculum.dPasses")} testID="action.dPasses" />}
      />
    </Group>
  );
}

/** A course's one status at the end of its row: the grade once passed, a pill while it's under way or needs the Student. */
function Status({ course }: { course: MapCourse }) {
  const t = useT();
  const gradesAreHidden = useGradesHidden();
  const v = useTheme().v4;
  if (course.whatIf === "added") return <Pill tone="brand">{t("planner.whatIfTag")}</Pill>;
  if (course.whatIf === "left-out") return <Pill tone="plain">{t("planner.droppedTag")}</Pill>;
  const label = t(`curriculum.status.${course.status}`);
  switch (course.status) {
    case "passed":
      // Most rows: the check and the grade say it, quietly, so the rows that need the Student stand out.
      // Hidden grades: "Lulus", without the letter.
      if (course.grade && !gradesAreHidden)
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], minWidth: 40, justifyContent: "flex-end" }}>
            <Icons.Check size={14} color={v.okFg} weight="bold" />
            <Text size="bodyLarge" face="display" weight="bold" tabular style={{ color: v.okFg }}>
              {course.grade}
            </Text>
          </View>
        );
      return <Pill tone="ok">{label}</Pill>;
    case "exempt":
    case "done":
    case "program-adds":
      return <Pill tone="ok">{label}</Pill>;
    case "failed":
      return <Pill tone="red">{label}</Pill>;
    case "in-progress":
      return <Pill tone="brand">{label}</Pill>;
    case "planned":
      return <Pill tone="plain">{label}</Pill>;
    case "left":
      return <Pill tone="amber">{label}</Pill>;
    default:
      // Unlisted and not in the curriculum: said on the meta line, the row stays quiet.
      return null;
  }
}

function CourseRow({ course, first, menuHint, onPress }: { course: MapCourse; first: boolean; menuHint: boolean; onPress?: () => void }) {
  const t = useT();
  const gradesAreHidden = useGradesHidden();
  const v = useTheme().v4;
  const crossed = course.status === "not-mine";
  const sks = `${course.sks ?? "-"} SKS`;
  const statusWord =
    course.whatIf === "added"
      ? t("planner.whatIfTag")
      : course.whatIf === "left-out"
        ? t("planner.droppedTag")
        : `${t(`curriculum.status.${course.status}`)}${course.grade && !gradesAreHidden ? ` ${course.grade}` : ""}`;
  // The code, then how it's counted (under an older code) or its SKS, then what isn't a status but is still true.
  const meta = factsLabel(
    course.code,
    course.via ? t("curriculum.via", { code: course.via.code }) : sks,
    !course.whatIf && (course.status === "unlisted" || crossed) && t(`curriculum.status.${course.status}`),
    course.fix && t("curriculum.fixed"),
    course.sixLeft && t("curriculum.sixStillLeft"),
  );
  // Off the Student's list: the meta line says so, and a row they may want to correct shows it has a menu.
  const quiet = !course.whatIf && (course.status === "unlisted" || crossed);
  const trailing = !quiet ? <Status course={course} /> : menuHint ? <Icons.MoreHorizontal size={20} color={v.muted} /> : null;
  return (
    <GroupRow
      first={first}
      testID={`row.course.${course.code}`}
      title={
        <Text size="bodyLarge" weight="medium" numberOfLines={3} style={{ color: crossed ? v.muted : v.fg, lineHeight: 21 }}>
          {course.name}
        </Text>
      }
      meta={meta}
      trailing={trailing}
      onPress={onPress}
      onLongPress={onPress}
      // A screen reader hears the row whole, with the word the check stands for.
      accessible
      accessibilityLabel={factsLabel(course.code, course.name, statusWord, sks, course.via && t("curriculum.via", { code: course.via.code }))}
      accessibilityHint={onPress && course.courseId ? t("curriculum.syllabusOf", { code: course.code }) : undefined}
    />
  );
}

/** "Counted as…": the passed courses that could stand in for a required one, SIX's own suggestion first. */
function PickStandIn({ record, course, onPick, onClose }: { record: StudentRecord; course: MapCourse; onPick: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const gradesAreHidden = useGradesHidden();
  const theme = useTheme();
  const all = standIns(record, course.code);
  const semester = record.required.get(course.code)?.semester;
  const suggested = all.filter((c) => c.suggested);
  const rest = all.filter((c) => !c.suggested);
  const group = (title: string, list: StandIn[]) =>
    list.length > 0 && (
      <View style={{ marginTop: space[3] }}>
        <Text size="caption" weight="medium" tone="muted" style={{ paddingBottom: space[1] }}>
          {title}
        </Text>
        {list.map((c) => (
          <Pressable
            key={c.code}
            accessibilityRole="button"
            onPress={() => onPick(c.code)}
            android_ripple={{ color: theme.color.selected }}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingVertical: space[2.5], minHeight: 48 },
              iosPressed(pressed),
            ]}
            testID={`action.standIn.${c.code}`}
          >
            <Text size="small" weight="semibold" tabular style={{ width: 64, paddingTop: 1 }}>
              {c.code}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="body">{c.name}</Text>
              {c.fills ? (
                <Text size="caption" tone="muted">
                  {t("curriculum.pick.fills", { code: c.fills })}
                </Text>
              ) : null}
            </View>
            <Meta>
              {gradesAreHidden ? null : c.grade}
              {`${c.sks ?? "-"} SKS`}
            </Meta>
          </Pressable>
        ))}
      </View>
    );
  return (
    <Sheet open onClose={onClose} title={t("curriculum.pick.title", { code: course.code, name: course.name })} testID="sheet.standIn">
      <Text size="small" tone="muted">
        {t("curriculum.pick.body")}
      </Text>
      {all.length === 0 && (
        <Text size="small" tone="muted" style={{ paddingVertical: space[6], textAlign: "center" }}>
          {t("curriculum.pick.none")}
        </Text>
      )}
      {semester !== undefined && group(t("curriculum.pick.suggested", { n: semester }), suggested)}
      {group(t("curriculum.pick.others"), rest)}
      <View style={{ height: space[2] }} />
    </Sheet>
  );
}

/** Specializations or minors: each a card, its SKS so far over a thin bar, then its courses. */
function Packages({ id, title, packages }: { id: string; title: string; packages: PackageProgress[] }) {
  const t = useT();
  const v = useTheme().v4;
  return (
    <View testID={`section.${id}`}>
      <Heading>{title}</Heading>
      <View style={{ gap: space[3] }}>
        {packages.map((p) => {
          const progress = t("curriculum.packageSks", { have: p.have, need: p.sks });
          return (
            <Group key={`${p.program ?? ""}${p.name}`}>
              <GroupRow
                first
                title={
                  <Text size="bodyLarge" face="display" weight="bold" style={{ color: v.fg }}>
                    {p.name}
                  </Text>
                }
                meta={factsLabel(p.program, p.registered && t(p.notContinuing ? "curriculum.notContinuing" : "curriculum.registered"))}
                metaTone={p.registered && !p.notContinuing ? "ok" : "muted"}
                trailing={
                  <Text size="bodyMedium" weight="semibold" tabular style={{ color: v.fg }}>
                    {progress}
                  </Text>
                }
              >
                <View style={{ marginTop: space[2] }}>
                  <Meter value={p.sks ? p.have / p.sks : 0} color={v.okFg} label={`${p.name}: ${progress}`} />
                </View>
              </GroupRow>
              {p.courses.map((c) => {
                const left = isLeft(c.status);
                const word = c.whatIf
                  ? t(c.whatIf === "added" ? "planner.whatIfTag" : "planner.droppedTag")
                  : left && c.status !== "in-progress" && c.status !== "planned" && c.status !== "failed"
                    ? t("curriculum.status.left")
                    : t(`curriculum.status.${c.status}`);
                const notTaken = left && c.status !== "in-progress" && c.status !== "planned";
                return (
                  <GroupRow
                    key={c.code}
                    testID={`row.course.${c.code}`}
                    accessible
                    accessibilityLabel={factsLabel(c.code, c.name, word)}
                    title={
                      <Text size="bodyLarge" style={{ color: notTaken ? v.muted : v.fg, lineHeight: 21 }}>
                        {c.name}
                      </Text>
                    }
                    meta={c.code}
                    trailing={<PackageMark status={c.status} whatIf={c.whatIf} />}
                  />
                );
              })}
            </Group>
          );
        })}
      </View>
    </View>
  );
}

/** A package course: a check when done, a pill when under way, nothing (its name greyed) when not taken. */
function PackageMark({ status, whatIf }: { status: SlotStatus; whatIf: MapCourse["whatIf"] }) {
  const t = useT();
  const v = useTheme().v4;
  if (whatIf) return <Pill tone={whatIf === "added" ? "brand" : "plain"}>{t(whatIf === "added" ? "planner.whatIfTag" : "planner.droppedTag")}</Pill>;
  if (status === "passed" || status === "exempt") return <Icons.Check size={18} color={v.okFg} weight="bold" />;
  if (status === "in-progress") return <Pill tone="brand">{t("curriculum.status.in-progress")}</Pill>;
  if (status === "planned") return <Pill tone="plain">{t("curriculum.status.planned")}</Pill>;
  if (status === "failed") return <Pill tone="red">{t("curriculum.status.failed")}</Pill>;
  return null;
}

/**
 * The curriculum's name, with what's worth knowing about it on its line in the desktop's few words (an older start,
 * courses SIX leaves off: "Mulai di Kurikulum 2019 · 3 tidak di catatan SIX-mu"); the row opens a sheet that says why.
 */
function Notes({ name, startedOn, year, unlisted }: { name: string; startedOn: number | null; year: number; unlisted: number }) {
  const t = useT();
  const v = useTheme().v4;
  const [open, setOpen] = useState(false);
  const started = startedOn !== null ? t("mobile.curriculum.started", { from: startedOn }) : null;
  const offSix = unlisted > 0 ? t("curriculum.unlistedShort", { count: unlisted }) : null;
  const note = factsLabel(started, offSix);
  // The name on two lines; both facts on the meta line, as the desktop's heading says them. The sheet says why.
  const title = (
    <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
      {name}
    </Text>
  );
  const meta = note ? (
    <Text size="bodyMedium" numberOfLines={2} style={{ color: v.muted }}>
      {note}
    </Text>
  ) : null;
  if (!note) return <GroupRow title={title} />;
  return (
    <>
      <GroupRow
        title={title}
        meta={meta}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={factsLabel(name, note)}
        testID="action.curriculumNotes"
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={name} background={v.card} testID="sheet.curriculumNotes">
        <View style={{ gap: space[3], paddingBottom: space[2] }}>
          {unlisted > 0 && (
            <Text size="bodyLarge" style={{ color: v.fg }}>
              {t("curriculum.unlistedNote", { count: unlisted })}
            </Text>
          )}
          {startedOn !== null && (
            <Text size="bodyLarge" style={{ color: v.fg }}>
              {t("curriculum.startedOn", { from: startedOn, to: year })}
            </Text>
          )}
        </View>
      </Sheet>
    </>
  );
}
