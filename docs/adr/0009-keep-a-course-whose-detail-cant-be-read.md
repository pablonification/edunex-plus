# 9. Keep a course whose detail can't be read

Status: accepted (2026-10-26). Narrows [0005](0005-read-past-a-row-the-app-doesnt-know.md) for SIX's
status page: a course row is left out only when its code or name can't be read.

## Context

A Student with sick days saw three of their courses disappear (#237). SIX showed their attendance
as two percentages, "82.35% / 94.12%", and the status page reader expected one. Under 0005 the
whole row was left out. That row is this term's course list, and SIX decides which courses the
Student takes, so the course was gone from every screen, Edunex's side too: its Tasks, materials
and Presence. A detail the app couldn't read cost the Student the whole course.

Leaving a row out is right when the app can't tell which course it is. Here it could: the code and
name were fine.

## Decision

- **The code and name say which course a row is.** Without them the row is left out, as before.
- **Class, SKS and attendance are details.** One the app can't read is left blank (null) and the
  course stays. Its row is noted in `six.skipped` like a row left out, with what didn't fit, so the
  Presence screen lists it with a way to check it on SIX and report it.
- **A blank detail never makes the page "changed".** Even when every course's attendance can't be
  read, the courses show with their counts unknown. A blank is never wrong, and the note says
  which rows to check. The table's layout (its columns, its term heading) stays strict.
- **The attendance count is the pair that fits.** Any two numbers in a row in the cell's tooltips
  whose ratio gives the first percentage shown. With sick days that is the meetings attended, as
  SIX shows for everyone else.

## Consequences

- One odd cell no longer hides a course anywhere in the app.
- A course with a blank count shows its attendance as unknown, the way a course with no meeting yet
  does, until SIX's page reads again.
- The Planner takes a blank SKS from the KRS, else ITB's catalog.
- `test/engine/six-odd-cells.test.ts` holds the rule for the status page and records what every
  other SIX reader does with an odd cell, so the next reader to make forgiving can be picked from
  that list.
