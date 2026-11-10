// A module of a course as a screen of its own (/course/<code>/module/<id>, W1c and W6), in round 2's v4: pushed from
// the course's Modul list (or opened by search, an alert, a Task's way up), with Android's Back (and the back gesture)
// to where the Student came from. One title: the module's, big at the top of the page (under a line saying where it
// is: "Modul 3 · Tugas Akhir I"), fading into the bar once it has scrolled away. White cards of rows on the page's grey.
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { useCoursePage } from "../../../../src/app/screens/course/data";
import { useStatus } from "../../../../src/app/store";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { useB } from "../../ui/b";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { contentsOf } from "./contents";
import { FlatRows } from "./flat";
import { ModulePage, moduleEntry } from "./modules";

export function ModuleScreen({ code, module }: { code: string; module: number }) {
  const t = useT();
  const theme = useTheme();
  const b = useB();
  const page = useCoursePage(code);
  const edunex = useStatus("edunex").state;
  const pull = usePullToRefresh();
  // Where the page's big title ends (the page's top padding and the title's block): the bar's title fades in past it.
  const [titleBottom, setTitleBottom] = useState(96);
  const entries = page?.materials !== undefined ? contentsOf(page, t) : null;
  const entry = entries ? moduleEntry(entries, module) : undefined;
  usePerfDrawn(entries !== null);
  const reading = edunex === "connecting" || edunex === "live";
  const loading = !entry && entries === null && reading;
  const course = page?.course.name ?? code;
  return (
    <Page
      testID="screen.module"
      background={b.page}
      // The module's title once the page's has scrolled away; while loading nothing (the skeleton holds its place);
      // without the module, the course it was asked of.
      header={<TopBar v4 title={entry ? entry.title : loading ? "" : course} titleFrom={entry ? titleBottom : undefined} />}
      {...pull}
    >
      {entry && entries ? (
        <ModulePage
          entry={entry}
          anyContent={entries.some((e) => e.tasks.length || e.materials.length)}
          course={course}
          onTitleHeight={(height) => setTitleBottom(space[4] + height)}
        />
      ) : loading ? (
        <ModuleSkeleton />
      ) : (
        <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("course.unavailable")} />
      )}
    </Page>
  );
}

/** The module's shape while Edunex's part of the course is on its way: where it is, its title, a card of rows. */
function ModuleSkeleton() {
  return (
    <View testID="skeleton.module">
      <Skeleton height={14} width={140} />
      <Skeleton height={28} width="78%" style={{ marginTop: space[2] }} />
      <FlatRows style={{ marginTop: space[6] }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}>
            <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
            <View style={{ flex: 1, gap: space[1.5] }}>
              <Skeleton height={16} width={i === 1 ? "55%" : "75%"} />
              <Skeleton height={12} width="40%" />
            </View>
          </View>
        ))}
      </FlatRows>
    </View>
  );
}
