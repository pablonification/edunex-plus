# 13. A meeting the app can't read on SIX's timetable marks its day

Status: accepted (2026-10-27). Amends [0005](0005-read-past-a-row-the-app-doesnt-know.md)'s "the month
timetable stays strict": its grid still does, but a meeting the app can't read is left out and its day
marked, so no screen or alert calls that day free. Follows [0006](0006-a-changed-six-page-is-said-on-its-screens.md).

## Context

The app reads SIX's month timetable whole. Under 0005 a meeting it couldn't place for certain refused
the page, because a meeting left out could make a day look free on Beranda and in Jadwal, and the app
never calls a day free that it couldn't read. Under 0006 that page then shows as changed on its own
screens. So one meeting SIX writes another way for one Student (a time with dots, an activity the app
doesn't know) cost the whole month: Jadwal, Beranda and Presensi showed nothing new, and the class
reminders stopped. `test/engine/six-odd-cells.test.ts` showed it: one meeting's cell written another
way refused the page.

## Decision

- **The grid stays strict:** its rows, the day numbers, the weekdays they fall on and the month it
  names. A day without its date, or days out of line, still make the page changed (0006).
- **A meeting it can't read is left out, and its day marked.** Its row is noted in `six.skipped` as SIX
  writes it, and the meeting kept in `six.scheduleUnread`: its day, its text, and its course code when
  SIX shows one plainly. A time a day shows without a meeting the app can open counts the same, as the
  piece of the day's text from that time on. More meetings left out than read, across the months read
  together, is still the page changing.
- **No day with one is called free, and no next class skips it.** Jadwal shows "N kuliah belum
  terbaca" under that day's date instead of "Kosong", in the month and in the day's details too.
  Beranda's Hari ini lists it first on its day, and its now card says "Ada kuliah yang belum terbaca ·
  {day}" for a day up to the card's class, and in place of "no classes in the coming week". Presensi's
  day line counts it and says to check SIX, and a course's row and page say it before that course's
  next class when the code is known. The tray menu says it under the next class. Jadwal, Beranda, the
  course page and the tray open SIX's timetable on that month ("Buka jadwal di SIX"); on Presensi, the
  note lists the row and opens SIX.
- **Its time isn't known**, so today's counts as ahead until the teaching day ends: 18:00 WIB, or the end
  of a later class SIX lists that day. Then Presensi's line moves on to tomorrow.
- **A meeting announced only in Edunex on that day may be that one.** It still shows, but isn't said to
  be missing from SIX, and raises no "outside SIX's timetable" alert or first-scan line.
- **Class reminders:** a class without a time can't be reminded 15 minutes before it. With the
  reminders on, that morning at 06:00 WIB: there's a class today the app can't read, and its time and
  room are on SIX's timetable.
- **Calm, not an alarm.** Neutral words and marks, no warning colors. Beranda shows no note over the
  screen for it; Jadwal's and Presensi's notes list the row with "Laporkan", as for any row left out.

## Consequences

- One odd meeting no longer hides a month: the other meetings show, with their reminders.
- A day with a meeting the app couldn't read says a class is there, not when or where: the Student
  checks SIX, a click away.
- Without its time: absences left count only meetings sure to come, so not this one; "Tandai Hadir" is
  watched only for meetings with their SIX id; the phone calendar leaves it out.
- An unknown course code marks the day for every course: Edunex's meetings that day aren't said to be
  missing from SIX, but no course's next class names it.
- `six-odd-cells` now shows a meeting's cell written another way as a row left out, not the page
  refused.
