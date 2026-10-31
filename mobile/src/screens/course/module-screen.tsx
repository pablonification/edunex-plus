// A module of a course as a screen of its own (/course/<code>/module/<id>, W1c and W6): pushed from
// the course's Modul list (or opened by search, an alert, a Task's way up), with Android's Back (and
// the back gesture) to where the Student came from. The top bar names the course; the page, the module.
import { useT } from "../../../../src/app/i18n";
import { useCoursePage } from "../../../../src/app/screens/course/data";
import { useStatus } from "../../../../src/app/store";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { contentsOf } from "./contents";
import { ModulePage, moduleEntry } from "./modules";

export function ModuleScreen({ code, module }: { code: string; module: number }) {
  const t = useT();
  const theme = useTheme();
  const page = useCoursePage(code);
  const edunex = useStatus("edunex").state;
  const pull = usePullToRefresh();
  const entries = page?.materials !== undefined ? contentsOf(page, t) : null;
  const entry = entries ? moduleEntry(entries, module) : undefined;
  usePerfDrawn(entries !== null);
  const reading = edunex === "connecting" || edunex === "live";
  return (
    <Page testID="screen.module" header={<TopBar title={page?.course.name ?? code} />} {...pull}>
      {entry && entries ? (
        <ModulePage entry={entry} anyContent={entries.some((e) => e.tasks.length || e.materials.length)} />
      ) : entries === null && reading ? (
        // The module's shape while Edunex's part of the course is on its way: its label, its title, its rows.
        <>
          <Skeleton height={14} width={96} />
          <Skeleton height={28} width="75%" style={{ marginTop: space[2] }} />
          <Skeleton height={56} style={{ marginTop: space[6] }} />
          <Skeleton height={56} style={{ marginTop: 2 }} />
          <Skeleton height={56} style={{ marginTop: 2 }} />
        </>
      ) : (
        <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("course.unavailable")} />
      )}
    </Page>
  );
}
