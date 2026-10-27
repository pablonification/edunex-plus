// Reads what the Student registered for (/statusmhs/program-integrasi/riwayat/{sid},
// "Skema Program Pendidikan"): specialization, minor, multidisciplinary
// program or double major, with the advisor's and the program's approval. A
// row whose scheme it can't read is left out (skipped); an approval day it
// can't read is left blank and the row noted.
import type { SchemeRegistration } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  type Column,
  cellsOf,
  changed,
  clean,
  columns,
  day,
  details,
  type Elem,
  openPage,
  type Page,
  rowsOf,
  rowText,
  stackedLabels,
  textOf,
  widthOf,
} from "./records-common";

/** Two header rows: "Persetujuan" over the advisor's and the program's columns. */
const HEADER = ["", "Skema Program Pendidikan", "Dosen Wali", "Prodi Penyelenggara", "Status"];
const COLUMNS = {
  scheme: { labels: ["Skema Program Pendidikan", "Education Scheme", "Scheme"], required: true },
  advisor: { labels: ["Dosen Wali", "Academic Advisor", "Advisor"] },
  program: { labels: ["Prodi Penyelenggara", "Organizing Program", "Host Program"] },
  status: { labels: ["Status"] },
} satisfies Record<string, Column>;
/** A panel's kind: from its "register" link (…&tab=minor), else its title. Outbound Mobility is another layout and isn't read. */
const BY_TAB: Record<string, SchemeRegistration["kind"]> = {
  minor: "minor",
  spesialisasi: "specialization",
  multidisiplin: "multidisciplinary",
  doublemajor: "double-major",
};
const BY_TITLE: Record<string, SchemeRegistration["kind"]> = {
  minor: "minor",
  spesialisasi: "specialization",
  specialization: "specialization",
  multidisiplin: "multidisciplinary",
  multidisciplinary: "multidisciplinary",
  "double major": "double-major",
};

export function readSchemes(html: string, skipped?: Skipped): SchemeRegistration[] {
  const page = openPage(html, "education scheme", skipped);
  const out: SchemeRegistration[] = [];
  const seen = new Set<SchemeRegistration["kind"]>();
  for (const element of page.$(".panel").toArray()) {
    const panel = page.$(element);
    const tab = /[?&]tab=([a-z]+)/.exec(panel.find(".panel-footer a").attr("href") ?? "")?.[1];
    const kind = (tab && BY_TAB[tab]) || BY_TITLE[textOf(panel.find(".panel-title").first()).toLowerCase()];
    if (!kind) continue;
    seen.add(kind);
    const table = panel.find("table");
    if (table.length !== 1) changed(page, `the ${kind} panel has no table`);
    const rows = rowsOf(page, table);
    // The header: the rows of headings above the first row with data in it.
    const headings = rows.slice(
      0,
      Math.max(
        0,
        rows.findIndex((row) => cellsOf(page, row).some((cell) => cell.is("td"))),
      ),
    );
    const scheme = columns(page, stackedLabels(page, headings), COLUMNS, HEADER, "the header");
    // "Tidak ada data." across the table: no row.
    const registered = rows
      .slice(headings.length)
      .map((row) => cellsOf(page, row))
      .filter((cells) => cells.length !== 1);
    out.push(
      ...page.skipped.each(registered, rowText, (cells): SchemeRegistration => {
        if (widthOf(cells) !== scheme.width) changed(page, `a ${kind} row has ${cells.length} cells`);
        const [name, runBy] = textOf(scheme.need(cells, "scheme")).split(" · ").map(clean);
        const detail = details(page);
        const registration: SchemeRegistration = {
          kind,
          name: name!,
          program: runBy || null,
          advisorApprovedOn: detail.of("advisor", scheme.cell(cells, "advisor"), (cell) => approval(page, cell)),
          programApprovedOn: detail.of("program", scheme.cell(cells, "program"), (cell) => approval(page, cell)),
          status: detail.of("status", scheme.cell(cells, "status"), textOf),
        };
        detail.note(rowText(cells));
        return registration;
      }),
    );
  }
  if (seen.size === 0) changed(page, "no scheme panels");
  return out;
}

/** "✓ 5 Feb 2026" on a green label: the day it was approved. Anything else: not (yet) approved. */
function approval(page: Page, cell: Elem): string | null {
  return cell.find(".label-success").length > 0 ? day(page, cell.find("small").text(), "approval day") : null;
}
