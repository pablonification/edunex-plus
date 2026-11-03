// Settings' pick-one and per-course groups. Tampilan (Tema, Bahasa) and Beranda (Jangkauan) are rows showing their
// value, each picked in a native sheet. Kehadiran: the default target with its stepper at the row's end, then each
// course with its own target (the row opens it in a sheet, with the way back to the default). Warna mata kuliah: each
// course as its colour's tile, its code, colour and whether it's automatic as the one line; the row opens the same
// picker as a course page's header; last, every course back to automatic at once (the snackbar offers Undo).
import { useState } from "react";
import { View } from "react-native";
import { useCourseColorPicks } from "../../../../src/app/course-colors";
import { useTermCourses } from "../../../../src/app/courses";
import { useFormat, useT } from "../../../../src/app/i18n";
import { NEEDS_AHEAD, type NeedsAhead, type Settings } from "../../../../src/core/models";
import { TargetStepper } from "../../parts/attendance";
import { colorName, openCourseColorPicker } from "../../parts/course-color-picker";
import { Button } from "../../ui/controls";
import { IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Chevron, ChoiceRow, haptic, SettingRow, SettingsGroup, SheetTitle } from "../../ui/settings-list";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import type { Update } from "./save";

/** Tampilan: Tema and Bahasa. */
export function Appearance({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  return (
    <SettingsGroup title={t("settings.appearance")}>
      <ChoiceRow
        title={t("settings.theme")}
        value={settings.theme}
        onChange={(theme) => update({ theme })}
        testID="segment.theme"
        choices={[
          { value: "system", label: t("settings.theme.system") },
          { value: "light", label: t("settings.theme.light") },
          { value: "dark", label: t("settings.theme.dark") },
        ]}
      />
      <ChoiceRow
        title={t("settings.language")}
        value={settings.lang}
        onChange={(lang) => update({ lang })}
        testID="segment.lang"
        choices={[
          { value: "id", label: "Indonesia" },
          { value: "en", label: "English" },
        ]}
      />
    </SettingsGroup>
  );
}

/** Beranda: how far ahead Perlu perhatianmu looks; what that means is in its sheet. */
export function HomeSettings({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  return (
    <SettingsGroup title={t("nav.home")}>
      <ChoiceRow
        title={t("settings.needsAhead")}
        note={t("settings.needsAhead.hint")}
        value={String(settings.needsAhead)}
        onChange={(days) => update({ needsAhead: Number(days) as NeedsAhead })}
        testID="segment.needsAhead"
        choices={NEEDS_AHEAD.map((days) => ({ value: String(days), label: t(`settings.needsAhead.${days}`) }))}
      />
    </SettingsGroup>
  );
}

/** Kehadiran: the default target, then each course with its own. */
export function AttendanceTargets({ settings, update }: { settings: Settings; update: Update }) {
  const t = useT();
  const courses = useTermCourses();
  const own = settings.attendanceTargets;
  const codes = Object.keys(own).sort();
  const [open, setOpen] = useState<string | null>(null);
  const setOwn = (code: string, value: number | null) => {
    const next = { ...own };
    if (value === null) delete next[code];
    else next[code] = value;
    update({ attendanceTargets: next });
  };
  const nameOf = (code: string) => courses?.find((one) => one.code === code)?.name;
  return (
    <SettingsGroup title={t("mobile.settings.attendance")}>
      <SettingRow
        title={t("settings.attendance.target")}
        meta={codes.length ? t("settings.attendance.targetHintOwn") : undefined}
        hint={codes.length ? undefined : t("settings.attendance.targetHint")}
        trailing={
          <TargetStepper
            value={settings.attendanceTarget}
            onChange={(attendanceTarget) => {
              haptic.tick();
              update({ attendanceTarget });
            }}
          />
        }
        testID="row.target"
      />
      {codes.map((code) => {
        const name = nameOf(code);
        return (
          <SettingRow
            key={code}
            leading={<CourseTile code={code} name={name} />}
            title={name ?? code}
            meta={t("settings.attendance.own", { code })}
            label={factsLabel(name ? `${code} ${name}` : code, `${own[code]}%`, t("settings.attendance.own", { code }))}
            onPress={() => setOpen(code)}
            trailing={<Percent value={own[code]!} />}
            testID={`row.target.${code}`}
          />
        );
      })}
      {open !== null && Object.hasOwn(own, open) && (
        <OwnTarget
          key="own"
          code={open}
          name={nameOf(open)}
          value={own[open]!}
          onChange={(value) => {
            haptic.tick();
            setOwn(open, value);
          }}
          onDefault={() => {
            haptic.confirm();
            setOwn(open, null);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </SettingsGroup>
  );
}

/** A course's own target in a sheet: its stepper, and the way back to the default. */
function OwnTarget({
  code,
  name,
  value,
  onChange,
  onDefault,
  onClose,
}: {
  code: string;
  name: string | undefined;
  value: number;
  onChange: (value: number) => void;
  onDefault: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const v = useTheme().v4;
  return (
    <Sheet open onClose={onClose} title={<SheetTitle>{name ? `${code} ${name}` : code}</SheetTitle>} background={v.card} testID="sheet.target">
      <View style={{ gap: space[4], alignItems: "flex-start", marginBottom: space[2] }}>
        <TargetStepper value={value} onChange={onChange} code={code} />
        <Button size="lg" variant="ghost" label={t("settings.attendance.useDefaultFor", { code })} onPress={onDefault} testID="action.targetDefault">
          {t("settings.attendance.useDefault")}
        </Button>
      </View>
    </Sheet>
  );
}

/** A row's value as a number in v4's face. */
function Percent({ value }: { value: number }) {
  const v = useTheme().v4;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
      <Text size="titleMedium" face="display" weight="bold" tabular style={{ color: v.fg }}>
        {`${value}%`}
      </Text>
      <Chevron />
    </View>
  );
}

/** Warna mata kuliah: each course this term, then all of them back to automatic. */
export function CourseColors() {
  const t = useT();
  const f = useFormat();
  const term = useTermCourses();
  const picks = useCourseColorPicks();
  // A code in two classes is one course with one color.
  const courses = (term ?? []).filter((course, index, all) => all.findIndex((other) => other.code === course.code) === index);
  if (!courses.length) return null;
  const picked = courses.filter((course) => course.colorPicked).length;
  return (
    <SettingsGroup title={t("settings.courseColors")} testID="section.settings.courseColors">
      {courses.map((course) => {
        const same = courses.filter((other) => other.code !== course.code && other.colorId === course.colorId).map((other) => other.code);
        const name = colorName(t, course.colorId);
        const how = t(course.colorPicked ? "courseColor.yours" : "courseColor.automatic");
        return (
          <SettingRow
            key={course.code}
            leading={<CourseTile code={course.code} name={course.name} />}
            title={course.name}
            meta={factsLabel(course.code, name, how)}
            label={factsLabel(
              `${course.name}, ${t("courseColor.current", { code: course.code, color: name })}`,
              how,
              same.length ? t("courseColor.sameAs", { codes: f.list(same) }) : null,
            )}
            hint={t("courseColor.change")}
            onPress={() => openCourseColorPicker(course.code)}
            trailing={<Chevron />}
            testID={`row.courseColor.${course.code}`}
          />
        );
      })}
      {picked > 0 && (
        <SettingRow
          leading={<IconTile tone="plain" icon={(color) => <Icons.Undo size={22} color={color} />} />}
          title={t("settings.courseColors.reset")}
          meta={t("settings.courseColors.allHint", { count: picked })}
          onPress={() => {
            haptic.confirm();
            void picks.resetAll(courses.map((course) => course.code));
          }}
          testID="action.resetCourseColors"
        />
      )}
    </SettingsGroup>
  );
}
