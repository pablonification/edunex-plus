// Nilai's transcript on the phone (round 2, v4; src/app/screens/grades.tsx's Transcript and TermRow): every term,
// newest first, as rows in one white card under its heading, one open at a time (the last graded one to start with).
// An open term's courses follow its row, each with its course tile, its code and SKS on one line and its grade, a
// bold letter, at the end; a retake and a grade that doesn't count said on that line. The IPK without TPB sits quiet
// by the heading.
// A term's row is `row.term.smt-<n>` (a short semester: its code), and says it's open with a `row.term.<…>.open` mark
// inside it, so a flow can open one without closing it.
import { memo, useCallback, useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { CheckedIndex, TranscriptTerm } from "../../../../src/core/models";
import { type StudentRecord, semesterOf, termKind } from "../../../../src/core/planner";
import { Group, GroupRow, Heading, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { useTermName } from "../plan/projection";

/** SIX's figure when it shows one (it wins when the rows disagree), else the app's. */
export const shownIndex = (index: CheckedIndex) => index.six ?? index.computed;

/** "smt-7", or a short semester's code: the term's place in the flows' steps (the desktop inventory's "Smt 7"). */
export function termTestId(term: string, entryTerm: string | null): string {
  const semester = semesterOf(term, entryTerm);
  return termKind(term) === "short" || semester === null ? term : `smt-${semester}`;
}

/** A grade as a row's one status: a bold letter in the display face, a failing one (D, E) in red, a replaced one struck. */
export function GradeLetter({ grade, struck = false, label }: { grade: string; struck?: boolean; label?: string }) {
  const v = useTheme().v4;
  const failing = grade === "D" || grade === "E";
  return (
    <Text
      size="titleMedium"
      face="display"
      weight="bold"
      accessibilityLabel={label ? `${label}: ${grade}` : undefined}
      style={{
        minWidth: 32,
        textAlign: "right",
        fontSize: 17,
        color: failing ? v.redFg : struck ? v.muted : v.fg,
        textDecorationLine: struck ? "line-through" : "none",
      }}
    >
      {grade}
    </Text>
  );
}

export function Transcript({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const terms = record.transcript!.terms;
  const stage = record.progress?.stages.at(-1);
  const stageIp = stage ? shownIndex(stage.ip) : null;
  const lastGraded = [...terms].reverse().find((term) => shownIndex(term.ip) !== null)?.term ?? null;
  const [open, setOpen] = useState<string | null>(lastGraded);
  const toggle = useCallback((term: string) => setOpen((was) => (was === term ? null : term)), []);
  // SIX's "Tahap Sarjana" IPK is the IPK without TPB: said in the Student's words, quietly by the heading.
  const stageText = stage && stageIp !== null && !/persiapan/i.test(stage.name) ? t("grades.stageIp", { ip: f.number(stageIp, 2) }) : null;
  return (
    <View testID="section.transcript">
      <Heading
        trailing={
          stageText ? (
            <Text size="bodyMedium" tabular style={{ color: v.muted }}>
              {stageText}
            </Text>
          ) : undefined
        }
      >
        {t("grades.transcript")}
      </Heading>
      <Group>
        {[...terms].reverse().map((term, i) => (
          <TermRows key={term.term} record={record} term={term} first={i === 0} open={open === term.term} onToggle={toggle} />
        ))}
      </Group>
    </View>
  );
}

const TermRows = memo(function TermRows({
  record,
  term,
  first,
  open,
  onToggle,
}: {
  record: StudentRecord;
  term: TranscriptTerm;
  first: boolean;
  open: boolean;
  onToggle: (term: string) => void;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const termName = useTermName(record);
  const ip = shownIndex(term.ip);
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  const now = term.term === record.term && ip === null;
  const id = `row.term.${termTestId(term.term, record.entryTerm)}`;
  return (
    <>
      <GroupRow
        first={first}
        testID={id}
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(term.term)}
        title={
          <Text size="bodyLarge" face="display" weight="semibold" style={{ color: v.fg }}>
            {termName(term.term)}
          </Text>
        }
        meta={
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6 }}>
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {t("grades.courseCount", { count: term.courses.length })}
            </Text>
            {!term.ip.agrees ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icons.AlertTriangle size={12} color={v.ambFg} weight="bold" />
                <Text size="bodyMedium" tabular style={{ color: v.ambFg }}>
                  {t("grades.termDisagree", { six: num(term.ip.six), computed: num(term.ip.computed) })}
                </Text>
              </View>
            ) : null}
          </View>
        }
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {now ? (
              <Pill tone="plain">{t("grades.inProgress")}</Pill>
            ) : (
              <Text size="bodyLarge" face="display" weight="bold" tabular style={{ color: v.fg }}>
                {`IP ${num(ip)}`}
              </Text>
            )}
            {/* Folded or open: the arrow turns, and `.open` tells a flow it's open. */}
            <View testID={open ? `${id}.open` : undefined} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
              <Icons.ChevronDown size={18} color={v.muted} />
            </View>
          </View>
        }
      />
      {open && term.courses.map((course) => <CourseRow key={`${course.code}-${course.attempt}`} course={course} />)}
    </>
  );
});

/** A course on the transcript: its tile, its name, the code and SKS (and a retake or a grade that doesn't count), the grade. */
function CourseRow({ course }: { course: TranscriptTerm["courses"][number] }) {
  const t = useT();
  const counted = course.standing === "counted";
  // No grade yet: that is the row's status. A grade that doesn't count (replaced, not on the transcript yet): said on the line.
  const standing = course.standing === "counted" ? null : t(`grades.standing.${course.standing}`);
  const meta = [course.code, `${course.sks ?? "-"} SKS`, course.attempt > 1 ? t("grades.retaken") : null, course.grade ? standing : null]
    .filter(Boolean)
    .join(" · ");
  const warn = course.grade !== null && !counted && course.standing !== "pending" && course.standing !== "unknown";
  return (
    <GroupRow
      testID={`row.course.${course.code}`}
      leading={<CourseTile code={course.code} name={course.name} />}
      title={course.name}
      meta={meta}
      metaTone={warn ? "amber" : "muted"}
      trailing={
        course.grade ? (
          <GradeLetter grade={course.grade} struck={course.standing === "replaced"} />
        ) : (
          <Pill tone="plain">{standing ?? t("grades.standing.pending")}</Pill>
        )
      }
    />
  );
}
