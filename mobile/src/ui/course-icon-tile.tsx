// A thing's kind as an icon on its course's colour (round 2, v4): IconTile's shape (group.tsx) in the course's tint, the
// icon in its ink (theme.courseTile, ≥ 4.6:1 on its tint), for a row that belongs to a course but isn't the course
// itself: a Task, a material, an announcement, a notification. The course itself takes its CourseTile (tile.tsx).
import type { ReactNode } from "react";
import { View } from "react-native";
import { useCourseTile } from "./tile";

export function CourseIconTile({ code, icon, size = 44 }: { code: string; icon: (color: string) => ReactNode; size?: number }) {
  // Bare: the kind's icon in the course's ink, no tinted box behind it.
  const { ink } = useCourseTile()(code);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {icon(ink)}
    </View>
  );
}
