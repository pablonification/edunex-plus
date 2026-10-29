// A course's color on the phone (A11, src/app/course-color-picker.tsx): a sheet with the course's
// code and name, a line saying what's on ("Otomatis: Biru muda"), then automatic and the ten colors
// by hue, each with its name and the code of a course that already has it. Tapping one redraws the
// course everywhere at once (the screen behind is the preview, src/app/course-colors.ts); it's saved
// once, as the sheet closes (Back, a tap outside), and said back with Undo. Two courses may share a
// color: it says so, once, in neutral words.
// Opened from the course page's "⋯" (its own sheet) and from anywhere else through
// openCourseColorPicker(code), drawn by <CourseColorPickerHost /> mounted once in the app's frame.
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { endPreview, previewCourseColor, useCommittedCourseColors, useCourseColorPicks, withLegacy } from "../../../src/app/course-colors";
import { useTermCourses } from "../../../src/app/courses";
import { type Translate, useFormat, useT } from "../../../src/app/i18n";
import { applyChoice, courseTone, type PaletteId, PICKER_ORDER, pickedColor, resolveCourseColors } from "../../../src/core/course-colors";
import { Icons } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { Text } from "../ui/text";
import { radius, space, useTheme } from "../ui/theme";

/** A palette color's name, in the Student's language ("Biru muda"). From src/app/course-color-picker.tsx. */
export const colorName = (t: Translate, id: PaletteId) => t(`courseColor.name.${id}`);

/** The picker for `code` while `open`; `onClose` once it has saved (or kept) the choice. */
export function CourseColorSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const picks = useCourseColorPicks();
  const close = () => {
    void picks.finish(code);
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} testID="sheet.courseColor">
      {/* Mounted only while open: it works out everything from how the colors were when it opened. */}
      {open && <Choices code={code} />}
    </Sheet>
  );
}

function Choices({ code }: { code: string }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const courses = useTermCourses();
  const committed = useCommittedCourseColors();
  // As the desktop: against how things were when it opened, so trying colors never shoves the other courses around.
  const [codes] = useState(() => {
    const term = courses?.map((course) => course.code) ?? [];
    return term.includes(code) ? term : [...term, code];
  });
  const [base] = useState(() => withLegacy(codes, committed));
  const [choice, setChoice] = useState<PaletteId | null>(() => pickedColor(code, base) ?? null);
  useLayoutEffect(() => previewCourseColor({ code, codes, base, choice }), [code, codes, base, choice]);
  useLayoutEffect(() => () => endPreview(code), [code]);

  const name = courses?.find((course) => course.code === code)?.name;
  const outcome = (id: PaletteId | null) => resolveCourseColors(codes, applyChoice(base, code, id, 0));
  const automatic = outcome(null).colors.get(code)!.id;
  const now = outcome(choice);
  const shown = now.colors.get(code)!.id;
  // Who has each color as it opened: the code under each swatch.
  const before = resolveCourseColors(codes, base).colors;
  const holders = (id: PaletteId) => codes.filter((other) => other !== code && before.get(other)?.id === id);

  const sharing = codes.filter((other) => other !== code && now.colors.get(other)?.id === shown);
  const moved = now.moved.filter((m) => m.code !== code);
  const note =
    choice !== null && moved.length
      ? t("courseColor.moved", { code: moved[0]!.code, color: colorName(t, moved[0]!.from), next: colorName(t, moved[0]!.to) })
      : sharing.length
        ? t("courseColor.shared", { codes: f.list(sharing), color: colorName(t, shown), count: sharing.length })
        : codes.length > PICKER_ORDER.length
          ? t("courseColor.full")
          : "";

  /** A swatch's whole name: its color, and who has it or would move. */
  const label = (id: PaletteId) => {
    const result = outcome(id);
    const users = codes.filter((other) => other !== code && result.colors.get(other)?.id === id);
    if (users.length)
      return users.some((other) => result.colors.get(other)?.picked)
        ? t("courseColor.swatch.alsoPicked", { color: colorName(t, id), codes: f.list(users) })
        : t("courseColor.swatch.used", { color: colorName(t, id), codes: f.list(users) });
    const leaving = result.moved.filter((m) => m.code !== code && m.from === id);
    if (leaving.length)
      return t("courseColor.swatch.usedAuto", { color: colorName(t, id), codes: f.list(leaving.map((m) => m.code)), next: colorName(t, leaving[0]!.to) });
    return colorName(t, id);
  };
  const tone = (id: PaletteId) => theme.course(courseTone(id));

  return (
    <View>
      <Text size="title" weight="semibold" tabular accessibilityRole="header">
        {t("courseColor.title", { code })}
      </Text>
      {name && (
        <Text size="small" tone="muted" numberOfLines={1}>
          {name}
        </Text>
      )}
      <Text size="small" tone="muted" style={{ marginTop: space[1] }} accessibilityLiveRegion="polite">
        {choice === null
          ? t("courseColor.auto", { color: colorName(t, automatic) })
          : t("courseColor.picked", { color: colorName(t, choice), auto: colorName(t, automatic) })}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("courseColor.title", { code })} style={{ marginTop: space[3] }}>
        <Pressable
          testID="action.courseColor.auto"
          accessibilityRole="radio"
          accessibilityState={{ checked: choice === null }}
          onPress={() => setChoice(null)}
          android_ripple={{ color: theme.color.selected }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            minHeight: 48,
            paddingHorizontal: space[3],
            borderRadius: radius.lg,
            backgroundColor: choice === null ? theme.color.selected : "transparent",
          }}
        >
          <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: tone(automatic) }} />
          <Text size="body" weight={choice === null ? "semibold" : "medium"} style={{ flex: 1 }} numberOfLines={1}>
            {t("courseColor.autoChoice", { color: colorName(t, automatic) })}
          </Text>
          {choice === null && <Icons.Check size={16} weight="bold" />}
        </Pressable>
        <View style={{ marginTop: space[2], flexDirection: "row", flexWrap: "wrap", rowGap: space[2] }}>
          {PICKER_ORDER.map((id) => {
            const checked = choice === id;
            const held = holders(id);
            return (
              <Pressable
                key={id}
                testID={`action.courseColor.${id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                accessibilityLabel={label(id)}
                onPress={() => setChoice(id)}
                style={{ width: "20%", alignItems: "center", gap: 2, paddingVertical: space[1] }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: checked ? theme.color.fg : "transparent",
                  }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: tone(id), alignItems: "center", justifyContent: "center" }}>
                    {checked && <Icons.Check size={18} weight="bold" color="#ffffff" />}
                  </View>
                </View>
                <Text size="micro" tone={checked ? "fg" : "muted"} weight={checked ? "semibold" : "regular"} numberOfLines={1} importantForAccessibility="no">
                  {colorName(t, id)}
                </Text>
                <Text size="micro" tone="faint" tabular numberOfLines={1} importantForAccessibility="no">
                  {held.length ? `${held[0]}${held.length > 1 ? ` +${held.length - 1}` : ""}` : " "}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {/* Neutral: sharing a color is fine. */}
      {note ? (
        <View style={{ marginTop: space[3], flexDirection: "row", gap: space[2] }} accessibilityLiveRegion="polite">
          <Icons.Info size={16} color={theme.color.muted} />
          <Text size="small" tone="muted" style={{ flex: 1 }}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// The picker asked for from anywhere (Lainnya's course list, a long-press): one at a time.
let asked: string | null = null;
const watchers = new Set<() => void>();
const tell = () => {
  for (const watcher of watchers) watcher();
};

/** Opens the color picker for `code` (needs <CourseColorPickerHost /> mounted once). */
export function openCourseColorPicker(code: string): void {
  asked = code;
  tell();
}

/** Draws the picker openCourseColorPicker asked for. Mount once, in the app's frame. */
export function CourseColorPickerHost() {
  const code = useSyncExternalStore(
    (watcher) => {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    () => asked,
  );
  // Kept while the sheet slides away, so its title doesn't blank out.
  const [last, setLast] = useState(code);
  if (code !== null && code !== last) setLast(code);
  if (last === null) return null;
  return (
    <CourseColorSheet
      code={last}
      open={code !== null}
      onClose={() => {
        asked = null;
        tell();
      }}
    />
  );
}
