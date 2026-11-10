// Materi (/materials, round 4): this week's material from every course of the term, two taps from Beranda (the tile,
// then the material). One section per course whose Modul tab marks a module "Minggu ini" (./week.ts): the course's
// tile and short name, the module's number and title on one quiet line, then that module's materials as short rows
// (MaterialRow with its course: the kind's icon in the course's colour, the title, its kind and one date; a file opens
// in the phone's app, a link opens, a note unfolds on tap), and the way to the whole course. "Minggu lalu" shows the week before.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { useNav } from "../../nav";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { Button, Segmented } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Page } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { CardGroup } from "../../ui/v4-list";
import type { Entry } from "../course/contents";
import { MaterialRow } from "../course/modules";
import { shortName } from "../home/parts";
import { type Week, weekSections } from "./week";

export function MaterialsScreen() {
  const t = useT();
  const theme = useTheme();
  const now = useNow();
  const nav = useNav();
  const pull = usePullToRefresh();
  const courses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const materials = useDataset("edunex.materials");
  const tasks = useDataset("edunex.tasks");
  const edunex = useStatus("edunex").state;
  const [week, setWeek] = useState<Week>("this");
  const sections = useMemo(
    () => (courses && materials ? weekSections({ courses, outline, materials, tasks }, t, now, week) : null),
    [courses, outline, materials, tasks, t, now, week],
  );
  const reading = edunex === "connecting" || edunex === "live";
  usePerfDrawn(sections !== null || !reading);
  return (
    <Page testID="screen.materials" background={theme.v4.page} header={<TopBar v4 title={t("mobile.service.materials")} />} {...pull}>
      <Segmented
        options={[
          { value: "this", label: t("course.thisWeek") },
          { value: "last", label: t("mobile.materials.lastWeek") },
        ]}
        value={week}
        onChange={setWeek}
        label={t("mobile.materials.which")}
        check={false}
        testID="materials.week"
      />
      {sections === null && reading ? (
        <MaterialsSkeleton />
      ) : !sections?.length ? (
        <View style={{ marginTop: space[6] }}>
          <EmptyState
            icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />}
            title={t(week === "this" ? "mobile.materials.noneThisWeek" : "mobile.materials.noneLastWeek")}
          >
            <Button variant="tonal" onPress={() => nav.go({ screen: "presence" })} testID="action.courses">
              {t("mobile.materials.toCourses")}
            </Button>
          </EmptyState>
        </View>
      ) : (
        sections.map(({ course, entry }) => <CourseSection key={course.code} course={course} entry={entry} />)
      )}
    </Page>
  );
}

/** A course's part: its tile and short name, the module on one quiet line, the module's materials, the way to the course. */
function CourseSection({ course, entry }: { course: TermCourse; entry: Entry }) {
  const t = useT();
  const v = useTheme().v4;
  const nav = useNav();
  const { ink } = useCourseTile()(course.code);
  const short = shortName(course.name);
  const module = entry.intro ? entry.title : factsLabel(t("course.module", { no: entry.label ?? "" }), entry.title);
  return (
    <View testID={`section.materials.${course.code}`} style={{ marginTop: space[6] }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={factsLabel(course.name, module, entry.parent ? t("course.jointClass") : null)}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[3], marginLeft: space[1] }}
      >
        <CourseTile code={course.code} name={course.name} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="titleMedium" face="display" weight="bold" numberOfLines={1} style={{ color: v.fg, fontSize: 17, letterSpacing: -0.2 }}>
            {short}
          </Text>
          <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted, marginTop: 1 }}>
            {module}
          </Text>
        </View>
      </View>
      <CardGroup>
        {entry.materials.map((material, i) => (
          <MaterialRow key={material.id} material={material} first={i === 0} course={course.code} />
        ))}
      </CardGroup>
      <PressScale
        testID={`action.course.${course.code}`}
        accessibilityRole="link"
        accessibilityLabel={t("mobile.materials.wholeCourse", { course: course.name })}
        onPress={() => nav.go({ screen: "course", code: course.code })}
        style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: space[1], minHeight: 48, paddingHorizontal: space[1] }}
      >
        <Text size="labelLarge" weight="semibold" numberOfLines={1} style={{ color: ink, flexShrink: 1 }}>
          {t("mobile.materials.wholeCourse", { course: short })}
        </Text>
        <Icons.ChevronRight size={16} color={ink} />
      </PressScale>
    </View>
  );
}

function MaterialsSkeleton() {
  return (
    <View testID="skeleton.materials">
      {[0, 1].map((i) => (
        <View key={i} style={{ marginTop: space[6] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[3] }}>
            <Skeleton height={40} width={40} style={{ borderRadius: 13 }} />
            <View style={{ flex: 1, gap: space[1.5] }}>
              <Skeleton height={16} width="50%" />
              <Skeleton height={12} width="70%" />
            </View>
          </View>
          <CardGroup>
            {[0, 1].map((j) => (
              <View
                key={j}
                style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}
              >
                <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
                <View style={{ flex: 1, gap: space[1.5] }}>
                  <Skeleton height={16} width="70%" />
                  <Skeleton height={12} width="40%" />
                </View>
              </View>
            ))}
          </CardGroup>
        </View>
      ))}
    </View>
  );
}
