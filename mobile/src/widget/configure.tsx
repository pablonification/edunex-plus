// "Satu mata kuliah"'s question (app.config.ts's widgetFeatures): which course the widget shows. Android opens it from
// the widget's own menu ("Ubah widget"), and as the widget is placed on Android 11 and older. The term's courses from what
// the app saved, each in its colour; a tap draws the widget on that course and closes. Back leaves it as it was.
import { FlatList, Pressable, Text, useColorScheme, View } from "react-native";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import { snapshotTermCourses } from "../../../src/core/home-world";
import { translate } from "../../../src/core/strings";
import { THEMES } from "../ui/theme";
import { chooseCourse, chosenCourse } from "./choice";
import { currentDrawing, drawingOf } from "./draw";
import { toneOf } from "./model";
import { readSaved } from "./saved";

export function CourseChoice({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const saved = readSaved();
  const theme = THEMES[saved?.snapshot.settings.theme === "light" || saved?.snapshot.settings.theme === "dark" ? saved.snapshot.settings.theme : scheme];
  const lang = saved?.snapshot.settings.lang ?? "id";
  const courses = saved ? (snapshotTermCourses(saved.snapshot) ?? []) : [];
  const current = chosenCourse(widgetInfo.widgetId);
  const v = theme.v4;
  const codes = courses.map((course) => course.code);

  const pick = (code: string) => {
    chooseCourse(widgetInfo.widgetId, code);
    try {
      renderWidget(drawingOf(currentDrawing(null), widgetInfo));
    } finally {
      setResult("ok");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: v.page, paddingTop: 48 }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: v.fg, paddingHorizontal: 20, paddingBottom: 12 }}>
        {translate(lang, "mobile.widget.pickCourse")}
      </Text>
      {courses.length ? null : <Text style={{ fontSize: 15, color: v.muted, paddingHorizontal: 20 }}>{translate(lang, "welcome.continueHint")}</Text>}
      <FlatList
        data={courses}
        keyExtractor={(course) => course.code}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const tile = theme.courseTile(saved ? toneOf(saved.snapshot, codes, item.code) : undefined);
          const selected = item.code === current;
          return (
            <Pressable
              onPress={() => pick(item.code)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.name ? `${item.code} ${item.name}` : item.code}
              android_ripple={{ color: v.line }}
              style={{
                minHeight: 56,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: selected ? tile.tint : v.card,
                marginBottom: 6,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tile.ink }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: v.fg }}>{item.code}</Text>
                {item.name ? (
                  <Text numberOfLines={1} style={{ fontSize: 14, color: v.muted }}>
                    {item.name}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
