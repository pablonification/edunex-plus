// Materi (/material), behind Beranda's "Materi" tile: what the lecturers posted across this term's courses, newest
// first, in weeks ("Minggu ini", "Minggu lalu", then "Sebelumnya" folded), each week by course. A feed of things to
// open: an item is its kind as a glyph in its course's colour, its name as the lecturer wrote it, and when it was
// posted. One tap opens it the way its module's screen does (a file in the phone's own app, a link where a lecturer's
// link opens, a note or a picture on its module's screen); a course's name over its items is the way to the course.
// The same data and rules as a course's Modul tab (./feed.ts). No new request: it reads what the app already holds.
import { FlashList } from "@shopify/flash-list";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View } from "react-native";
import { useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { edunexMaterialUrl, type MaterialKind, materialAction, materialKind } from "../../../../src/core/course-materials";
import type { Material } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { FileProblemNote, useEdunexFile } from "../../parts/files";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh, useSignIn } from "../../shell/source-status";
import { BRow, useB } from "../../ui/b";
import { Button } from "../../ui/controls";
import { CourseDot, EmptyState, Skeleton } from "../../ui/display";
import { type IconName, Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel } from "../../ui/layout";
import { Arrive, Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { dayAndTime } from "../course/contents";
import { type FeedItem, type FeedLine, feedLines, feedLineType, materialFeed } from "./feed";
import { FoldHeading } from "./fold";

/** A kind's glyph, the one family's (ui/icons.tsx). A PDF and slides share the document until the family has theirs. */
const KIND_ICON: Record<MaterialKind, IconName> = {
  pdf: "FileText",
  file: "FileText",
  vicon: "Video",
  video: "Video",
  audio: "Speaker",
  note: "StickyNote",
  link: "Link",
  page: "Globe",
  image: "Image",
  interactive: "Layers",
  other: "FileText",
};

/** Where a row's text starts: the glyph's column and the gap after it (BRow's). */
const TEXT_INSET = 28 + space[4];

const WEEK_TITLE = { thisWeek: "course.thisWeek", lastWeek: "mobile.material.lastWeek", earlier: "mobile.material.earlier" } as const;

export function MaterialScreen() {
  const t = useT();
  const b = useB();
  const theme = useTheme();
  const now = useNow();
  const bottom = useBottomInset();
  const pull = usePullToRefresh();
  const courses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const materials = useDataset("edunex.materials");
  const tasks = useDataset("edunex.tasks");
  const edunex = useStatus("edunex").state;
  const [earlierOpen, setEarlierOpen] = useState(false);
  const sections = useMemo(() => {
    if (!courses || !materials) return null;
    const all = Array.isArray(tasks) ? tasks : [];
    return materialFeed(
      courses.map((course) => ({
        course,
        outline: outline?.[course.code],
        materials: materials[course.code],
        tasks: all.filter((task) => task.courseCode === course.code),
      })),
      t,
      now,
    );
  }, [courses, outline, materials, tasks, t, now]);
  const lines = useMemo(() => (sections ? feedLines(sections, earlierOpen) : []), [sections, earlierOpen]);
  usePerfDrawn(sections !== null);
  const toggle = useCallback(() => setEarlierOpen((open) => !open), []);
  const renderItem = useCallback(({ item: line, index }: { item: FeedLine; index: number }) => <Line line={line} index={index} onFold={toggle} />, [toggle]);
  const loading = sections === null && (edunex === "connecting" || edunex === "live");
  return (
    <View testID="screen.material" style={{ flex: 1, backgroundColor: b.page }}>
      {/* The bar in the page's own colour in both themes (v4's page is the dark page; the light one is the surface). */}
      <TopBar v4={b.dark} title={t("mobile.material.title")} />
      <FlashList
        data={lines}
        keyExtractor={(line) => line.key}
        getItemType={feedLineType}
        renderItem={renderItem}
        ListHeaderComponent={<ProblemBanner belowBar />}
        ListEmptyComponent={loading ? <Loading /> : <Nothing signedOut={edunex === "signed-out"} />}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] + bottom }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            colors={[theme.color.primary]}
            progressBackgroundColor={theme.color.surfaceContainerHigh}
          />
        }
      />
    </View>
  );
}

/** One line of the feed; the first few arrive once, the first time Materi shows (and "Sebelumnya"'s, when it opens). */
const Line = memo(function Line({ line, index, onFold }: { line: FeedLine; index: number; onFold: () => void }) {
  const t = useT();
  if (line.type === "week")
    return (
      <FoldHeading
        title={t(WEEK_TITLE[line.week])}
        count={line.count}
        countLabel={t("mobile.material.count", { count: line.count })}
        first={line.first}
        fold={line.fold}
        onFold={onFold}
        testID="action.material.earlier"
      />
    );
  const list = line.key.startsWith("earlier") || line.key.startsWith("course:earlier") ? "material.earlier" : "material";
  return (
    <Arrive list={list} index={index}>
      {line.type === "course" ? <CourseName code={line.code} name={line.name} /> : <Item key={line.item.key} item={line.item} last={line.last} />}
    </Arrive>
  );
});

/** The course a week's items are from, in its colour: one target, to the course's own page (on Modul). */
function CourseName({ code, name }: { code: string; name: string }) {
  const t = useT();
  const b = useB();
  const { go } = useNav();
  const color = useCourseColor();
  return (
    <Tap
      feel="row"
      onPress={() => go({ screen: "course", code, tab: "modules" })}
      testID={`action.course.${code}`}
      accessibilityLabel={t("mobile.material.openCourse", { course: name })}
      style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, marginTop: space[2] }}
    >
      <View style={{ width: 28, alignItems: "center" }}>
        <CourseDot color={color(code)} size={12} />
      </View>
      <Text size="bodyMedium" weight="semibold" numberOfLines={2} style={{ flex: 1, color: b.fg2 }}>
        {name}
      </Text>
      <Icons.ChevronRight size={16} color={b.muted} />
    </Tap>
  );
}

function Glyph({ name, code }: { name: IconName; code: string }) {
  const theme = useTheme();
  const tone = useCourseColor()(code);
  const Icon = Icons[name];
  return (
    <View style={{ width: 28, alignItems: "center" }}>
      <Icon size={24} color={tone ? theme.courseTile(tone).ink : theme.v4.fg2} />
    </View>
  );
}

/** One thing to open. A file keeps its own state (downloading, here, what went wrong), so it's a part of its own. */
function Item({ item, last }: { item: FeedItem; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const { go } = useNav();
  const openExternal = useOpenExternal();
  const openLink = useOpenLink();
  const when = item.at !== null ? dayAndTime(f, item.at) : undefined;
  const testID = `row.material.${item.material?.id ?? `module-${item.module}`}`;
  const toModule = () => go({ screen: "course", code: item.code, module: item.module });
  const { material } = item;
  if (!material)
    return (
      <BRow
        testID={testID}
        last={last}
        leading={<Glyph name="BookOpen" code={item.code} />}
        title={item.title}
        meta={when}
        onPress={toModule}
        accessibilityLabel={factsLabel(item.title, when)}
      />
    );
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const glyph = <Glyph name={KIND_ICON[kind]} code={item.code} />;
  const label = factsLabel(material.title, t(`material.${kind}`), when);
  if (action.kind === "download")
    return <FileItem material={material} file={{ url: action.url, name: action.name }} last={last} glyph={glyph} when={when} label={label} testID={testID} />;
  // A note or a picture is read in full on its module's screen; a link opens as a lecturer's link does; a class is
  // joined; anything else opens on Edunex. The arrow says the row leaves the app.
  const leaves = action.kind !== "note" && action.kind !== "image";
  const open = () => {
    if (action.kind === "note" || action.kind === "image") toModule();
    else if (action.kind === "open") openLink(action.url);
    else openExternal(action.url || edunexMaterialUrl(material));
  };
  return (
    <BRow
      testID={testID}
      last={last}
      leading={glyph}
      title={material.title}
      meta={when}
      trailing={leaves ? <Icons.ArrowUpRight size={20} color={b.muted} /> : undefined}
      onPress={open}
      accessibilityLabel={label}
    />
  );
}

function FileItem({
  material,
  file,
  last,
  glyph,
  when,
  label,
  testID,
}: {
  material: Material;
  file: { url: string; name: string };
  last: boolean;
  glyph: ReactNode;
  when: string | undefined;
  label: string;
  testID: string;
}) {
  const b = useB();
  const edunexUrl = edunexMaterialUrl(material);
  const { here, busy, open, share, problem } = useEdunexFile(file, edunexUrl, { inline: true });
  return (
    <View>
      <BRow
        testID={testID}
        // The problem's note sits under the row, so the hairline goes under the note instead.
        last={last || problem !== null}
        leading={glyph}
        title={material.title}
        meta={when}
        trailing={busy ? <ActivityIndicator size="small" color={b.muted} /> : here ? undefined : <Icons.Download size={20} color={b.muted} />}
        onPress={() => void open()}
        accessibilityLabel={label}
        accessibilityState={{ busy }}
      />
      {problem && (
        <FileProblemNote
          problem={problem}
          name={file.name}
          edunexUrl={edunexUrl}
          onRetry={() => void open()}
          onShare={share}
          testID={`${testID}.problem`}
          style={[{ marginLeft: TEXT_INSET, paddingBottom: space[3] }, !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: b.line }]}
        />
      )}
    </View>
  );
}

/** The feed's shape while Edunex's part is on its way: a week, a course, its items. */
function Loading() {
  return (
    <View testID="skeleton.material" accessibilityState={{ busy: true }} style={{ paddingTop: space[2] }}>
      <Skeleton height={22} width={120} />
      {[0, 1].map((group) => (
        <View key={group} style={{ marginTop: space[4] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], height: 48 }}>
            <View style={{ width: 28, alignItems: "center" }}>
              <Skeleton height={12} width={12} />
            </View>
            <Skeleton height={14} width={group ? "38%" : "52%"} />
          </View>
          {[0, 1, 2].slice(group).map((row) => (
            <View key={row} style={{ flexDirection: "row", alignItems: "center", gap: space[4], height: 64 }}>
              <Skeleton height={24} width={24} style={{ marginHorizontal: 2 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton height={16} width={row === 1 ? "58%" : "80%"} />
                <Skeleton height={12} width={96} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Nothing to list: no Edunex (said once, with the way in), or a term nothing was posted in yet. */
function Nothing({ signedOut }: { signedOut: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { signIn, busy } = useSignIn();
  const icon = <Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />;
  if (signedOut)
    return (
      <EmptyState icon={icon} title={t("mobile.material.noEdunex")}>
        <Button variant="primary" busy={busy} onPress={() => void signIn("edunex")} testID="action.signIn.edunex">
          {t("action.signInTo", { source: "Edunex" })}
        </Button>
      </EmptyState>
    );
  return <EmptyState icon={icon} title={t("mobile.material.empty")} description={t("mobile.material.emptyHint")} />;
}
