// Nilai's transcript on the phone (src/app/screens/grades.tsx's Transcript and TermRow): every term,
// newest first, one open at a time (the last graded one to start with), each its courses and
// grades as SIX lists them, a retake and a grade that doesn't count marked on its row.
// A term's row is `row.term.smt-<n>` (a short semester: its code), and says it's open with a
// `row.term.<…>.open` mark inside it, so a flow can open one without closing it.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { CheckedIndex, TranscriptTerm } from "../../../../src/core/models";
import { type StudentRecord, semesterOf, termKind } from "../../../../src/core/planner";
import { Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Section } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { GradeBadge, useTermName } from "../plan/projection";

/** SIX's figure when it shows one (it wins when the rows disagree), else the app's. */
export const shownIndex = (index: CheckedIndex) => index.six ?? index.computed;

/** "smt-7", or a short semester's code: the term's place in the flows' steps (the desktop inventory's "Smt 7"). */
export function termTestId(term: string, entryTerm: string | null): string {
  const semester = semesterOf(term, entryTerm);
  return termKind(term) === "short" || semester === null ? term : `smt-${semester}`;
}

export function Transcript({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const terms = record.transcript!.terms;
  const stage = record.progress?.stages.at(-1);
  const stageIp = stage ? shownIndex(stage.ip) : null;
  const lastGraded = [...terms].reverse().find((term) => shownIndex(term.ip) !== null)?.term ?? null;
  const [open, setOpen] = useState<string | null>(lastGraded);
  return (
    <Section
      title={t("grades.transcript")}
      description={
        <Meta>
          {t("grades.transcriptFrom")}
          {/* SIX's "Tahap Sarjana" IPK is the IPK without TPB: said in the Student's words. */}
          {stage && stageIp !== null && !/persiapan/i.test(stage.name) ? t("grades.stageIp", { ip: f.number(stageIp, 2) }) : ""}
        </Meta>
      }
      testID="section.transcript"
    >
      <List>
        {[...terms].reverse().map((term) => (
          <TermRow key={term.term} record={record} term={term} open={open === term.term} onToggle={() => setOpen(open === term.term ? null : term.term)} />
        ))}
      </List>
    </Section>
  );
}

function TermRow({ record, term, open, onToggle }: { record: StudentRecord; term: TranscriptTerm; open: boolean; onToggle: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const termName = useTermName(record);
  const ip = shownIndex(term.ip);
  const num = (value: number | null) => (value === null ? "-" : f.number(value, 2));
  const now = term.term === record.term && ip === null;
  const id = `row.term.${termTestId(term.term, record.entryTerm)}`;
  return (
    <View>
      <Pressable
        testID={id}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        android_ripple={{ color: theme.color.selected }}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 56 }}
      >
        <View testID={open ? `${id}.open` : undefined} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icons.ChevronRight size={16} color={theme.color.faint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="body" weight="medium">
            {termName(term.term)}
          </Text>
          <Meta>
            {t("grades.courseCount", { count: term.courses.length })}
            {!term.ip.agrees ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icons.AlertTriangle size={12} color={theme.color.warningFg} weight="bold" />
                <Text size="caption" weight="medium" tone="warning">
                  {t("grades.termDisagree", { six: num(term.ip.six), computed: num(term.ip.computed) })}
                </Text>
              </View>
            ) : null}
          </Meta>
        </View>
        <Text size={now ? "small" : "body"} weight={now ? "regular" : "semibold"} tone={now ? "muted" : "fg"} tabular>
          {now ? t("grades.inProgress") : `IP ${num(ip)}`}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.color.line,
            backgroundColor: theme.color.sunken,
            paddingHorizontal: space[4],
            paddingVertical: space[2],
          }}
        >
          {term.courses.map((course) => (
            <View
              key={`${course.code}-${course.attempt}`}
              testID={`row.course.${course.code}`}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingVertical: space[2] }}
            >
              <Text size="small" weight="semibold" tabular style={{ width: 64, paddingTop: 1 }}>
                {course.code}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="body">{course.name}</Text>
                {/* As on a narrow desktop list: the tags and SKS on a line under the name, the grade staying on the row. */}
                <View style={{ marginTop: 2, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[1.5] }}>
                  {course.attempt > 1 && <Tag>{t("grades.retaken")}</Tag>}
                  {course.standing !== "counted" && (
                    <Tag tone={course.standing === "pending" || course.standing === "unknown" ? "neutral" : "warning"}>
                      {t(`grades.standing.${course.standing}`)}
                    </Tag>
                  )}
                  <Text size="small" tone="muted" tabular>
                    {`${course.sks ?? "-"} SKS`}
                  </Text>
                </View>
              </View>
              <View style={{ minWidth: 36, alignItems: "flex-end" }}>
                {course.grade ? (
                  <GradeBadge grade={course.grade} struck={course.standing === "replaced"} />
                ) : (
                  <Text size="body" tone="faint">
                    -
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
