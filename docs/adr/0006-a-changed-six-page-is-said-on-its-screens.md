# 6. A SIX page that changed is said on its screens, not as all of SIX

Status: accepted (2026-10-23). Changes how [0001](0001-v2-engine-and-shell.md) shows a vendor
change for SIX's record pages and timetable; the page SIX's session rests on keeps the old way.
Follows [0005](0005-read-past-a-row-the-app-doesnt-know.md), which handles a single row.

## Context

A source's status was the worst of its feeds' outcomes: any page SIX changed turned SIX "changed",
with a red banner on every screen, though only one page was affected. SIX's fees page changing put
"SIX berubah" over Jadwal, Presensi and Beranda, whose data was fine. A Student can't tell from it
what's out of date, and soon stops reading it.

## Decision

- **A feed that reads one page says which datasets it fills** (`FeedSpec.shows`). When that page's
  layout changes (VendorChanged, or SIX refusing the page), the source stays "live", and its status
  lists the page under `changedPages`, with the datasets and what didn't fit. Read as it was again,
  the page leaves the list.
- **SIX's records and its timetable do.** The transcript and curriculum position, the curriculum,
  the KRS, the bills, and the month timetable.
- **The status page doesn't.** It says who the Student is, this term and its courses, and every
  other page builds on it: SIX changing it is still all of SIX changing, with the banner.
- **Each screen says it for its own data.** Nilai, Rencana studi's tabs, Presensi, Jadwal and Beranda
  say "SIX mengubah halaman ini", that the data shown is from the last good read (and when), and
  open that page on SIX. A part that was never read says so instead of waiting for it, and the
  first scan counts that part as stopped, not still reading.

## Consequences

- One page changing on SIX no longer makes the whole app look broken, and the Student sees which
  screen's data is out of date, and since when.
- There's no red banner for it. The note is on the screens that show that data, so a Student who
  never opens them isn't told. Those screens are where the data is read, so that's where it matters.
- Edunex and ITB's public pages keep the source-wide status: their feeds don't say what they fill yet.
