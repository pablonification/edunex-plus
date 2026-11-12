// Search (the desktop's ⌘K palette, src/app/shell/search.tsx) as a screen with the keyboard up, in direction B's frame:
// the white page, the field its one title. Before anything is typed it isn't blank: what was opened lately as chips,
// then the next Tasks, the courses and the services, each one tap. Typed, everything the app has saved is searched
// (src/core/search.ts's index and ranking, so it works offline) and the phone's services (screens/search/services.ts);
// results come grouped by kind, flat rows led by the course's own glyph (the kind a small mark on it) with the typed
// part marked and a one-line quiet line. Before typing, the order is by what's opened most and what fits over the
// keyboard (about 420 dp under the field): lately opened and the courses as chips, the next Tasks, then the services.
// With no match, a few words say so and what's close is offered. Typing is debounced so the keyboard never waits.
import { router, useNavigation } from "expo-router";
import { type ComponentRef, type ComponentType, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTermCourses } from "../../src/app/courses";
import { type Format, type Translate, useFormat, useLang, useNow, useT } from "../../src/app/i18n";
import { useSaved } from "../../src/app/saved";
import { useBridge } from "../../src/app/store";
import { materialKind } from "../../src/core/course-materials";
import { takeHomeOnly } from "../../src/core/exam-sources";
import type { Exam } from "../../src/core/exams";
import type { DatasetName } from "../../src/core/models";
import { type SearchGroup, type SearchItem, search, searchIndex, suggestions } from "../../src/core/search";
import { isOpenStatus, taskStatus } from "../../src/core/tasks";
import { useNav } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { shortName } from "../src/screens/home/parts";
import { CourseMark, KindMark, Marked, RecentChip, ResultRow, SectionHeading, ServiceMark } from "../src/screens/search/parts";
import { loadRecent, saveRecent } from "../src/screens/search/recent";
import { matchServices, SEARCH_SERVICES } from "../src/screens/search/services";
import type { Service } from "../src/screens/services/list";
import { useOpenService } from "../src/screens/services/open";
import { refreshNow } from "../src/shell/source-status";
import { useB } from "../src/ui/b";
import { IconButton } from "../src/ui/controls";
import { GLASS } from "../src/ui/glass";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel } from "../src/ui/layout";
import { CrossFade } from "../src/ui/moves";
import { fieldType, Text, useFieldColors } from "../src/ui/text";
import { shape, space, TOUCH } from "../src/ui/theme";
import { CourseGlyph } from "../src/ui/tile";
import { BarBack } from "../src/ui/top-bar";

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

const MATERIAL_ICON: Partial<Record<ReturnType<typeof materialKind>, ComponentType<IconProps>>> = {
  vicon: Icons.Video,
  video: Icons.Video,
  note: Icons.StickyNote,
  link: Icons.Link,
};

/** What the Student opened from here lately, newest first: read from the phone once, kept across closing the app. */
let recentKeys: string[] = [];
function remember(key: string): void {
  if (key.startsWith("action:")) return;
  recentKeys = [key, ...recentKeys.filter((k) => k !== key)].slice(0, 6);
  saveRecent(recentKeys);
}

/** How long typing rests before the index is asked: the keyboard never waits on a search. */
const DEBOUNCE_MS = 120;

/** The kind's glyph, as a bare mark. */
function kindIcon(item: SearchItem): ComponentType<IconProps> {
  switch (item.kind) {
    case "task":
      return Icons.ListChecks;
    case "exam":
      return Icons.PenLine;
    case "material":
      return MATERIAL_ICON[materialKind(item.material.type)] ?? Icons.FileText;
    case "module":
      return Icons.Layers;
    case "announcement":
      return Icons.Megaphone;
    case "action":
      return item.action === "refresh" ? Icons.RefreshCw : Icons.Moon;
    default:
      return Icons.ArrowRight;
  }
}

/** A row of the list: a section's name, a recent chips row, a result, a service, or the no-result line. */
type Line =
  | { kind: "heading"; key: string; title: string; first: boolean }
  | { kind: "recent"; key: string; items: SearchItem[] }
  | { kind: "courses"; key: string; items: SearchItem[]; first: boolean }
  // `quiet`: its course is a chip on this page (glyph and name), so the row keeps to the glyph: the name once a screen.
  | { kind: "item"; key: string; item: SearchItem; last: boolean; quiet?: boolean }
  | { kind: "service"; key: string; service: Service; last: boolean }
  | { kind: "none"; key: string; query: string };

export default function Search() {
  usePerfDrawn(true);
  const fieldColors = useFieldColors();
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const nav = useNav();
  const b = useB();
  const insets = useSafeAreaInsets();
  const saved = useSaved(SEARCHED);
  const bridge = useBridge();
  const openService = useOpenService();
  const courses = useTermCourses();
  // A course by its code: its full name picks its glyph, its short one names it on a Task's row.
  const courseOf = useCallback((code: string | null) => (code ? courses?.find((one) => one.code === code) : undefined), [courses]);
  // The recent searches, read from the phone once the screen is up (nothing at start-up).
  const [recent, setRecent] = useState(recentKeys);
  useEffect(() => {
    let live = true;
    void loadRecent().then((keys) => {
      if (live && keys) {
        recentKeys = keys;
        setRecent(keys);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const index = useMemo(() => searchIndex(saved, { lang, screens: [], now }), [saved, lang, now]);
  // The field shows each letter at once; the search runs once typing rests.
  useEffect(() => {
    const value = query.trim();
    if (value === "") {
      setTyped("");
      return;
    }
    const later = setTimeout(() => setTyped(value), DEBOUNCE_MS);
    return () => clearTimeout(later);
  }, [query]);
  const groups = useMemo(() => (typed ? search(index, typed) : []), [index, typed]);
  const services = useMemo(() => (typed ? matchServices(typed) : []), [typed]);
  const before = useMemo(() => suggestions(index, now, recent), [index, now, recent]);
  const nextTheme = b.dark ? "light" : "dark";
  useFocusField(field);

  const open = useCallback(
    (item: SearchItem) => {
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
    },
    [bridge, nav, nextTheme],
  );
  const openTheService = useCallback(
    (service: Service) => {
      router.back();
      openService(service);
    },
    [openService],
  );

  const lines = useMemo(() => {
    const out: Line[] = [];
    const heading = (key: string, title: string) => {
      out.push({ kind: "heading", key: `h:${key}`, title, first: out.length === 0 });
    };
    const addGroup = (group: SearchGroup, max: number, title = t(`search.group.${group.kind}`)) => {
      const items = group.items.slice(0, max);
      if (items.length === 0) return;
      heading(group.kind, title);
      items.forEach((item, i) => {
        out.push({ kind: "item", key: item.key, item, last: i === items.length - 1 });
      });
    };
    const addServices = (list: readonly Service[]) => {
      if (list.length === 0) return;
      heading("services", t("mobile.search.group.services"));
      list.forEach((service, i) => {
        out.push({ kind: "service", key: `service:${service.id}`, service, last: i === list.length - 1 });
      });
    };
    // What's close when nothing matches, or the page before typing: the next Tasks, the courses, the services.
    const offer = () => {
      for (const group of before) {
        if (group.kind === "recent" && !typed) out.push({ kind: "recent", key: "recent", items: group.items });
      }
      // The courses next, as one row of chips (what a search is most often for), so the next Tasks still sit over the
      // keyboard under them.
      const mine = before.find((group) => group.kind === "course");
      if (mine?.items.length) out.push({ kind: "courses", key: "courses", items: mine.items.slice(0, 8), first: out.length === 0 });
      // The next three due, and its heading says just that (the Tugas tab has all of them).
      const due = before.find((group) => group.kind === "task");
      if (due) addGroup(due, 3, t("mobile.search.group.nextDue"));
      addServices(SEARCH_SERVICES.slice(0, 6));
    };
    if (!typed) offer();
    else if (groups.length === 0 && services.length === 0) {
      out.push({ kind: "none", key: "none", query: typed });
      offer();
    } else {
      // The kinds a Student opens most, in the desktop's order of their best match; services after the courses.
      let placed = false;
      for (const group of groups) {
        if (group.kind === "action") continue;
        addGroup(group, 6);
        if (!placed && group.kind === "course") {
          addServices(services);
          placed = true;
        }
      }
      if (!placed) addServices(services);
    }
    const chips = out.find((line) => line.kind === "courses");
    if (chips?.kind === "courses") {
      const shown = new Set(chips.items.map((item) => item.code));
      for (const line of out) if (line.kind === "item" && line.item.code && shown.has(line.item.code)) line.quiet = true;
    }
    return out;
  }, [typed, groups, services, before, t]);

  const renderLine = useCallback(
    ({ item: line }: { item: Line }) => {
      switch (line.kind) {
        case "heading":
          return <SectionHeading first={line.first}>{line.title}</SectionHeading>;
        case "recent":
          return (
            <View>
              <SectionHeading first>{t("search.group.recent")}</SectionHeading>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.chips}
                contentContainerStyle={styles.chipsInner}
              >
                {line.items.map((item) => (
                  <RecentChip key={item.key} label={item.title} onPress={() => open(item)} testID={`row.recent.${item.key}`} />
                ))}
              </ScrollView>
            </View>
          );
        case "courses":
          return (
            <View>
              <SectionHeading first={line.first}>{t("search.group.course")}</SectionHeading>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.chips}
                contentContainerStyle={styles.chipsInner}
              >
                {line.items.map((item) => (
                  <RecentChip
                    key={item.key}
                    label={shortName(item.title)}
                    leading={<CourseGlyph code={item.code ?? ""} name={item.title} size={20} />}
                    onPress={() => open(item)}
                    testID={`row.search.${item.key}`}
                  />
                ))}
              </ScrollView>
            </View>
          );
        case "none":
          return (
            <View style={{ paddingTop: space[6], paddingBottom: space[2] }} accessibilityLiveRegion="polite" testID="search.none">
              <Text size="titleMedium" face="display" weight="semibold" style={{ color: b.fg }}>
                {t("search.noResults", { query: line.query })}
              </Text>
              <Text size="bodyMedium" style={{ color: b.muted, paddingTop: space[1] }}>
                {t("mobile.search.close")}
              </Text>
            </View>
          );
        case "service": {
          const name = t(line.service.label);
          return (
            <ResultRow
              testID={`row.search.service:${line.service.id}`}
              label={name}
              last={line.last}
              leading={<ServiceMark service={line.service} />}
              chevron
              title={<Marked text={name} query={typed} />}
              onPress={() => openTheService(line.service)}
            />
          );
        }
        case "item": {
          const item = line.item;
          const course = courseOf(item.code);
          // A Task, an exam, material: its course by name, in the course's colour, before what differs (the date).
          const named = item.kind !== "course" && item.code ? (course ? shortName(course.name) : item.code) : null;
          const detail = item.kind === "action" ? undefined : detailOf(item, t, f, now) || undefined;
          return (
            <ResultRow
              testID={`row.search.${item.key}`}
              label={factsLabel(item.title, named, detail)}
              last={line.last}
              // The course's own glyph leads, alone; what the thing is sits small before the quiet line. With no course, the kind leads.
              leading={
                item.kind === "course" ? (
                  <CourseMark code={item.code ?? ""} name={item.title} />
                ) : item.code ? (
                  <CourseMark code={item.code} name={course?.name} />
                ) : (
                  <KindMark icon={kindIcon(item)} code={null} />
                )
              }
              title={<Marked text={item.title} query={typed} />}
              course={named && item.code && !line.quiet ? { code: item.code, name: named } : undefined}
              kind={item.kind !== "course" && item.code ? kindIcon(item) : undefined}
              meta={detail}
              metaWhole={item.kind === "task" || item.kind === "exam" || item.kind === "announcement"}
              chevron
              onPress={() => open(item)}
            />
          );
        }
      }
    },
    [b.fg, b.muted, t, f, now, typed, open, openTheService, courseOf],
  );

  return (
    <View testID="screen.search" style={{ flex: 1, backgroundColor: b.page, paddingTop: insets.top }}>
      {/* The field is the page's title: Back, the field, and × once something's typed, in one soft pill on the white. */}
      {/* On iOS 26 Back is the glass circle every pushed screen has, so it stands before the pill, not in it. */}
      <View style={[styles.bar, GLASS && styles.glassBar]}>
        {GLASS && <BarBack onPress={() => router.back()} color={b.fg} />}
        <View style={[styles.field, GLASS && styles.glassField, { backgroundColor: b.soft }]}>
          {!GLASS && <BarBack onPress={() => router.back()} color={b.fg} />}
          {/* The hint is ours, a step right of where the caret stands: Android's own sits under the caret's first letter. */}
          {query === "" && (
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.hint, GLASS && styles.glassHint]}
            >
              <Text size="bodyLarge" numberOfLines={1} style={{ color: b.muted }}>
                {t("mobile.search.placeholder")}
              </Text>
            </View>
          )}
          <TextInput
            {...fieldColors}
            ref={field}
            testID="search.input"
            value={query}
            onChangeText={setQuery}
            autoFocus
            accessibilityLabel={t("search.open")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              const first = lines.find((line) => line.kind === "item" || line.kind === "service");
              if (first?.kind === "item") open(first.item);
              else if (first?.kind === "service") openTheService(first.service);
            }}
            style={{ flex: 1, color: b.fg, ...fieldType("bodyLarge"), paddingVertical: 0, paddingHorizontal: 0, minHeight: TOUCH }}
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
              <Icons.X size={22} color={b.muted} />
            </IconButton>
          )}
        </View>
      </View>
      {/* Results cross-fade as the typed words change; with Remove animations they change in place. */}
      <CrossFade id={typed === "" ? "before" : groups.length + services.length === 0 ? "none" : "found"} style={{ flex: 1 }}>
        <FlatList
          data={lines}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(line) => line.key}
          renderItem={renderLine}
          initialNumToRender={14}
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[6] + insets.bottom }}
        />
      </CrossFade>
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

/** When an exam is, as its row says it (the desktop's examWhen). */
function examWhen(exam: Exam, t: Translate, f: Format): string {
  const session = exam.six[0];
  // The room is on the exam's own page: here the line is one line, the day and the hours.
  if (session) return `${f.relativeDay(session.start)}, ${f.timeRange(session.start, session.end)}`;
  if (exam.at !== null) return f.dueLabel(exam.at);
  if (exam.week) return t("search.examWeek", { kind: t(`exam.kind.${exam.kind}`), range: f.dayRange(exam.week.firstDay, exam.week.lastDay) });
  return t("search.noDate");
}

/**
 * A Task's day on its row: the hour is left out when it's the end of the day, Edunex's default ("Kam, 15 Okt", not
 * "Kam, 15 Okt, 23:59"), and kept beside the day when the lecturer set one.
 */
function dueDay(dueAt: number, f: Format): string {
  return f.dayTimeWord(dueAt).replace(/, 23[.:]59$/, "");
}

/**
 * The row's quiet line: only what differs from row to row (the heading says what the rows are, the course is named
 * beside it): a course's code and class, a Task's date, an exam's sitting, a material's module.
 */
function detailOf(item: SearchItem, t: Translate, f: Format, now: number): string {
  const parts: (string | null)[] = [];
  switch (item.kind) {
    case "course":
      parts.push(item.code, item.classNo && t("search.class", { classNo: item.classNo }), item.sks !== null ? t("search.sks", { sks: item.sks }) : null);
      break;
    case "task": {
      const status = taskStatus(item.task, now);
      parts.push(isOpenStatus(status) && item.task.dueAt !== null ? dueDay(item.task.dueAt, f) : status === "not_started" ? null : t(`taskStatus.${status}`));
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
  // A full pill, 56 high.
  field: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 56, borderRadius: shape.full, paddingHorizontal: space[1] },
  // Over the field's text box (after Back, 48 wide, and the gap), 6 dp right of the caret; it ends before the pill's curve.
  hint: { position: "absolute", left: space[1] + TOUCH + space[1] + 6, right: space[5], top: 0, bottom: 0, justifyContent: "center" },
  // iOS 26: Back on its glass circle where every bar has it (4 from the edge), then the pill with the field alone in it.
  glassBar: { flexDirection: "row", alignItems: "center", gap: space[2], paddingLeft: space[1] },
  glassField: { flex: 1, paddingLeft: space[4] },
  glassHint: { left: space[4] + 6 },
  // The chips run to the screen's edges, so the one cut at the right is cut by the screen: more that way.
  chips: { marginHorizontal: -space.page },
  chipsInner: { gap: space[2], paddingHorizontal: space.page },
});
