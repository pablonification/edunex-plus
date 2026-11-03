// Adding a course to a semester (round 2, v4: the sheet on v4's white card): search by code or name, or pick from
// what the plan needs (required courses left, a specialization's or a minor's, retakes that lift the IPK), the
// program's electives, a minor's courses, or every ITB course in SIX's public catalog.
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { PlanState } from "../../../../src/app/study-plan";
import { nearestLetter } from "../../../../src/core/honors";
import type { PlannedCourse } from "../../../../src/core/models";
import {
  activeMinor,
  activeSpecialization,
  type CourseInfo,
  type CourseState,
  courseInfo,
  courseState,
  plannedCodes,
  programElectives,
  rankedMinors,
  retakeCandidates,
  type StudentRecord,
  searchCourses,
  startingIpk,
} from "../../../../src/core/planner";
import { Button, Chip, ChipRow } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Sheet, SheetTitle } from "../../ui/sheet";
import { slopY } from "../../ui/sizes";
import { Text, useFieldColors } from "../../ui/text";
import { radius, space, type, useTheme } from "../../ui/theme";

type AddTab = "needed" | "program" | "minors" | "all";

/** `now`: adding to this semester, as a what-if; a course planned for later can move into it. */
export function AddCourse({
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
  const fieldColors = useFieldColors();
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
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2.5], borderTopWidth: 1, borderTopColor: theme.v4.line }}
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
      background={theme.v4.card}
      testID="sheet.addCourse"
      title={
        // The search and the tabs stay in view while the list scrolls.
        <View style={{ gap: space[2] }}>
          <SheetTitle>{title}</SheetTitle>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              height: 44,
              borderRadius: radius.lg,
              paddingHorizontal: space[3],
              backgroundColor: theme.v4.page,
            }}
          >
            <Icons.Search size={18} color={theme.color.faint} />
            <TextInput
              {...fieldColors}
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
              <View key={m.key} style={{ paddingVertical: space[2.5], borderTopWidth: 1, borderTopColor: theme.v4.line }}>
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
                        hitSlop={slopY(32)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          minHeight: 32,
                          paddingHorizontal: space[2],
                          borderRadius: radius.md,
                          borderWidth: done ? 0 : 1,
                          borderColor: theme.color.edge,
                          backgroundColor: done ? theme.color.successBg : theme.color.surfaceContainerLow,
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
      <Text size="caption" tone="faint" style={{ paddingVertical: space[3], borderTopWidth: 1, borderTopColor: theme.v4.line }}>
        {t("planner.catalogSource")}
      </Text>
    </Sheet>
  );
}
