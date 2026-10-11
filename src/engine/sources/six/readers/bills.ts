// Reads UKT bills (/keuangan, "Status Keuangan"): per term the amount billed,
// the amount paid and the last day to pay, or the instalments with their own
// days and amounts.
import type { Bill, BillStatus, Instalment } from "../../../../core/models";
import { cellsOf, changed, day, type Elem, endOfDayWib, expectLabels, int, openPage, type Page, rowsOf, rupiah, textOf } from "./records-common";

const HEADER = ["Semester", "Tagihan (Rp)", "Pembayaran (Rp)", "Batas Pembayaran", "Petunjuk"];

/** Oldest term first. */
export function readBills(html: string): Bill[] {
  const page = openPage(html, "finance");
  // The bills table is the one with academic-year rows ("Tahun 2023 / 2024").
  const tables = page.$("table").filter((_, table) => rowsOf(page, page.$(table)).some((row) => row.hasClass("warning")));
  if (tables.length !== 1) changed(page, "no table of bills");
  const [header, ...rows] = rowsOf(page, tables.first());
  expectLabels(page, header ? cellsOf(page, header).map(textOf) : [], HEADER, "the bills header");

  const bills: Bill[] = [];
  let year: number | null = null;
  for (const row of rows) {
    const cells = cellsOf(page, row);
    if (row.hasClass("warning")) {
      const years = /(\d{4})\s*\/\s*(\d{4})/.exec(textOf(row));
      if (cells.length !== 1 || !years) changed(page, `year row "${textOf(row)}" isn't readable`);
      year = Number(years[1]);
    } else if (cells.length === 1) {
      continue; // A note across the table.
    } else {
      if (year === null || cells.length !== HEADER.length) changed(page, "a bill row is out of place");
      bills.push(readBill(page, year, cells));
    }
  }
  return bills.sort((a, b) => a.term.localeCompare(b.term));
}

function readBill(page: Page, year: number, cells: Elem[]): Bill {
  const [label, billed, paidCell, due] = cells as [Elem, Elem, Elem, Elem];
  // "1 - Ganjil", "2 - Genap", "3 - Pendek": the number is the term's.
  const semester = /^([123])\b/.exec(textOf(label))?.[1];
  if (!semester) changed(page, `term "${textOf(label)}" isn't readable`);
  const term = `${year}-${semester}`;
  const amount = rupiah(page, textOf(billed), `bill of ${term}`);
  const paid = rupiah(page, textOf(paidCell), `payment of ${term}`);
  const instalments = readInstalments(page, term, due);
  const dueDate = instalments.length ? instalments.at(-1)!.dueDate : day(page, textOf(due), `deadline of ${term}`);
  const dueAt = dueDate === null ? null : endOfDayWib(dueDate);

  const status: BillStatus = amount === null ? "not-billed" : (paid ?? 0) >= amount ? "paid" : (paid ?? 0) > 0 ? "partly-paid" : "unpaid";
  let nextDueAt: number | null = null;
  if (status === "unpaid" || status === "partly-paid") {
    // The first instalment the payments so far don't cover.
    let covered = paid ?? 0;
    nextDueAt = instalments.find((instalment) => (covered -= instalment.amount) < 0)?.dueAt ?? dueAt;
  }
  return { term, amount, paid, status, dueDate, dueAt, instalments, nextDueAt };
}

/** Instalments sit in a small table inside the deadline cell: number, day, amount. */
function readInstalments(page: Page, term: string, cell: Elem): Instalment[] {
  const table = cell.find("table");
  if (table.length === 0) return [];
  return rowsOf(page, table.first()).map((row) => {
    const cells = cellsOf(page, row);
    if (cells.length !== 3) changed(page, `an instalment of ${term} has ${cells.length} cells`);
    const dueDate = day(page, textOf(cells[1]!), `instalment of ${term}`);
    const amount = rupiah(page, textOf(cells[2]!), `instalment of ${term}`);
    if (dueDate === null || amount === null) changed(page, `an instalment of ${term} has no day or amount`);
    return { number: int(page, textOf(cells[0]!), "instalment number"), amount, dueDate, dueAt: endOfDayWib(dueDate) };
  });
}
