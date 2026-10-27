// What a screen says about the SIX pages its data comes from, where that data is shown: a page
// whose layout changed (its data stays as last read, and says from when), else the rows the app
// left out because it doesn't recognise them yet (a new kind of fee, a course written another
// way), or kept with a cell it can't read left blank, as SIX writes them. Either way, a way to
// check it on SIX, and to report the page to the app's maintainer ("Laporkan masalah"). Nothing
// to say: nothing shown. Under it, on Nilai and Rencana studi, the courses their estimates leave
// out for that reason (UnreadNote).
import { SIX_WEB, sixPageOf } from "../core/links";
import type { ChangedPage, DatasetName } from "../core/models";
import { useOpenExternal } from "./hooks";
import { useFormat, useT } from "./i18n";
import { ReportButton } from "./report";
import { useDataset, useDatasetPayload, useStatus } from "./store";
import { Button } from "./ui/controls";
import { cx } from "./ui/cx";
import { Icons } from "./ui/icons";
import { Notice } from "./ui/layout";

/** The SIX page among `datasets`' that changed while the rest of SIX reads (SourceStatus.changedPages), if any. */
export function useChangedPage(datasets: readonly DatasetName[]): ChangedPage | undefined {
  const status = useStatus("six");
  if (status.state === "signed-out") return undefined;
  return status.changedPages?.find((page) => page.datasets.some((name) => datasets.includes(name as DatasetName)));
}

/** `datasets`: what the screen shows from SIX, the one it shows most first (its last read is said, unless another's page changed). */
export function SixPageNote({ datasets, className }: { datasets: readonly DatasetName[]; className?: string }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const page = useChangedPage(datasets);
  // The page that changed says when its own data was read.
  const last = useDatasetPayload(datasets.find((name) => page?.datasets.includes(name)) ?? datasets[0]!);
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
  // Rows kept with a cell left blank are shown, just not whole; rows left out aren't shown at all.
  const blank = rows.every((row) => row.blank);
  return (
    <Notice tone="neutral" className={className} title={t(blank ? "skipped.blankTitle" : "skipped.title", { count: rows.length })} action={openSix(left[0]!)}>
      <p>{t(blank ? "skipped.blankBody" : "skipped.body", { count: rows.length })}</p>
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

/**
 * The courses an estimate leaves out because SIX writes their grade or SKS in a way the app can't
 * read yet (StudentRecord.unread): said once, quietly, under the note that lists their rows.
 */
export function UnreadNote({ record, className }: { record: { unread: readonly { code: string }[] }; className?: string }) {
  const t = useT();
  const count = record.unread.length;
  if (!count) return null;
  return (
    <p className={cx("flex items-start gap-1.5 text-small text-muted", className)}>
      <Icons.Info className="mt-0.5 size-3.5 shrink-0" />
      {count > 3 ? t("sixRecords.unreadMany", { count }) : t("sixRecords.unread", { codes: record.unread.map((course) => course.code).join(", "), count })}
    </p>
  );
}
