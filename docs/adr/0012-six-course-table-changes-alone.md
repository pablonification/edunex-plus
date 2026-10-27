# 12. SIX's course table can change alone

Status: accepted (2026-10-27). Changes [0006](0006-a-changed-six-page-is-said-on-its-screens.md)'s "the
status page doesn't": who the Student is and the term are still all of SIX, but the page's course
table changing is said where the courses are listed. Follows [0009](0009-keep-a-course-whose-detail-cant-be-read.md).

## Context

SIX's status page says who the Student is, this term and the term's courses. Every other SIX page
needs only the first two: the timetable's and the records' addresses carry the NIM, SIX's id for the
Student and the term. Under 0006 the whole page was what SIX's session rests on, so anything about it
the app couldn't read, the course table included, turned all of SIX "changed", with the banner on
every screen, and stopped the timetable, grades and fees from reading too, though nothing they need
had changed. The table was read as exactly seven columns in a fixed order, so one column SIX added
for some Students, or moved, was enough.

And a row left out because its code or name couldn't be read (0005, 0009) hid that course
everywhere, on Edunex's side too: SIX's list decides which of Edunex's courses are this term's.

## Decision

- **Who the Student is and the term stay strict.** The NIM, SIX's id for the Student, the name, the
  program and the term (from the course list's title). When one of them can't be read, it's still all
  of SIX changing, with the banner.
- **The course table can change alone.** When it can't be read, the status read still stores the
  Student and the term, and every other SIX page reads on. `six.courses` keeps its last good list, and
  SIX's status lists the change under `changedPages` with `six.courses`, as 0006 does for a page: the
  screens that list the courses (Beranda's course cards, Presensi) say "SIX mengubah halaman ini" and
  when the list is from. In the code, the feed names that part (`FeedSpec.part`) and says when only it
  changed (`PartChanged`).
- **Never read, nothing waits for it.** Until SIX's list reads, the course list is Edunex's courses
  of SIX's term, and empty without Edunex: then the note stands in for "no courses yet". The screens
  and the first scan count the list as stopped, not still coming. In a new term, last term's list
  isn't kept as this term's.
- **The columns are found by their labels**, in Indonesian and English (Kode, Mata Kuliah, Kelas, SKS,
  Kehadiran; Code, Course, Class, Credits, Attendance and a few more), in any order. A column the app
  doesn't know is ignored. Without a code or name column the table can't be read. Without a class,
  SKS or attendance column, that detail is blank for every course, and the table is noted once in
  `six.skipped`, as a row read with a detail left blank: Presensi says it's partly read, not left
  out. A header in words the app doesn't know, in the layout as recorded, still reads as recorded:
  SIX's English wording was never recorded.
- **A list that lost a row doesn't hide Edunex's courses.** When the read left out a row because its
  code or name couldn't be read, this term's Edunex courses that SIX doesn't list stay, without SIX's
  details: that row was probably one of them. A row kept with a detail blank (0009, marked `blank` in
  `six.skipped`) doesn't count, since the list is whole. `src/core/term-courses.ts` (the screens, the
  tray menu) and `src/core/saved.ts` (quick search, the first scan) apply this the same way.

## Consequences

- SIX changing its course table costs the Student the list's freshness, not the rest of SIX: Jadwal,
  Nilai, KRS and UKT read on, and there's no banner.
- While the table can't be read, the attendance counts stay as last read, and the status page is read
  every 15 minutes instead of hourly, as any page that changed is, until it reads again.
- Header words now matter for this table. A word the app doesn't know for a column, when the table is
  no longer as recorded, leaves that column unread: the detail blank and noted once, or, for the code
  or name, the course list said to have changed. The labels in `src/engine/sources/six/status.ts` are
  where to add one.
- While SIX's list is incomplete, an Edunex course the Student dropped on SIX can show for a while: a
  course too many, never one too few. Presensi shows the row SIX's page lost, to check on SIX.
