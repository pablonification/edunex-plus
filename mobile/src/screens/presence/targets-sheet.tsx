// Presensi's one Targets panel (src/app/attendance-parts.tsx's TargetsPanel) as a sheet: the
// default first, then every course with its own stepper, an "Own target" tag and the way back to
// the default. `focus`: the course a row's "Ubah target" opened it for. That course comes first,
// tinted, and the default goes last, so it isn't the first thing in reach when the Student meant one
// course. Changing a target is a setting: it never sends an alert.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { TargetStepper, useTargets } from "../../parts/attendance";
import { Button } from "../../ui/controls";
import { CourseCode, Tag } from "../../ui/display";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

export function TargetsSheet({
  courses,
  open,
  onClose,
  focus,
}: {
  courses: readonly { code: string; name: string; color: string }[];
  open: boolean;
  onClose: () => void;
  focus: string | null;
}) {
  const t = useT();
  const { target, own, setDefault, setOwn } = useTargets();
  const chosen = focus ? courses.find((course) => course.code === focus) : undefined;
  const ordered = chosen ? [chosen, ...courses.filter((course) => course !== chosen)] : courses;
  const everyCourse = (
    <TargetRow
      key="default"
      name={t("presence.targets.default")}
      hint={t("settings.attendance.targetHintOwn")}
      stepper={<TargetStepper value={target} onChange={setDefault} />}
    />
  );
  const rows = [
    ...(chosen ? [] : [everyCourse]),
    ...ordered.map((course) => {
      const mine = Object.hasOwn(own, course.code) ? own[course.code]! : null;
      return (
        <TargetRow
          key={course.code}
          chosen={course === chosen}
          title={
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[1.5] }}>
              <CourseCode code={course.code} color={course.color} />
              {mine !== null && <Tag>{t("presence.targets.own")}</Tag>}
            </View>
          }
          name={course.name}
          reset={
            mine !== null ? (
              <Button
                size="sm"
                variant="ghost"
                label={t("presence.targets.useDefaultFor", { code: course.code, value: target })}
                onPress={() => setOwn(course.code, null)}
                style={{ alignSelf: "flex-start", marginLeft: -space[3] }}
              >
                {t("presence.targets.useDefault", { value: target })}
              </Button>
            ) : null
          }
          stepper={<TargetStepper value={mine ?? target} onChange={(next) => setOwn(course.code, next)} code={course.code} />}
        />
      );
    }),
    ...(chosen ? [everyCourse] : []),
  ];
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.attendance.target")} testID="sheet.targets">
      <Text size="small" tone="muted">
        {t("presence.target.contract")}
      </Text>
      <View style={{ marginTop: space[3], marginBottom: space[2] }}>{rows}</View>
    </Sheet>
  );
}

/** One target: what it's for (a course, or the default), and its stepper. `chosen`: the course the sheet was opened for, tinted. */
function TargetRow({
  title,
  name,
  hint,
  reset,
  stepper,
  chosen = false,
}: {
  title?: ReactNode;
  name: string;
  hint?: string;
  reset?: ReactNode;
  stepper: ReactNode;
  chosen?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingVertical: space[2.5] },
        chosen
          ? { marginHorizontal: -space[2.5], paddingHorizontal: space[2.5], borderRadius: radius.lg, backgroundColor: theme.color.fill, marginBottom: space[1] }
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.line },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ?? (
          <Text size="small" weight="semibold">
            {name}
          </Text>
        )}
        {title && (
          <Text size="caption" tone="muted" numberOfLines={1}>
            {name}
          </Text>
        )}
        {hint && (
          <Text size="caption" tone="muted">
            {hint}
          </Text>
        )}
        {reset}
      </View>
      <View style={{ flexShrink: 0 }}>{stepper}</View>
    </View>
  );
}
