// What a screen says about the SIX pages its data comes from, where that data is shown: a page
// whose layout changed (its data stays as last read, and says from when), else the rows the app
// left out because it doesn't recognise them yet (a new kind of fee, a course written another
// way), as SIX writes them. Either way, a way to check it on SIX, and to report the page to the
// app's maintainer ("Laporkan masalah"). Nothing to say: nothing shown.
import { SIX_WEB, sixPageOf } from "../core/links";
import type { ChangedPage, DatasetName } from "../core/models";
import { useOpenExternal } from "./hooks";
import { useFormat, useT } from "./i18n";
import { ReportButton } from "./report";
import { useDataset, useDatasetPayload, useStatus } from "./store";
import { Button } from "./ui/controls";
import { Notice } from "./ui/layout";

/** The SIX page among `datasets`' that changed while the rest of SIX reads (SourceStatus.changedPages), if any. */
export function useChangedPage(datasets: readonly DatasetName[]): ChangedPage | undefined {
  const status = useStatus("six");
  if (status.state === "signed-out") return undefined;
  return status.changedPages?.find((page) => page.datasets.some((name) => datasets.includes(name as DatasetName)));
}

/** `datasets`: what the screen shows from SIX, the one it shows most first (its last read is the one said). */
export function SixPageNote({ datasets, className }: { datasets: readonly DatasetName[]; className?: string }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const page = useChangedPage(datasets);
  const last = useDatasetPayload(datasets[0]!);
  const skipped = useDataset("six.skipped");
  const student = useDataset("six.student");
  const openSix = (name: DatasetName) => (
    <>
      <Button size="sm" onClick={() => open(student ? sixPageOf(name, student) : SIX_WEB)}>
        {t("sixPage.openSix")}
      </Button>
      <ReportButton about={{ datasets: [...datasets] }} />
    </>
  );

  if (page) {
    return (
      <Notice tone="warning" className={className} title={t("sixPage.changed")} action={openSix(datasets.find((name) => page.datasets.includes(name))!)}>
        {last ? t("sixPage.changedSince", { when: f.dayTimeWord(last.fetchedAt) }) : t("sixPage.changedNever")}
      </Notice>
    );
  }

  const left = datasets.filter((name) => skipped?.[name]?.length);
  const rows = left.flatMap((name) => skipped![name]!.map((row) => ({ ...row, key: `${name} ${row.row} ${row.why}` })));
  if (!rows.length) return null;
  return (
    <Notice tone="neutral" className={className} title={t("skipped.title", { count: rows.length })} action={openSix(left[0]!)}>
      <p>{t("skipped.body", { count: rows.length })}</p>
      <ul className="mt-1.5 space-y-0.5 text-caption tabular-nums">
        {rows.map((row) => (
          <li key={row.key} className="break-words">
            {row.row}
          </li>
        ))}
      </ul>
    </Notice>
  );
}
