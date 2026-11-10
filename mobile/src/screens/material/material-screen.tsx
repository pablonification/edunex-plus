// Materi (/material), behind Beranda's "Materi" tile: what the lecturers posted across this term's courses, newest
// first. The first screen is what's new: "Minggu ini" and "Minggu lalu" open, "Sebelumnya" folded under its count (one
// tap opens it); when the last two weeks brought nothing, the newest few lead under "Terbaru" (./feed.ts). Within a
// week the items sit under their course: a quiet line with the course's own glyph in its colour and its name (a
// heading, not a row), then each item on one row: its kind's glyph (a PDF, slides, a class link, a note), its name as
// the lecturer wrote it, the day, and one mark at the end: the shared chevron when it opens here (a file in the
// phone's own viewer, a note or a picture on its module's screen), an arrow when it leaves the app (a link, a video
// meeting, Edunex). One tap opens it. Only material is here: a module that just holds a Task is on Tugas.
// The same data and rules as a course's Modul tab (./feed.ts). No new request: it reads what the app already holds.
import { FlashList } from "@shopify/flash-list";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { edunexMaterialUrl, type MaterialKind, materialAction, materialKind } from "../../../../src/core/course-materials";
import type { Material } from "../../../../src/core/models";
import { useNav } from "../../nav";
import { useArrivalId } from "../../parts/arrival";
import { FileProblemNote, useEdunexFile } from "../../parts/files";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh, useSignIn } from "../../shell/source-status";
import { BRow, useB } from "../../ui/b";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { type IconName, Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel } from "../../ui/layout";
import { CrossFade } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { type FeedItem, type FeedLine, feedLines, feedLineType, materialFeed } from "./feed";
import { FoldHeading } from "./fold";

/** A kind's glyph, the one family's (ui/icons.tsx). Slides are told from other files by their name (kindIcon). */
const KIND_ICON: Record<MaterialKind, IconName> = {
  pdf: "FilePdf",
  file: "FileText",
  vicon: "Video",
  video: "Video",
  audio: "FileAudio",
  note: "StickyNote",
  link: "Link",
  page: "Globe",
  image: "Image",
  interactive: "Layers",
  other: "FileText",
};

const SLIDES = /\.(pptx?|ppsx?|key|odp)$/i;

/** A file that is a deck gets the slides glyph, by its file's name or the name the lecturer gave it. */
const kindIcon = (kind: MaterialKind, name: string): IconName => (kind === "file" && SLIDES.test(name) ? "FileSlides" : KIND_ICON[kind]);

/** Where a row's text starts: the glyph's column and the gap after it (BRow's). */
const TEXT_INSET = 28 + space[4];

const WEEK_TITLE = {
  thisWeek: "course.thisWeek",
  lastWeek: "mobile.material.lastWeek",
  earlier: "mobile.material.earlier",
  latest: "mobile.material.latest",
} as const;

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
  // "Sebelumnya" starts folded, so the first screen is what's new (feedLines); a tap opens it.
  const [toggled, setToggled] = useState(false);
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
  const lines = useMemo(() => (sections ? feedLines(sections, toggled) : []), [sections, toggled]);
  usePerfDrawn(sections !== null);
  const toggle = useCallback(() => setToggled((on) => !on), []);
  const renderItem = useCallback(({ item: line }: { item: FeedLine }) => <Line line={line} onFold={toggle} />, [toggle]);
  const loading = sections === null && (edunex === "connecting" || edunex === "live");
  const arrival = useArrivalId(!loading);
  return (
    // The list ends above the phone's own bar, scrolled or not (as Page does): no row under Back, Home and Recents.
    <View testID="screen.material" style={{ flex: 1, backgroundColor: b.page, paddingBottom: bottom }}>
      {/* The bar in the page's own colour in both themes (v4's page is the dark page; the light one is the surface). */}
      <TopBar v4={b.dark} title={t("mobile.material.title")} />
      {/* The skeleton becoming the list: it fades through, once, when the data comes while the Student looks. */}
      <CrossFade id={arrival} style={{ flex: 1 }}>
        <FlashList
          data={lines}
          keyExtractor={(line) => line.key}
          getItemType={feedLineType}
          renderItem={renderItem}
          ListHeaderComponent={<ProblemBanner belowBar />}
          ListEmptyComponent={loading ? <Loading /> : <Nothing signedOut={edunex === "signed-out"} />}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] }}
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
              colors={[theme.color.primary]}
              progressBackgroundColor={theme.color.surfaceContainerHigh}
            />
          }
        />
      </CrossFade>
    </View>
  );
}

/**
 * One line of the feed. Plain cells, as Tugas's list has: Ujian's rows arrived in a stagger inside the virtualised list
 * and one was left a row too low the first time the page showed, so nothing here moves a cell while the list measures it.
 */
const Line = memo(function Line({ line, onFold }: { line: FeedLine; onFold: () => void }) {
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
  if (line.type === "course") return <CourseLine code={line.code} name={line.name} />;
  return <Item item={line.item} last={line.last} />;
});

/** Whose items follow: the course's own glyph in its colour and its name, quiet and not a row (nothing to tap). */
function CourseLine({ code, name }: { code: string; name: string }) {
  const b = useB();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={name}
      style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 32, marginTop: space[3] }}
    >
      <View style={{ width: 28, alignItems: "center" }}>
        <CourseGlyph code={code} name={name} size={20} />
      </View>
      <Text size="labelLarge" weight="medium" numberOfLines={1} style={{ flex: 1, color: b.muted }}>
        {name}
      </Text>
    </View>
  );
}

/** An item's kind, in the page's quiet ink: the colour is its course's, on the line over it. */
function Glyph({ name }: { name: IconName }) {
  const theme = useTheme();
  const Icon = Icons[name];
  return (
    <View style={{ width: 28, alignItems: "center" }}>
      <Icon size={24} color={theme.v4.fg2} />
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
  // The quiet line is the day it was posted alone (its course is the line over the group): short, so it never wraps.
  const when = item.at !== null ? f.dayMonth(item.at) : undefined;
  const testID = `row.material.${item.material.id}`;
  const { material } = item;
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const glyph = <Glyph name={kindIcon(kind, action.kind === "download" ? action.name : material.title)} />;
  const label = factsLabel(material.title, t(`material.${kind}`), item.course, when);
  if (action.kind === "download")
    return <FileItem material={material} file={{ url: action.url, name: action.name }} last={last} glyph={glyph} when={when} label={label} testID={testID} />;
  // A note or a picture is read in full on its module's screen (the rows' chevron); a link opens as a lecturer's link
  // does, a class is joined, anything else opens on Edunex: the arrow says the row leaves the app.
  const leaves = action.kind !== "note" && action.kind !== "image";
  const open = () => {
    if (action.kind === "note" || action.kind === "image") go({ screen: "course", code: item.code, module: item.module });
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
  const { busy, open, share, problem } = useEdunexFile(file, edunexUrl, { inline: true });
  return (
    <View>
      <BRow
        testID={testID}
        // The problem's note sits under the row, so the hairline goes under the note instead.
        last={last || problem !== null}
        leading={glyph}
        title={material.title}
        meta={when}
        // A file opens on this phone, downloaded or not yet: the rows' chevron, a spinner while it comes.
        trailing={busy ? <ActivityIndicator size="small" color={b.muted} /> : undefined}
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

/** The feed's shape while Edunex's part is on its way: a week's heading, a course's line, then its items. */
function Loading() {
  return (
    <View testID="skeleton.material" accessibilityState={{ busy: true }} style={{ paddingTop: space[2] }}>
      {[3, 2].map((rows, group) => (
        <View key={rows} style={{ marginTop: group ? space[6] : 0 }}>
          <Skeleton height={22} width={group ? 130 : 110} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], height: 32, marginTop: space[3] }}>
            <Skeleton height={20} width={20} style={{ marginHorizontal: 4 }} />
            <Skeleton height={12} width={group ? 120 : 170} />
          </View>
          {Array.from({ length: rows }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: still placeholders
            <View key={row} style={{ flexDirection: "row", alignItems: "center", gap: space[4], height: 64 }}>
              <Skeleton height={24} width={24} style={{ marginHorizontal: 2 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton height={16} width={row === 1 ? "58%" : "80%"} />
                <Skeleton height={12} width={48} />
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
