// Search (the desktop's ⌘K palette, src/app/shell/search.tsx) as a screen with the keyboard up (round 2, v4): Material
// 3's search bar on v4's grey page, the field its one title. Everything the app has saved is searched, so it works
// offline; results come grouped by kind with what's pressing first (src/core/search.ts's index and ranking), each group
// a white card of rows, a course with its tile, anything else with its kind's icon in its course's colour. Before
// anything is typed the page stays empty under the field's own hint; with no match, one line says so.
import { router, useNavigation } from "expo-router";
import { type ComponentRef, type ComponentType, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../../src/app/i18n";
import { useSaved } from "../../src/app/saved";
import { useBridge } from "../../src/app/store";
import { materialKind } from "../../src/core/course-materials";
import { takeHomeOnly } from "../../src/core/exam-sources";
import type { Exam } from "../../src/core/exams";
import type { DatasetName } from "../../src/core/models";
import { SCREENS, type ScreenId, type SearchItem, search, searchIndex } from "../../src/core/search";
import { isOpenStatus, taskStatus } from "../../src/core/tasks";
import { useNav, useParam } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { refreshNow } from "../src/shell/source-status";
import { IconButton } from "../src/ui/controls";
import { CourseIconTile } from "../src/ui/course-icon-tile";
import { Rise } from "../src/ui/expressive";
import { Group, GroupRow, Heading, IconTile } from "../src/ui/group";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel } from "../src/ui/layout";
import { Text, useFieldColors } from "../src/ui/text";
import { shape, space, TOUCH, type, useTheme } from "../src/ui/theme";
import { CourseTile } from "../src/ui/tile";

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

export default function Search() {
  usePerfDrawn(true);
  const fieldColors = useFieldColors();
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const nav = useNav();
  const theme = useTheme();
  const v = theme.v4;
  const insets = useSafeAreaInsets();
  const saved = useSaved(SEARCHED);
  const bridge = useBridge();
  // "Semua layanan" hands over what was typed there when no service matches (`/search?q=…`).
  const [query, setQuery] = useState(useParam("q") ?? "");
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const index = useMemo(() => searchIndex(saved, { lang, screens: BUILT, now }), [saved, lang, now]);
  const typed = query.trim();
  const groups = useMemo(() => (typed ? search(index, typed) : []), [index, typed]);
  const count = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);
  const nextTheme = theme.scheme === "dark" ? "light" : "dark";
  useFocusField(field);

  const open = (item: SearchItem) => {
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
    <View testID="screen.search" style={{ flex: 1, backgroundColor: v.page, paddingTop: insets.top }}>
      {/* Material 3's search bar: Back, the field, and × once something's typed, in one white pill on the grey. */}
      <View style={styles.bar}>
        <View style={[styles.field, { backgroundColor: v.card }]}>
          <IconButton label={t("action.back")} onPress={() => router.back()} testID="action.back">
            <Icons.ArrowLeft size={24} color={v.fg} />
          </IconButton>
          <TextInput
            {...fieldColors}
            ref={field}
            testID="search.input"
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={t("mobile.search.placeholder")}
            placeholderTextColor={v.muted}
            accessibilityLabel={t("search.open")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              const first = groups[0]?.items[0];
              if (first) open(first);
            }}
            style={{ flex: 1, color: v.fg, ...type.bodyLarge, paddingVertical: 0, minHeight: TOUCH }}
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
              <Icons.X size={22} color={v.muted} />
            </IconButton>
          )}
        </View>
      </View>
      {typed !== "" && count > 0 && (
        <Text
          size="bodySmall"
          tabular
          style={{ color: v.muted, paddingHorizontal: space.page + space[1], paddingTop: space[1] }}
          accessibilityLiveRegion="polite"
          testID="search.count"
        >
          {t("search.count", { count })}
        </Text>
      )}
      <FlatList
        data={groups}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(group) => group.kind}
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[6] + insets.bottom }}
        ListEmptyComponent={
          typed ? (
            <Text
              size="bodyLarge"
              accessibilityLiveRegion="polite"
              style={{ color: v.muted, textAlign: "center", paddingTop: space[10], paddingHorizontal: space[4] }}
            >
              {t("search.noResults", { query: typed })}
            </Text>
          ) : undefined
        }
        renderItem={({ item: group, index: at }) => (
          <Rise screen="search" index={at}>
            <Heading first={at === 0}>{t(`search.group.${group.kind}`)}</Heading>
            <Group>
              {group.items.map((item, i) => {
                const detail =
                  item.kind === "action" && item.action === "theme"
                    ? t("search.action.themeTo", { theme: t(`settings.theme.${nextTheme}`) })
                    : detailOf(item, t, f, now);
                return (
                  <GroupRow
                    key={item.key}
                    testID={`row.search.${item.key}`}
                    first={i === 0}
                    leading={<ResultTile item={item} />}
                    title={
                      <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
                        {item.title}
                      </Text>
                    }
                    meta={
                      detail ? (
                        <Text size="bodyMedium" tabular numberOfLines={2} style={{ color: v.muted }}>
                          {detail}
                        </Text>
                      ) : undefined
                    }
                    onPress={() => open(item)}
                  />
                );
              })}
            </Group>
          </Rise>
        )}
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

/** A result's leading tile: a course's own tile; else its kind's icon, on its course's tint when it has a course. */
function ResultTile({ item }: { item: SearchItem }) {
  if (item.kind === "course" && item.code) return <CourseTile code={item.code} name={item.title} />;
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
  const glyph = (color: string) => <Icon size={22} color={color} />;
  if (item.code) return <CourseIconTile code={item.code} icon={glyph} />;
  return <IconTile tone={item.kind === "action" ? "plain" : "brand"} icon={glyph} />;
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
});
