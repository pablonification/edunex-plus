// Search (the desktop's ⌘K palette, src/app/shell/search.tsx) as a screen with the keyboard up, in direction B's frame:
// the white page, the field its one title. Before anything is typed it isn't blank: what was opened lately as chips,
// then the next Tasks, the courses and the services, each one tap. Typed, everything the app has saved is searched
// (src/core/search.ts's index and ranking, so it works offline) and the phone's services (screens/search/services.ts);
// results come grouped by kind, flat rows with the kind's glyph in the course's colour and the typed part marked. With
// no match, a few words say so and what's close is offered. Typing is debounced so the keyboard never waits.
import { router, useNavigation } from "expo-router";
import { type ComponentRef, type ComponentType, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { KindMark, Marked, RecentChip, ResultRow, SectionHeading, ServiceMark } from "../src/screens/search/parts";
import { matchServices, SEARCH_SERVICES } from "../src/screens/search/services";
import type { Service } from "../src/screens/services/list";
import { useOpenService } from "../src/screens/services/open";
import { refreshNow } from "../src/shell/source-status";
import { useB } from "../src/ui/b";
import { IconButton } from "../src/ui/controls";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel } from "../src/ui/layout";
import { CrossFade } from "../src/ui/moves";
import { Text, useFieldColors } from "../src/ui/text";
import { shape, space, TOUCH, type } from "../src/ui/theme";

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

/** What the Student opened from here lately, newest first: kept while the app runs (the phone has no small store for it). */
let recentKeys: string[] = [];
function remember(key: string): void {
  if (key.startsWith("action:")) return;
  recentKeys = [key, ...recentKeys.filter((k) => k !== key)].slice(0, 6);
}

/** How long typing rests before the index is asked: the keyboard never waits on a search. */
const DEBOUNCE_MS = 120;

/** The kind's glyph, as a bare mark. */
function kindIcon(item: SearchItem): ComponentType<IconProps> {
  switch (item.kind) {
    case "course":
      return Icons.GraduationCap;
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
  | { kind: "item"; key: string; item: SearchItem; last: boolean }
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
  const before = useMemo(() => suggestions(index, now, recentKeys), [index, now]);
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
    const addGroup = (group: SearchGroup, max: number) => {
      const items = group.items.slice(0, max);
      if (items.length === 0) return;
      heading(group.kind, t(`search.group.${group.kind}`));
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
        else if (group.kind === "task") addGroup(group, 3);
        else if (group.kind === "course") addGroup(group, 8);
      }
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[2] }}>
                {line.items.map((item) => (
                  <RecentChip key={item.key} label={item.title} onPress={() => open(item)} testID={`row.recent.${item.key}`} />
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
              title={<Marked text={name} query={typed} />}
              onPress={() => openTheService(line.service)}
            />
          );
        }
        case "item": {
          const item = line.item;
          const detail = item.kind === "action" ? undefined : detailOf(item, t, f, now);
          return (
            <ResultRow
              testID={`row.search.${item.key}`}
              label={detail ? `${item.title}, ${detail}` : item.title}
              last={line.last}
              leading={<KindMark icon={kindIcon(item)} code={item.code} />}
              title={<Marked text={item.title} query={typed} />}
              meta={detail || undefined}
              onPress={() => open(item)}
            />
          );
        }
      }
    },
    [b.fg, b.muted, t, f, now, typed, open, openTheService],
  );

  return (
    <View testID="screen.search" style={{ flex: 1, backgroundColor: b.page, paddingTop: insets.top }}>
      {/* The field is the page's title: Back, the field, and × once something's typed, in one soft pill on the white. */}
      <View style={styles.bar}>
        <View style={[styles.field, { backgroundColor: b.soft }]}>
          <IconButton label={t("action.back")} onPress={() => router.back()} testID="action.back">
            <Icons.ArrowLeft size={24} color={b.fg} />
          </IconButton>
          <TextInput
            {...fieldColors}
            ref={field}
            testID="search.input"
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={t("mobile.search.placeholder")}
            placeholderTextColor={b.muted}
            accessibilityLabel={t("search.open")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              const first = lines.find((line) => line.kind === "item" || line.kind === "service");
              if (first?.kind === "item") open(first.item);
              else if (first?.kind === "service") openTheService(first.service);
            }}
            style={{ flex: 1, color: b.fg, ...type.bodyLarge, paddingVertical: 0, minHeight: TOUCH }}
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
  // A full pill, 56 high.
  field: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 56, borderRadius: shape.full, paddingHorizontal: space[1] },
});
