// Reads UKT bills (/keuangan, "Status Keuangan"): per term the amount billed,
// the amount paid and the last day to pay, or the instalments with their own
// days and amounts. A bill whose term it can't read is left out (skipped); an
// amount, payment or deadline it can't read is left blank and the row noted.
import type { Bill, BillStatus, Instalment } from "../../../../core/models";
import type { Skipped } from "../../skipped";
import {
  type Column,
  type Columns,
  cellsOf,
  changed,
  columns,
  day,
  details,
  type Elem,
  endOfDayWib,
  int,
  labelsOf,
  openPage,
  type Page,
  rowsOf,
  rowText,
  rupiah,
  textOf,
  widthOf,
} from "./records-common";

const HEADER = ["Semester", "Tagihan (Rp)", "Pembayaran (Rp)", "Batas Pembayaran", "Petunjuk"];
/** A Student's Indonesian page wrote "Invoice (Rp)" and "Payment Due Date". */
const COLUMNS = {
  term: { labels: ["Semester", "Term"], required: true },
  amount: { labels: ["Tagihan (Rp)", "Tagihan", "Invoice (Rp)", "Invoice", "Bill (Rp)", "Bill"] },
  paid: { labels: ["Pembayaran (Rp)", "Pembayaran", "Payment (Rp)", "Payment", "Paid (Rp)", "Paid"] },
  due: { labels: ["Batas Pembayaran", "Payment Due Date", "Due Date", "Due"] },
} satisfies Record<string, Column>;
type Table = Columns<keyof typeof COLUMNS>;

/** Oldest term first. */
export function readBills(html: string, skipped?: Skipped): Bill[] {
  const page = openPage(html, "finance", skipped);
  // The bills table is the one with academic-year rows ("Tahun 2023 / 2024").
  const tables = page.$("table").filter((_, table) => rowsOf(page, page.$(table)).some((row) => row.hasClass("warning")));
  if (tables.length !== 1) changed(page, "no table of bills");
  const [header, ...rows] = rowsOf(page, tables.first());
  const table = columns(page, header ? labelsOf(cellsOf(page, header)) : [], COLUMNS, HEADER, "the bills header");

  const bills: Bill[] = [];
  const list = page.skipped.list();
  let year: number | null = null;
  for (const row of rows) {
    const cells = cellsOf(page, row);
    if (row.hasClass("warning")) {
      // A year holds the rows under it: one the app can't read would put them in the wrong year.
      const years = /(\d{4})\s*\/\s*(\d{4})/.exec(textOf(row));
      if (cells.length !== 1 || !years) changed(page, `year row "${textOf(row)}" isn't readable`);
      year = Number(years[1]);
    } else if (cells.length === 1) {
      // A note across the table: nothing to read.
    } else if (textOf(table.cell(cells, "term") ?? cells[0]!) === "SPI") {
      // SPI, the development fee some intakes pay once on entry: not a term's UKT, so not a bill here.
    } else {
      if (year === null) changed(page, "a bill row is out of place");
      const of = year;
      const bill = list.item(rowText(cells), () => {
        if (widthOf(cells) !== table.width) changed(page, `a bill row has ${cells.length} cells`);
        return readBill(page, of, table, cells);
      });
      if (bill) bills.push(bill);
    }
  }
  list.done();
  return bills.sort((a, b) => a.term.localeCompare(b.term));
}

function readBill(page: Page, year: number, table: Table, cells: Elem[]): Bill {
  // "1 - Ganjil", "2 - Genap", "3 - Pendek": the number is the term's.
  const label = textOf(table.need(cells, "term"));
  const semester = /^([123])\b/.exec(label)?.[1];
  if (!semester) changed(page, `term "${label}" isn't readable`);
  const term = `${year}-${semester}`;
  const detail = details(page);
  const amount = detail.of("amount", table.cell(cells, "amount"), (cell) => rupiah(page, textOf(cell), `bill of ${term}`));
  const paid = detail.of("paid", table.cell(cells, "paid"), (cell) => rupiah(page, textOf(cell), `payment of ${term}`));
  // An instalment it can't read blanks the whole deadline: a later one is never taken for the next one due.
  const due = detail.of("due", table.cell(cells, "due"), (cell) => {
    const instalments = readInstalments(page, term, cell);
    return { instalments, dueDate: instalments.length ? instalments.at(-1)!.dueDate : day(page, textOf(cell), `deadline of ${term}`) };
  });
  detail.note(rowText(cells));
  const instalments = due?.instalments ?? [];
  const dueDate = due?.dueDate ?? null;
  const dueAt = dueDate === null ? null : endOfDayWib(dueDate);

  // Billed against paid only when both are read: with either blank, whether it's paid isn't known.
  const status: BillStatus = detail.blank("amount")
    ? "unknown"
    : amount === null
      ? "not-billed"
      : detail.blank("paid")
        ? "unknown"
        : (paid ?? 0) >= amount
          ? "paid"
          : (paid ?? 0) > 0
            ? "partly-paid"
            : "unpaid";
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
