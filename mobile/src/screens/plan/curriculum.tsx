// Rencana studi › Kurikulum on the phone (src/app/screens/plan/curriculum.tsx, S13): the program's
// required courses by recommended semester with where the Student stands on each (courses passed
// under an older code matched the way SIX places them), in plain words; "Sisa saja" hides what's
// done (kept while the app is open); the totals from the same SKS count as the planner; the
// specializations and minors with progress; each course's syllabus on SIX's public pages; and the
// Student's own corrections where SIX's record doesn't match their curriculum, each one marked and
// reversible. On the phone a course's syllabus and corrections are a tap (or a long press) away,
// in a sheet, instead of on hover.
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { useCurriculumFix, usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { useViewChoice } from "../../../../src/app/view-choice";
import { curriculumMap, type MapCourse, type PackageProgress, type SlotStatus, type StandIn, standIns } from "../../../../src/core/curriculum-map";
import type { CurriculumFix } from "../../../../src/core/models";
import { hasWhatIfs, type SksModel, type StudentRecord, sksModel } from "../../../../src/core/planner";
import { SixPageNote, UnreadNote } from "../../parts/six-page-note";
import { toast } from "../../swaps/overlays";
import { Button, Switch } from "../../ui/controls";
import { Bar, Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Section } from "../../ui/layout";
import { ActionSheet, Sheet, type SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { WhatIfTag } from "./planner";
import { SixNeeded } from "./six-needed";

/** SIX's public course page (no sign-in): the syllabus. */
export const syllabusUrl = (courseId: string) => `https://six.itb.ac.id/pub/matakuliah/${courseId}`;

/** Still to do: everything not passed, credited, or off the Student's list (SIX doesn't ask it of them, or they said so). */
const isLeft = (status: SlotStatus) => !["passed", "exempt", "unlisted", "not-mine", "done", "program-adds"].includes(status);

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
  const map = record?.curriculum && state ? curriculumMap(record, state.plan) : null;
  if (!record || !state || !record.curriculum || !map)
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
  const sks = sksModel(record, state.plan);
  const hidden = map.semesters.length - semesters.length;
  const correct = (course: MapCourse, fix: CurriculumFix | null, message: string) => {
    const before = setFix(course.code, fix);
    toast(message, "neutral", { label: t("planner.undo"), onClick: () => setFix(course.code, before) });
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
    // SIX's record leaves it out: the Student can say it's theirs to take after all, as the note above the list says.
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
  const rowOf = (course: MapCourse, required: boolean) => {
    const actionable = required || course.courseId !== null;
    return (
      <CourseRow
        key={course.code}
        course={course}
        // The rows most likely to need a correction say they have a menu.
        menuHint={required && (course.status === "unlisted" || course.fix !== null)}
        onPress={actionable ? () => setActing({ course, required }) : undefined}
      />
    );
  };
  return (
    <View style={{ gap: space[6] }}>
      <SixPageNote datasets={["six.curriculum", "six.progress"]} />
      <UnreadNote record={record} />
      <Totals
        whatIf={hasWhatIfs(state.plan, record)}
        name={record.curriculum.name}
        year={record.curriculum.year}
        startedOn={map.startedOn}
        unlisted={map.semesters.flatMap((s) => s.required).filter((c) => c.status === "unlisted").length}
        sks={sks}
      />
      <View style={{ gap: space[3] }}>
        <LeftBar sks={sks} onlyLeft={onlyLeft} onToggle={setOnlyLeft} />
        {semesters.map((semester) => (
          <Card key={semester.semester} testID={`card.curriculum.${semester.semester}`}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: space[3],
                paddingHorizontal: space[4],
                paddingVertical: space[2.5],
                borderBottomWidth: 1,
                borderBottomColor: theme.color.line,
              }}
            >
              <Text size="body" weight="semibold" accessibilityRole="header">
                {t("planner.semester", { n: semester.semester })}
              </Text>
              {!onlyLeft && (
                <Text size="small" weight="medium" tone="muted" tabular>
                  {t("curriculum.sks", { sks: semester.required.reduce((sum, c) => sum + c.sks, 0) })}
                </Text>
              )}
            </View>
            {semester.required.map((course) => rowOf(course, true))}
            {semester.others.length > 0 && (
              <>
                <Text
                  size="caption"
                  weight="medium"
                  tone="muted"
                  style={{ paddingHorizontal: space[4], paddingTop: space[2.5], paddingBottom: space[1], borderTopWidth: 1, borderTopColor: theme.color.line }}
                >
                  {t("curriculum.others")}
                </Text>
                {semester.others.map((course) => rowOf(course, false))}
              </>
            )}
          </Card>
        ))}
        {onlyLeft && semesters.length === 0 && (
          <View style={{ borderRadius: radius.xl, backgroundColor: theme.color.sunken, paddingHorizontal: space[4], paddingVertical: space[6] }}>
            <Text size="small" tone="muted" style={{ textAlign: "center" }}>
              {t("curriculum.allDone")}
            </Text>
          </View>
        )}
        {onlyLeft && hidden > 0 && semesters.length > 0 && (
          <Text size="caption" tone="faint">
            {t("curriculum.hiddenDone", { count: hidden })}
          </Text>
        )}
      </View>
      {map.specializations.length > 0 && <Packages title={t("curriculum.specializations")} packages={map.specializations} id="specializations" />}
      {map.minors.length > 0 && <Packages title={t("curriculum.minors")} packages={map.minors} id="minors" />}
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

/** The curriculum's three numbers, each with its label: the total, required left, electives. */
function Totals({
  whatIf,
  name,
  year,
  startedOn,
  unlisted,
  sks,
}: {
  /** This semester holds what-ifs: every count here includes them. */
  whatIf: boolean;
  name: string;
  year: number;
  startedOn: number | null;
  unlisted: number;
  sks: SksModel;
}) {
  const t = useT();
  const theme = useTheme();
  const figure = (label: string, value: ReactNode, hint?: ReactNode) => (
    <View>
      <Text size="caption" weight="medium" tone="muted">
        {label}
      </Text>
      <Text size="title" weight="semibold" tabular style={{ marginTop: 2 }}>
        {value}
      </Text>
      {/* Fact by fact, so a narrow column wraps between "12 semester ini" and "6 direncanakan", never inside one. */}
      {hint ? <Meta size="caption">{hint}</Meta> : null}
    </View>
  );
  const e = sks.electives;
  return (
    <Card style={{ paddingHorizontal: space[4], paddingVertical: space[4] }} testID="card.curriculumTotals">
      <Text size="small" weight="medium" tone="muted">
        {name}
      </Text>
      {(startedOn !== null || unlisted > 0) && (
        <Text size="small" tone="muted" style={{ marginTop: 2 }}>
          {[startedOn !== null && t("curriculum.startedOn", { from: startedOn, to: year }), unlisted > 0 && t("curriculum.unlistedNote", { count: unlisted })]
            .filter(Boolean)
            .join(" ")}
        </Text>
      )}
      {whatIf && (
        <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icons.Info size={12} color={theme.color.infoFg} weight="bold" />
          <Text size="caption" weight="medium" tone="info">
            {t("curriculum.withWhatIfs")}
          </Text>
        </View>
      )}
      <View style={{ marginTop: space[3], gap: space[3] }}>
        {figure(
          t("curriculum.total"),
          t("curriculum.sks", { sks: sks.need }),
          sks.requiredNeed !== null && sks.electiveNeed !== null
            ? t("curriculum.totalSplit", { required: sks.requiredNeed, electives: sks.electiveNeed })
            : undefined,
        )}
        {figure(
          t("curriculum.requiredLeft"),
          sks.requiredLeft.count
            ? t("curriculum.requiredLeftValue", { count: sks.requiredLeft.count, sks: sks.requiredLeft.sks })
            : t("curriculum.requiredNone"),
          sks.requiredLeft.count > 0 && sks.requiredUnplanned.count === 0 ? t("curriculum.requiredLeftHint") : undefined,
        )}
        {sks.electiveNeed !== null &&
          figure(
            t("curriculum.electives"),
            <>
              {t("curriculum.electivesValue", { have: Math.min(e.have, sks.electiveNeed), need: sks.electiveNeed })}
              {e.extra > 0 ? (
                <Text size="small" weight="semibold" tone="success">
                  {`  +${e.extra}`}
                </Text>
              ) : null}
            </>,
            t("curriculum.electivesDetail", { passed: e.passed, now: e.inProgress, planned: e.planned }),
          )}
      </View>
    </Card>
  );
}

/** "Sisa saja" and what's left. */
function LeftBar({ sks, onlyLeft, onToggle }: { sks: SksModel; onlyLeft: boolean; onToggle: (on: boolean) => void }) {
  const t = useT();
  const parts = [
    sks.requiredLeft.count ? t("curriculum.left.required", { count: sks.requiredLeft.count, sks: sks.requiredLeft.sks }) : t("curriculum.left.requiredNone"),
    sks.electiveNeed === null ? null : sks.electives.short ? t("curriculum.left.electives", { sks: sks.electives.short }) : t("curriculum.left.electivesNone"),
  ].filter((part): part is string => part !== null);
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }} accessibilityLiveRegion="polite">
        <Text size="small" weight="semibold">{`${t("curriculum.left")}:`}</Text>
        <View style={{ flex: 1 }}>
          <Meta>{parts}</Meta>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <Text size="small" weight="medium">
          {t("curriculum.onlyLeft")}
        </Text>
        <Switch value={onlyLeft} onChange={onToggle} label={t("curriculum.onlyLeft")} testID="action.onlyLeft" />
      </View>
    </View>
  );
}

/** Where a course stands, in plain words: quiet when done or not yet, colored only where it needs the Student. */
function Status({ status, grade }: { status: SlotStatus; grade: string | null }) {
  const t = useT();
  const theme = useTheme();
  const label = t(`curriculum.status.${status}`);
  // The word a check stands for is in its row's accessible name (CourseRow).
  const check = () => <Icons.Check size={14} color={theme.color.successFg} weight="bold" />;
  const line = (children: ReactNode) => <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{children}</View>;
  switch (status) {
    case "passed":
      // Most rows: the check and the grade say it, so the rows that need the Student stand out. The word stays for a screen reader.
      if (grade)
        return line(
          <>
            {check()}
            <Text size="small" weight="semibold" tabular>
              {grade}
            </Text>
          </>,
        );
      return line(
        <>
          {check()}
          <Text size="small" tone="muted">
            {label}
          </Text>
        </>,
      );
    case "exempt":
    case "done":
    case "program-adds":
      return line(
        <>
          {check()}
          <Text size="small" tone="muted">
            {label}
          </Text>
        </>,
      );
    case "failed":
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 20,
            paddingHorizontal: 8,
            borderRadius: radius.full,
            backgroundColor: theme.color.dangerBg,
          }}
        >
          <Icons.AlertTriangle size={12} color={theme.color.dangerFg} weight="bold" />
          <Text size="micro" weight="semibold" tone="danger">
            {label}
          </Text>
        </View>
      );
    case "in-progress":
      return line(
        <>
          <Icons.Clock size={14} color={theme.color.infoFg} />
          <Text size="small" weight="medium" tone="info">
            {label}
          </Text>
        </>,
      );
    case "planned":
      return line(
        <>
          <Icons.Calendar size={14} color={theme.color.muted} />
          <Text size="small" tone="muted">
            {label}
          </Text>
        </>,
      );
    case "unlisted":
      return line(
        <>
          <Icons.Info size={14} color={theme.color.muted} />
          <Text size="small" tone="muted">
            {label}
          </Text>
        </>,
      );
    case "not-mine":
      return line(
        <>
          <Icons.Minus size={14} color={theme.color.faint} />
          <Text size="small" tone="faint">
            {label}
          </Text>
        </>,
      );
    default:
      return (
        <Text size="small" tone="faint">
          {label}
        </Text>
      );
  }
}

function CourseRow({ course, menuHint, onPress }: { course: MapCourse; menuHint: boolean; onPress?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const crossed = course.status === "not-mine";
  const statusWord =
    course.whatIf === "added"
      ? t("planner.whatIfTag")
      : course.whatIf === "left-out"
        ? t("planner.droppedTag")
        : `${t(`curriculum.status.${course.status}`)}${course.grade ? ` ${course.grade}` : ""}`;
  const body = (
    <>
      <Text size="small" weight="semibold" tone={crossed ? "muted" : "fg"} tabular style={{ width: 68, paddingTop: 1 }}>
        {course.code}
      </Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size="body" tone={crossed ? "muted" : "fg"} numberOfLines={3}>
          {course.name}
        </Text>
        {(course.via || course.fix) && (
          <Meta size="caption">
            {course.via ? t("curriculum.via", { code: course.via.code, name: course.via.name }) : ""}
            {course.fix ? t("curriculum.fixed") : ""}
            {course.sixLeft ? t("curriculum.sixStillLeft") : ""}
          </Meta>
        )}
        {/* As in a narrow desktop card: the status and SKS on a line under the name. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2.5], rowGap: 2 }}>
          {course.whatIf === "added" ? (
            // Tried this semester, not on SIX's KRS: never "This semester" as if it were.
            <WhatIfTag />
          ) : course.whatIf === "left-out" ? (
            <Text size="small" tone="info">
              {t("planner.droppedTag")}
            </Text>
          ) : (
            <Status status={course.status} grade={course.grade} />
          )}
          <Text size="small" tone="muted" tabular>
            {`${course.sks ?? "-"} SKS`}
          </Text>
        </View>
      </View>
      {menuHint && <Icons.MoreHorizontal size={18} color={theme.color.muted} />}
    </>
  );
  const style = { flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2.5] } as const;
  // A screen reader hears the row whole, with the word the check stands for.
  const label = factsLabel(course.code, course.name, statusWord, `${course.sks ?? "-"} SKS`);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.color.line }} testID={`row.course.${course.code}`}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={course.courseId ? t("curriculum.syllabusOf", { code: course.code }) : undefined}
          onPress={onPress}
          onLongPress={onPress}
          android_ripple={{ color: theme.color.selected }}
          style={style}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={style}>
          {body}
        </View>
      )}
    </View>
  );
}

/** "Counted as…": the passed courses that could stand in for a required one, SIX's own suggestion first. */
function PickStandIn({ record, course, onPick, onClose }: { record: StudentRecord; course: MapCourse; onPick: (code: string) => void; onClose: () => void }) {
  const t = useT();
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
            style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingVertical: space[2.5], minHeight: 48 }}
            testID={`action.standIn.${c.code}`}
          >
            <Text size="small" weight="semibold" tabular style={{ width: 64, paddingTop: 1 }}>
              {c.code}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="body">{c.name}</Text>
              {c.fills && (
                <Text size="caption" tone="muted">
                  {t("curriculum.pick.fills", { code: c.fills })}
                </Text>
              )}
            </View>
            <Meta>
              {c.grade}
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

function Packages({ id, title, packages }: { id: string; title: string; packages: PackageProgress[] }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Section first title={title} testID={`section.${id}`}>
      <View style={{ gap: space[3] }}>
        {packages.map((p) => (
          <Card key={`${p.program ?? ""}${p.name}`} style={{ paddingHorizontal: space[4], paddingVertical: space[3] }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space[3] }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="small" weight="semibold">
                  {p.name}
                </Text>
                {(p.program || p.registered) && (
                  <Meta size="caption">
                    {p.program ?? ""}
                    {p.registered ? (
                      <Text size="caption" weight={p.notContinuing ? "regular" : "medium"} tone={p.notContinuing ? "muted" : "info"}>
                        {t(p.notContinuing ? "curriculum.notContinuing" : "curriculum.registered")}
                      </Text>
                    ) : null}
                  </Meta>
                )}
              </View>
              <Text size="small" weight="semibold" tabular>
                {t("curriculum.packageSks", { have: p.have, need: p.sks })}
              </Text>
            </View>
            <Bar
              style={{ marginTop: space[2] }}
              value={p.sks ? p.have / p.sks : 0}
              color={theme.color.meterSuccess}
              label={`${p.name}: ${t("curriculum.packageSks", { have: p.have, need: p.sks })}`}
            />
            <View style={{ marginTop: space[2], gap: space[1] }}>
              {p.courses.map((c) => {
                const left = isLeft(c.status);
                const word = c.whatIf
                  ? t(c.whatIf === "added" ? "planner.whatIfTag" : "planner.droppedTag")
                  : left && c.status !== "in-progress" && c.status !== "planned" && c.status !== "failed"
                    ? t("curriculum.status.left")
                    : t(`curriculum.status.${c.status}`);
                return (
                  <View
                    key={c.code}
                    accessible
                    accessibilityLabel={factsLabel(c.code, c.name, word)}
                    style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
                    testID={`row.course.${c.code}`}
                  >
                    <Text
                      size="caption"
                      weight="semibold"
                      tone={left && c.status !== "in-progress" && c.status !== "planned" ? "muted" : "fg"}
                      tabular
                      style={{ width: 56 }}
                    >
                      {c.code}
                    </Text>
                    <Text size="caption" tone={left ? "muted" : "fg"} style={{ flex: 1, minWidth: 0 }}>
                      {c.name}
                    </Text>
                    <PackageMark status={c.status} whatIf={c.whatIf} />
                  </View>
                );
              })}
            </View>
          </Card>
        ))}
      </View>
    </Section>
  );
}

/** A package course: a check when done, a word when under way, nothing (just grey) when not taken. */
function PackageMark({ status, whatIf }: { status: SlotStatus; whatIf: MapCourse["whatIf"] }) {
  const t = useT();
  const theme = useTheme();
  if (whatIf)
    return (
      <Text size="caption" weight="medium" tone="info">
        {t(whatIf === "added" ? "planner.whatIfTag" : "planner.droppedTag")}
      </Text>
    );
  if (status === "passed" || status === "exempt") return <Icons.Check size={14} color={theme.color.successFg} weight="bold" />;
  if (status === "in-progress" || status === "planned" || status === "failed")
    return (
      <Text
        size="caption"
        weight={status === "planned" ? "regular" : "medium"}
        tone={status === "in-progress" ? "info" : status === "failed" ? "danger" : "muted"}
      >
        {t(`curriculum.status.${status}`)}
      </Text>
    );
  return null;
}
