# 11. SIX's record pages: columns by name, a blank cell instead of a lost row

Status: accepted (2026-10-27). Takes [0009](0009-keep-a-course-whose-detail-cant-be-read.md) from the status
page to every record reader (fees, transcript, curriculum position, KRS, curriculum list and structure,
schemes), and changes how [0005](0005-read-past-a-row-the-app-doesnt-know.md) treats their columns.

## Context

0005 left out a row the app doesn't understand and kept each table's columns strict. 0009 kept a course
on the status page when only its class, SKS or attendance couldn't be read. The record readers still
lost a whole row over one odd cell (a payment, an SKS, a grade), and refused a whole page when a column
was added, moved or named another way: they wanted exactly the recorded labels in the recorded order.
`test/engine/six-odd-cells.test.ts` showed both, page by page.

Pages differ from one Student to another, and a public beta meets many more of them. One Student's
Indonesian fees page already labelled two columns in English ("Invoice (Rp)", "Payment Due Date").

## Decision

- **Columns are found by their labels**, Indonesian or English, on any page. A column the app doesn't
  know is passed over, and SIX's order doesn't matter. On SIX's English variant, whose labels were never
  recorded, a label the app doesn't know is taken from where the recorded page has it, as before.
- **What says which row it is stays strict**: a course's code and name, a bill's term, a curriculum's
  name and year, a scheme's name, and the headings rows sit under (a year, a semester, a stage's name).
  Without it a row is left out as before; without its column the page is refused, since no row can be
  placed.
- **Any other cell the app can't read is left blank** (null), the row is kept, and it's noted in
  `six.skipped` with what it shows and why (`Skipped.blanked`, marked `blank`). A detail's column
  that's missing leaves that detail blank in every row, noted once. A date with words around it, or
  written twice, still reads: the one date in the cell.
- **Where blank already means something, a blank says so.** A bill whose amount or payment can't be read
  has status `unknown`: never unpaid, never paid. A transcript row whose grade or transcript mark can't
  be read has standing `unknown`. A KRS step SIX shows done at a time the app can't read is `undated`:
  done, with no time.
- **A few stay strict because no blank fits them.** A KRS step's name (it says which step a time is). On
  the curriculum-position page, a course's status label and the grade and kind columns: they say
  whether a course was taken at all, and whether it's required. And an instalment: one the app can't
  read blanks the bill's whole deadline, so a later instalment is never taken for the next one due.
- **Checks skip a blank, and still catch known values that disagree.** SIX's IP or IPK over a blank row
  shows unchecked, as SIX's (`checkIndex(…, blank)`: no figure of the app's beside it); a term's IP
  doesn't depend on the transcript mark, so a blank mark leaves only the IPK unchecked. A bill against
  its payment is `unknown`. A detail going blank, or coming back, is never news for an alert; a KRS
  step done is, once, whether or not its time reads.
- **The app's own figures leave a blank out, and say which.** The planner's and Nilai's projections and
  SKS sums take an SKS from another SIX page or ITB's catalog when one has it; a course whose grade or SKS
  stays unknown counts in none of them, and those screens name it (`StudentRecord.unread`). Where SIX
  shows its own total (IPK, SKS passed, a term's SKS, the KRS's SKS), the app shows SIX's, and "-" when
  it can't read it; what starts from the IPK (a target, the usual grade) starts from SIX's then.
- **On screen a blank is "-"**, never 0; a bill or grade the app can't read says "Cek di SIX". The SIX
  page note says the rows aren't fully read yet, and lists them.

## Consequences

- One odd cell costs one blank cell; a renamed or extra detail column costs that detail. A row is lost
  only when the app can't tell which one it is, and a page only when what holds its rows changed.
- Data saved by older versions still loads: the fields that can be blank became nullable, and the new
  values (`unknown`, `undated`, `blank`) are optional.
- Even every grade written another way no longer refuses the transcript: each course stays, each is
  noted, and Nilai shows SIX's IP and IPK. Before, the page was refused and kept its last read.
- `test/engine/six-odd-cells.test.ts` keeps what every reader does with an odd cell; each reader's tests
  prove a blank detail, an extra or moved column, a missing identity column, and checks over blanks.
