// Reads what the Student registered for (/statusmhs/program-integrasi/riwayat/{sid},
// "Skema Program Pendidikan"): specialization, minor, multidisciplinary
// program or double major, with the advisor's and the program's approval.
import type { SchemeRegistration } from "../../../../core/models";
import { cellsOf, changed, clean, day, type Elem, expectLabels, openPage, type Page, rowsOf, textOf } from "./records-common";

const HEADER = [
  ["", "Skema Program Pendidikan", "Persetujuan", "Status"],
  ["Dosen Wali", "Prodi Penyelenggara"],
];
/** A panel's kind: from its "register" link (…&tab=minor), else its title. Outbound Mobility is another layout and isn't read. */
const BY_TAB: Record<string, SchemeRegistration["kind"]> = { minor: "minor", spesialisasi: "specialization", multidisiplin: "multidisciplinary", doublemajor: "double-major" };
const BY_TITLE: Record<string, SchemeRegistration["kind"]> = {
  minor: "minor",
  spesialisasi: "specialization",
  specialization: "specialization",
  multidisiplin: "multidisciplinary",
  multidisciplinary: "multidisciplinary",
  "double major": "double-major",
};

export function readSchemes(html: string): SchemeRegistration[] {
  const page = openPage(html, "education scheme");
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
    const [first, second, ...rows] = rowsOf(page, table);
    expectLabels(page, first ? cellsOf(page, first).map(textOf) : [], HEADER[0]!, "the header");
    expectLabels(page, second ? cellsOf(page, second).map(textOf) : [], HEADER[1]!, "the header");
    for (const row of rows) {
      const cells = cellsOf(page, row);
      if (cells.length === 1) continue; // "Tidak ada data."
      if (cells.length !== 5) changed(page, `a ${kind} row has ${cells.length} cells`);
      const [, scheme, advisor, program, status] = cells as Elem[];
      const [name, runBy] = textOf(scheme!).split(" · ").map(clean);
      out.push({ kind, name: name!, program: runBy || null, advisorApprovedOn: approval(page, advisor!), programApprovedOn: approval(page, program!), status: textOf(status!) });
    }
  }
  if (seen.size === 0) changed(page, "no scheme panels");
  return out;
}

/** "✓ 5 Feb 2026" on a green label: the day it was approved. Anything else: not (yet) approved. */
function approval(page: Page, cell: Elem): string | null {
  return cell.find(".label-success").length > 0 ? day(page, cell.find("small").text(), "approval day") : null;
}
