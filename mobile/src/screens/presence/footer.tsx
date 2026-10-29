// Said once, under Presensi's groups (src/app/screens/presence.tsx's Footer and HowCounted): how
// attendance is recorded, that later classes are estimated and up to when, and "Cara menghitungnya"
// folded away, with SIX's timetable a press from it.
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import type { Attendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { sixTimetableUrl } from "../../../../src/core/links";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { dayLabel, footerDates, noonOf } from "./logic";

export function Footer({ attendance }: { attendance: Attendance }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const muted = theme.color.muted;
  return (
    <View style={{ marginTop: space[8], gap: space[1.5] }}>
      <Said icon={<Icons.Hand size={14} color={muted} />}>{t("presence.footer")}</Said>
      <Said icon={<Icons.Calendar size={14} color={muted} />}>{footerDates(t, f, attendance)}</Said>
    </View>
  );
}

function Said({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 3 }}>{icon}</View>
      <Text size="small" tone="muted" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

export function HowCounted({ lastDay }: { lastDay: string | null }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const [shown, setShown] = useState(false);
  const date = lastDay ? dayLabel(f, noonOf(lastDay)) : "-";
  const points = [
    t("presence.how.six"),
    t("presence.how.left", { date }),
    t("presence.how.uncertain"),
    t("presence.how.edunex"),
    t("presence.how.target"),
    t("presence.how.check"),
  ];
  return (
    <View style={{ marginTop: space[6] }}>
      <Pressable
        onPress={() => setShown(!shown)}
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        testID="action.howCounted"
        style={{ flexDirection: "row", alignItems: "center", gap: space[1.5], minHeight: 44, alignSelf: "flex-start" }}
      >
        <View style={{ transform: [{ rotate: shown ? "90deg" : "0deg" }] }}>
          <Icons.ChevronRight size={14} color={theme.color.muted} />
        </View>
        <Text size="small" weight="medium" tone="muted">
          {t("presence.how")}
        </Text>
      </Pressable>
      {shown && (
        <View style={{ paddingLeft: space[5], marginTop: space[1], gap: space[1] }}>
          {points.map((point) => (
            <View key={point} style={{ flexDirection: "row", gap: space[2] }}>
              <Text size="small" tone="muted">
                {"•"}
              </Text>
              <Text size="small" tone="muted" style={{ flex: 1, lineHeight: 22 }}>
                {point}
              </Text>
            </View>
          ))}
          {student && (
            <Button
              size="sm"
              icon={<Icons.ArrowUpRight size={14} />}
              onPress={() => open(sixTimetableUrl(student))}
              style={{ alignSelf: "flex-start", marginTop: space[2] }}
              testID="action.openSix"
            >
              {t("presence.openSix")}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
