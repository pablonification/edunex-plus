// "Sembunyikan nilai" on the screens (src/core/hide-grades.ts has the rule): whether grades are hidden, the eye button
// that hides or shows them everywhere at once (Profil's card, Nilai's big number), a hidden figure as dots in the
// figure's own place, and the one quiet line that stands where a whole part made of grades was (a chart, a transcript).
// The setting is the engine's (Settings.hideGrades): it is on the phone's disk, read before the first frame is drawn
// (the store is made from the loaded engine), and the phone's notifier reads the same one.
import type { StyleProp, TextStyle } from "react-native";
import { View } from "react-native";
import { useT } from "../../../src/app/i18n";
import { useBridge, useSettings } from "../../../src/app/store";
import { gradesHidden, HIDDEN_FIGURE } from "../../../src/core/hide-grades";
import { Button, IconButton } from "../ui/controls";
import { haptic } from "../ui/haptics";
import { Icons } from "../ui/icons";
import { Text } from "../ui/text";
import { space, useTheme } from "../ui/theme";

/** Whether grades are hidden now. */
export function useGradesHidden(): boolean {
  return gradesHidden(useSettings());
}

/** A grade's words where they're one string among others (a row's meta, a tile's tag): the dots while hidden. */
export function useGradeWords(): (words: string) => string {
  const hidden = useGradesHidden();
  return (words) => (hidden ? HIDDEN_FIGURE : words);
}

/** Hides or shows grades, everywhere at once, with a light haptic. */
export function useToggleGrades(): () => void {
  const bridge = useBridge();
  const hidden = useGradesHidden();
  return () => {
    haptic.toggle(!hidden);
    void bridge.invoke("settings.update", { hideGrades: !hidden }).catch(() => undefined);
  };
}

/** The eye beside the biggest number: one tap hides or shows every grade. Named for what the tap does. */
export function HideGradesButton({ color, testID = "action.hideGrades" }: { color?: string; testID?: string }) {
  const t = useT();
  const v = useTheme().v4;
  const hidden = useGradesHidden();
  const toggle = useToggleGrades();
  const Eye = hidden ? Icons.EyeOff : Icons.Eye;
  return (
    <IconButton label={t(hidden ? "mobile.hideGrades.show" : "mobile.hideGrades")} onPress={toggle} testID={testID}>
      <Eye size={22} color={color ?? v.muted} />
    </IconButton>
  );
}

/**
 * A hidden figure: dots in the figure's own `style`, in the width a figure of `places` characters takes ("0,00"), so
 * nothing moves when grades are shown again. A screen reader hears "`name` disembunyikan".
 */
export function HiddenFigure({ name, style, places = "0,00", testID }: { name: string; style?: StyleProp<TextStyle>; places?: string; testID?: string }) {
  const t = useT();
  return (
    <View testID={testID} accessible accessibilityLabel={t("mobile.hideGrades.said", { name })}>
      {/* The figure's width, with nothing of the figure in it. */}
      <Text style={[style, { opacity: 0 }]} accessibilityElementsHidden importantForAccessibility="no">
        {places}
      </Text>
      <Text style={[style, { position: "absolute", left: 0, top: 0 }]} accessibilityElementsHidden importantForAccessibility="no">
        {HIDDEN_FIGURE}
      </Text>
    </View>
  );
}

/** Where a part made of grades was (a chart, a transcript, a course's scores): one quiet line and the way to show them. */
export function GradesHiddenLine({ testID = "grades.hidden" }: { testID?: string }) {
  const t = useT();
  const v = useTheme().v4;
  const toggle = useToggleGrades();
  return (
    <View
      testID={testID}
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: space[3], paddingVertical: space[2] }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexShrink: 1 }}>
        <Icons.EyeOff size={20} color={v.muted} />
        <Text size="bodyMedium" style={{ color: v.muted, flexShrink: 1 }}>
          {t("mobile.hideGrades.hidden")}
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={toggle} label={t("mobile.hideGrades.show")} testID={`${testID}.show`}>
        {t("planner.hiddenShow")}
      </Button>
    </View>
  );
}
