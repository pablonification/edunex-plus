// Lainnya: what the desktop's sidebar holds beyond the four tabs. Nilai and Rencana studi, the
// term's courses with their colors (long-press a course for its color), and Settings and
// "Laporkan masalah" at the end.
import { router } from "expo-router";
import { View } from "react-native";
import { useCourseColor, useTermCourses } from "../../../src/app/courses";
import { useT } from "../../../src/app/i18n";
import { displayName, initials } from "../../../src/app/names";
import { usePlanBadge } from "../../../src/app/shell/badges";
import { useDataset } from "../../../src/app/store";
import { useNav } from "../../src/nav";
import { openCourseColorPicker } from "../../src/parts/course-color-picker";
import { openReport } from "../../src/parts/report";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { IconButton } from "../../src/ui/controls";
import { Badge, CourseCode } from "../../src/ui/display";
import { Icons } from "../../src/ui/icons";
import { factsLabel, List, Page, PageHeader, Row, Section } from "../../src/ui/layout";
import { Text } from "../../src/ui/text";
import { useTheme } from "../../src/ui/theme";

export default function More() {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const pull = usePullToRefresh();
  const courses = useTermCourses();
  const color = useCourseColor();
  const plan = usePlanBadge();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const glyph = (Icon: (typeof Icons)[keyof typeof Icons]) => <Icon size={20} color={theme.color.muted} />;
  return (
    <Page testID="screen.more" header={<TabHeader />} {...pull}>
      <PageHeader title={t("mobile.tab.more")} />
      {/* Who's signed in, the desktop sidebar's footer: the way to Settings. */}
      <List>
        <Row
          leading={
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.infoBg, alignItems: "center", justifyContent: "center" }}>
              {name ? (
                <Text size="small" weight="semibold" tone="info">
                  {initials(name)}
                </Text>
              ) : (
                <Icons.User size={18} color={theme.color.infoFg} />
              )}
            </View>
          }
          title={name ? displayName(name) : t("nav.settings")}
          // Who: the NIM and the program (Pengaturan has its own row below).
          meta={name ? factsLabel(account?.nim ?? student?.nim, student?.program) || undefined : undefined}
          onPress={() => router.push("/settings")}
          testID="row.nav.account"
        />
      </List>
      <View style={{ height: 16 }} />
      <List>
        <Row leading={glyph(Icons.GraduationCap)} title={t("nav.grades")} onPress={() => nav.go({ screen: "grades" })} testID="row.nav.grades" />
        <Row
          leading={glyph(Icons.BookOpen)}
          title={t("nav.plan")}
          trailing={plan ? <Badge tone={plan.tone === "warning" ? "warning" : "neutral"}>{plan.value}</Badge> : undefined}
          onPress={() => nav.go({ screen: "plan" })}
          testID="row.nav.plan"
        />
      </List>
      {courses && courses.length > 0 && (
        <Section
          title={t("nav.courses")}
          count={courses.length}
          // The visible way to the colors, as the desktop's palette by its "Mata kuliah": Settings' list of them.
          action={
            <IconButton
              label={t("nav.courseColors")}
              onPress={() => router.push({ pathname: "/settings", params: { at: "courseColors" } })}
              testID="action.courseColors"
            >
              <Icons.Palette size={18} color={theme.color.faint} />
            </IconButton>
          }
        >
          <List>
            {courses.map((course) => (
              <Row
                key={course.code}
                leading={<CourseCode code={course.code} color={color(course.code)} column />}
                title={course.name}
                onPress={() => nav.go({ screen: "course", code: course.code })}
                onLongPress={() => openCourseColorPicker(course.code)}
                testID={`row.course.${course.code}`}
              />
            ))}
          </List>
        </Section>
      )}
      <View style={{ height: 32 }} />
      <List>
        <Row leading={glyph(Icons.Settings)} title={t("nav.settings")} onPress={() => router.push("/settings")} testID="row.nav.settings" />
        <Row leading={glyph(Icons.Flag)} title={t("report.title")} onPress={() => openReport({})} testID="row.nav.report" />
      </List>
    </Page>
  );
}
