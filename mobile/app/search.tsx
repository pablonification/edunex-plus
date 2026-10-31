// Search (the desktop's ⌘K palette, src/app/shell/search.tsx) as a screen with the keyboard up:
// everything the app has saved, so it works offline, grouped by kind with what's pressing first,
// each with its course's color. With nothing typed: what was opened lately, the next Tasks, the
// courses, the places and the verbs (refresh, theme). The index is src/core/search.ts's.
import { File, Paths } from "expo-file-system";
import { router, useNavigation } from "expo-router";
import { type ComponentRef, type ComponentType, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCourseColor, useTermCourses } from "../../src/app/courses";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../../src/app/i18n";
import { useSaved } from "../../src/app/saved";
import { useBridge } from "../../src/app/store";
import { materialKind } from "../../src/core/course-materials";
import { takeHomeOnly } from "../../src/core/exam-sources";
import type { Exam } from "../../src/core/exams";
import type { DatasetName } from "../../src/core/models";
import { SCREENS, type ScreenId, type SearchItem, search, searchIndex, suggestions } from "../../src/core/search";
import { isOpenStatus, taskStatus } from "../../src/core/tasks";
import { useNav } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { refreshNow } from "../src/shell/source-status";
import { IconButton } from "../src/ui/controls";
import { CourseDot, EmptyState } from "../src/ui/display";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel, Meta } from "../src/ui/layout";
import { Text, useFieldColors } from "../src/ui/text";
import { shape, space, TOUCH, type, useTheme } from "../src/ui/theme";

/** Every screen and Rencana studi tab is built on the phone. */
const BUILT = Object.keys(SCREENS) as ScreenId[];

/** What the index reads: the desktop's list. */
const SEARCHED: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  "six.skipped",
  "six.schedule",
  "edunex.courses",
  "edunex.tasks",
  "edunex.exams",
  "edunex.outline",
  "edunex.materials",
  "edunex.announcements",
  "itb.catalog",
  "itb.calendar",
];

const SCREEN_ICON: Record<ScreenId, ComponentType<IconProps>> = {
  home: Icons.Home,
  tasks: Icons.ListChecks,
  schedule: Icons.Calendar,
  presence: Icons.Hand,
  grades: Icons.GraduationCap,
  plan: Icons.BookOpen,
  "plan.planner": Icons.Route,
  "plan.curriculum": Icons.Layers,
  "plan.krs": Icons.ClipboardCheck,
  "plan.bills": Icons.Wallet,
  "plan.deadlines": Icons.CalendarClock,
  settings: Icons.Settings,
};

const MATERIAL_ICON: Partial<Record<ReturnType<typeof materialKind>, ComponentType<IconProps>>> = {
  vicon: Icons.Video,
  video: Icons.Video,
  note: Icons.StickyNote,
  link: Icons.Link,
};

// What the Student opened from search lately, newest first: kept on this phone only, in the app's own files.
const recentFile = () => new File(Paths.document, "engine", "search-recent.json");
function readRecent(): string[] {
  try {
    const file = recentFile();
    const saved: unknown = file.exists ? JSON.parse(file.textSync()) : [];
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}
function remember(key: string): void {
  if (key.startsWith("action:")) return;
  try {
    recentFile().writeSync(JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 8)));
  } catch {
    // Not kept: search still works.
  }
}

export default function Search() {
  usePerfDrawn(true);
  const fieldColors = useFieldColors();
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const nav = useNav();
  const theme = useTheme();
  const c = theme.color;
  const insets = useSafeAreaInsets();
  const saved = useSaved(SEARCHED);
  const bridge = useBridge();
  const colorOf = useCourseColor();
  const courses = useTermCourses();
  const [query, setQuery] = useState("");
  const [recent] = useState(readRecent);
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const index = useMemo(() => searchIndex(saved, { lang, screens: BUILT, now }), [saved, lang, now]);
  const groups = useMemo(() => (query.trim() ? search(index, query) : suggestions(index, now, recent)), [index, query, now, recent]);
  const nextTheme = theme.scheme === "dark" ? "light" : "dark";
  useFocusField(field);

  const rows = groups.flatMap((group) => [
    { head: group.kind } as const,
    ...group.items.map((item, i) => ({ item, first: i === 0, last: i === group.items.length - 1 })),
  ]);

  const open = (item: SearchItem) => {
    remember(item.key);
    const target = item.target;
    if (target === "settings") router.replace("/settings");
    else if ("action" in target) {
      router.back();
      if (target.action === "refresh") void refreshNow(bridge);
      else void bridge.invoke("settings.update", { theme: nextTheme }).catch(() => undefined);
    } else {
      router.back();
      nav.go(target);
    }
  };

  return (
    <View testID="screen.search" style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      {/* Material 3's search view: Back, then the field across the bar, in a container of its own. */}
      <View style={styles.bar}>
        <View style={[styles.field, { backgroundColor: c.surfaceContainerHigh }]}>
          <IconButton label={t("action.back")} onPress={() => router.back()} testID="action.back">
            <Icons.ArrowLeft size={24} color={c.onSurface} />
          </IconButton>
          <TextInput
            {...fieldColors}
            ref={field}
            testID="search.input"
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={t("search.placeholder")}
            placeholderTextColor={c.onSurfaceVariant}
            accessibilityLabel={t("search.open")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              const first = groups[0]?.items[0];
              if (first) open(first);
            }}
            style={{ flex: 1, color: c.onSurface, ...type.bodyLarge, paddingVertical: 0, minHeight: TOUCH }}
          />
          {query !== "" && (
            <IconButton
              label={t("mobile.search.clear")}
              onPress={() => {
                setQuery("");
                field.current?.focus();
              }}
              testID="action.clearSearch"
            >
              <Icons.X size={22} color={c.onSurfaceVariant} />
            </IconButton>
          )}
        </View>
      </View>
      {query.trim() !== "" && (
        <Text
          size="bodySmall"
          tone="muted"
          style={{ paddingHorizontal: space.page + space[4], paddingTop: space[1] }}
          accessibilityLiveRegion="polite"
          testID="search.count"
        >
          {t("search.count", { count: groups.reduce((sum, group) => sum + group.items.length, 0) })}
        </Text>
      )}
      <FlatList
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(row) => ("head" in row ? `head:${row.head}` : row.item.key)}
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[6] + insets.bottom }}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon={<Icons.Search size={24} color={c.onSecondaryContainer} />}
              title={t("search.noResults", { query: query.trim() })}
              description={t("search.noResultsHint", { code: courses?.[0]?.code ?? "PL3002" })}
            />
          ) : undefined
        }
        renderItem={({ item: row }) => {
          if ("head" in row)
            return (
              <Text size="titleSmall" tone="primary" accessibilityRole="header" style={styles.head}>
                {t(`search.group.${row.head}`)}
              </Text>
            );
          const item = row.item;
          const detail =
            item.kind === "action" && item.action === "theme"
              ? t("search.action.themeTo", { theme: t(`settings.theme.${nextTheme}`) })
              : detailOf(item, t, f, now);
          return (
            // A group's rows as one list of tonal tiles, round at its ends (List's look, drawn row by row).
            <View
              style={[
                styles.tile,
                { backgroundColor: c.surfaceContainerLow },
                row.first && { borderTopLeftRadius: shape.lgPlus, borderTopRightRadius: shape.lgPlus },
                row.last && { borderBottomLeftRadius: shape.lgPlus, borderBottomRightRadius: shape.lgPlus },
                !row.last && { marginBottom: 2 },
              ]}
            >
              <Pressable
                testID={`row.search.${item.key}`}
                accessibilityRole="button"
                onPress={() => open(item)}
                android_ripple={{ color: c.selected }}
                style={styles.row}
              >
                <ItemMark item={item} color={colorOf(item.code)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="bodyLarge" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {detail !== "" && (
                    <Meta size="small" numberOfLines={1}>
                      {detail}
                    </Meta>
                  )}
                </View>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

/**
 * The keyboard up as the screen opens. `autoFocus` alone is lost when the field mounts while Android's open transition
 * is still running; asking again once the transition has ended (and once more a moment later, for a slow phone) brings
 * it up every time. Asking a field that already has focus does nothing.
 */
function useFocusField(field: RefObject<ComponentRef<typeof TextInput> | null>): void {
  const navigation = useNavigation();
  useEffect(() => {
    const focus = () => {
      if (!field.current?.isFocused()) field.current?.focus();
    };
    const later = setTimeout(focus, 350);
    const ended = navigation.addListener("transitionEnd" as never, (event: { data?: { closing?: boolean } }) => {
      if (!event.data?.closing) focus();
    });
    return () => {
      clearTimeout(later);
      ended();
    };
  }, [navigation, field]);
}

function ItemMark({ item, color }: { item: SearchItem; color: string | undefined }) {
  const theme = useTheme();
  const Icon =
    item.kind === "screen"
      ? SCREEN_ICON[item.screen]
      : item.kind === "material"
        ? (MATERIAL_ICON[materialKind(item.material.type)] ?? Icons.FileText)
        : item.kind === "action"
          ? item.action === "refresh"
            ? Icons.RefreshCw
            : Icons.Moon
          : { course: Icons.BookOpen, task: Icons.ListChecks, exam: Icons.GraduationCap, module: Icons.LayoutGrid, announcement: Icons.Megaphone }[item.kind];
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.secondaryContainer, alignItems: "center", justifyContent: "center" }}>
      <Icon size={20} color={theme.color.onSecondaryContainer} />
      {item.code && (
        <View style={{ position: "absolute", right: 0, bottom: 0 }}>
          <CourseDot color={color} size={10} />
        </View>
      )}
    </View>
  );
}

/** When an exam is, as its row says it (the desktop's examWhen). */
function examWhen(exam: Exam, t: Translate, f: Format): string {
  const session = exam.six[0];
  if (session) return factsLabel(`${f.relativeDay(session.start)}, ${f.timeRange(session.start, session.end)}`, session.room);
  if (exam.at !== null) return f.dueLabel(exam.at);
  if (exam.week) return t("search.examWeek", { kind: t(`exam.kind.${exam.kind}`), range: f.dayRange(exam.week.firstDay, exam.week.lastDay) });
  return t("search.noDate");
}

/** The row's second line: the course's code, then what this result is and when (the desktop's detailOf). */
function detailOf(item: SearchItem, t: Translate, f: Format, now: number): string {
  const parts: (string | null)[] = [item.code];
  switch (item.kind) {
    case "course":
      parts.push(item.classNo && t("search.class", { classNo: item.classNo }), item.sks !== null ? t("search.sks", { sks: item.sks }) : null);
      break;
    case "task": {
      const status = taskStatus(item.task, now);
      parts.push(
        status === "not_started" ? null : t(`taskStatus.${status}`),
        isOpenStatus(status) && item.task.dueAt !== null ? t("search.due", { when: f.dayTimeWord(item.task.dueAt) }) : null,
      );
      break;
    }
    case "exam":
      parts.push(
        takeHomeOnly(item.exam) ? t("task.takeHome", { kind: t(`exam.kind.${item.exam.kind}`) }) : null,
        examWhen(item.exam, t, f),
        item.past ? t("deadlines.past") : null,
      );
      break;
    case "material":
      parts.push(item.jointClass ? t("course.jointClass") : null);
      if (item.module) parts.push(t("course.module", { no: item.module.number }), item.module.title);
      else parts.push(t("course.intro"));
      break;
    case "module":
      parts.push(item.module.parent ? t("course.jointClass") : null, t("course.module", { no: item.module.number }));
      break;
    case "announcement":
      parts.push(item.announcement.postedAt !== null ? f.relativeDay(item.announcement.postedAt) : null);
      break;
    case "screen":
      parts.push(item.within);
      break;
  }
  return factsLabel(...parts);
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.page, paddingTop: space[2], paddingBottom: space[2] },
  // Material 3's search bar: a full pill, 56 high.
  field: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 56, borderRadius: shape.full, paddingHorizontal: space[1] },
  head: { paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: space[2] },
  tile: { borderRadius: shape.xs, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space[4], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 56 },
});
