// What the app left out of a SIX page it otherwise read: a row it doesn't recognise yet (a new
// kind of fee, a course written another way), said quietly on the screen that shows that page's
// data, with the row as SIX shows it and a way to check it there. Nothing left out: nothing shown.
import { SIX_WEB, sixPageOf } from "../core/links";
import type { DatasetName } from "../core/models";
import { useOpenExternal } from "./hooks";
import { useT } from "./i18n";
import { useDataset } from "./store";
import { Button } from "./ui/controls";
import { Notice } from "./ui/layout";

export function SkippedNote({ datasets, className }: { datasets: readonly DatasetName[]; className?: string }) {
  const t = useT();
  const open = useOpenExternal();
  const skipped = useDataset("six.skipped");
  const student = useDataset("six.student");
  const left = datasets.filter((name) => skipped?.[name]?.length);
  const rows = left.flatMap((name) => skipped![name]!.map((row) => ({ ...row, key: `${name} ${row.row} ${row.why}` })));
  if (!rows.length) return null;
  return (
    <Notice
      tone="neutral"
      className={className}
      title={t("skipped.title", { count: rows.length })}
      action={
        <Button size="sm" onClick={() => open(student ? sixPageOf(left[0]!, student) : SIX_WEB)}>
          {t("skipped.openSix")}
        </Button>
      }
    >
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
