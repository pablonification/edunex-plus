# Edunex Plus

A cross-platform desktop app for ITB students that reads ITB's two student systems, Edunex (the LMS) and SIX (the academic system), plus ITB's public academic calendar and course catalog, and tells the Student what needs them, what changed, and where they stand. This glossary defines the domain language shared by all project decisions and code.

## Language

### Platform

**Edunex**:
ITB's learning management system at edunex.itb.ac.id; a homegrown Vue.js SPA built by vendor Cognisia. Not Moodle/Open edX/Sakai.
_Avoid_: "the LMS site", Edunex/edunex in prose (capital E, one word: Edunex)

**Edunex Plus**:
This project's product mark — the unofficial desktop app. Lowercase-n styling is deliberate, to stay distinct from Cognisia's Edunex trademark; never apply the "Edunex Plus" mark to Edunex itself.
_Avoid_: "EduNEX Plus", "EdunexPlus"

**Cognisia**:
The vendor that builds and operates Edunex; hosts the API under its own domain (api-edunex.cognisia.id).
_Avoid_: "ITB's servers" (the API is vendor-hosted)

**INA account**:
A student's or lecturer's Microsoft (Azure AD/Entra) ITB account used for SSO login to Edunex.
_Avoid_: "ITB email", "SSO password"

**Period**:
A semester/term entity in Edunex that scopes courses, RPS, and scheduling.
_Avoid_: semester (use Period when referring to the API entity)

### Roles

**Student**, **Lecturer**:
The two Edunex user levels relevant to the desktop client; one human can hold several accounts (e.g. student + lecturer) and switch between them.
_Avoid_: user (ambiguous between human and account)

### Academic features

**RPS**:
Rencana Pembelajaran Semester — the semester lesson plan attached to a course.
_Avoid_: syllabus

**CPMK**:
Course learning outcomes (Capaian Pembelajaran Mata Kuliah) that structure a course's RPS.

**Vicon**:
Edunex's video-conferencing feature for online classes.
_Avoid_: Zoom (Zoom is one backend, Vicon is the feature)

**CRS**:
Class Response System — in-class polling/quizzing within Edunex.

**Presence**:
Attendance records for a class meeting.
_Avoid_: attendance (use Presence when referring to the Edunex feature)

**Task**:
An assignment in Edunex's API (course/tasks); distinct from an exam.
_Avoid_: assignment in code identifiers (collides with programming terms); use Task

**To Do**:
Edunex's aggregated list of pending items (tasks, exams) for the logged-in account.
_Avoid_: todo list in UI copy without the Edunex meaning

**Exam**:
"Ujian": one exam of a course (its UTS, its UAS, a quiz), however many systems list it: SIX's sitting with its room, Edunex's exam, a take-home, the course outline, ITB's exam week. Its parts each run out at their own moment (a sitting at its start, an Edunex exam open for more than a day at its close, a take-home at its deadline). It's behind the Student once every part is; one never given a day is behind once its exam week ends.
_Avoid_: test, assessment

**Take-home**:
An exam handed in as an Edunex Task: Edunex files it under UTS or UAS, or its name starts with the exam's word ("UTS Markom", "Midex"). Listed once, as the exam's, at its deadline.
_Avoid_: exam Task, assignment exam

### In the app

**Exam period**:
"Masa UTS", "Masa UAS": ITB's exam week (or weeks) of the term, from the ITB calendar. Exams with only their period known yet are one quiet line where the period falls in Tugas & Ujian, never counted as something to do.
_Avoid_: exam season, "Minggu UTS" (Minggu reads as Sunday next to a date)

**Mark as done**:
"Tandai selesai": the Student moves an Edunex exam open for more than a day (a quiz open for a week) to Done once they've taken it, the one thing about an exam no system tells the app. Only there: never on a SIX sitting (its time decides) or a Task (Edunex knows). Undoable, kept on this computer, and it ends when Edunex moves the exam's time: then it's back in To do and says so.
_Avoid_: dismiss, hide, complete

**Snooze**:
"Ingatkan nanti" (Remind me later): the Student puts a Beranda item, a late Task in Tugas & Ujian (the same snooze as Beranda's for that Task) or a course's attendance banner off until a moment that fits it ("Besok pagi", "Sehari sebelum tenggat", "Saat dibuka"). It always ends: at that moment, at the item's last useful moment, or when the item changes (a moved deadline, a new count, turning urgent), two weeks at most. Kept on this computer; OS notifications and the bell are not affected.
_Avoid_: dismiss, mute, "don't remind me again" (nothing is hidden for good by a snooze; that's Handled)

**Handled**:
"Sudah beres": the Student says a Beranda item is dealt with, where only they can know it: a lecturer's change checked ("Sudah kucek"), a class's attendance warning seen ("Sudah tahu"), a group hand-in, a payment SIX hasn't shown, or a Task handed in another way or not handed in at all (marked on its page). Only a new fact brings it back (another edit, a moved deadline, a new target), never time alone, except a bill turning overdue. What the app can see (the Student's own hand-in, a Presence, the KRS) clears itself and has no "handled". A Task marked handed in another way or not handed in gets no deadline reminders. Kept on this computer, and cleared when a different Student signs in. Called `done` in code.
_Avoid_: dismissed, done (on screen), archived

**Unrecognised row**:
"Baris yang belum dikenali": a row a SIX page shows that the app doesn't understand (a fee that isn't a term's UKT, a course written another way). The app leaves that row out, reads the rest of the page, and says so on the screen that shows that page's data, with the row as SIX writes it and a way to open that page on SIX. When the app can tell which row it is and only a detail of it doesn't fit (a payment, an SKS, a grade written another way), the row stays with that detail blank, said as "baris yang belum terbaca utuh". It's not "SIX changed": that's the page's layout itself, or more rows left out than read. On SIX's timetable, a meeting the app can't read is left out the same way and its day marked: the screens say there's a class that day the app couldn't read, with a way to SIX's timetable, and never call the day free ([ADR 0013](docs/adr/0013-a-meeting-the-app-cant-read-marks-its-day.md)). Called `skipped` in code ([ADR 0005](docs/adr/0005-read-past-a-row-the-app-doesnt-know.md), [ADR 0011](docs/adr/0011-record-columns-by-name-and-blank-cells.md)).
_Avoid_: error, broken row, ignored

**Class the app can't read**:
"Kuliah yang belum terbaca": a meeting SIX's timetable shows that the app couldn't read (its time written another way, say). It's left out like an unrecognised row, and its day is marked: Jadwal, Beranda, Presensi, the tray menu and the class reminders say there's a class that day the app couldn't read, with "Buka jadwal di SIX", and never call the day free. Its time and room aren't known; its course is when SIX shows the code plainly. Called `scheduleUnread` in code ([ADR 0013](docs/adr/0013-a-meeting-the-app-cant-read-marks-its-day.md)).
_Avoid_: missing class, broken class, error

**Changed page**:
"SIX mengubah halaman ini": one SIX page whose layout changed (the fees page, the timetable, the status page's course table) while the rest of SIX still reads. The screens that show its data say so, keep the data from the last good read, and say when that was; SIX itself stays connected. Not "SIX changed" (the banner), which is what the whole session rests on: who the Student is and the term. Called `changedPages` in code ([ADR 0006](docs/adr/0006-a-changed-six-page-is-said-on-its-screens.md), [ADR 0012](docs/adr/0012-six-course-table-changes-alone.md)).
_Avoid_: broken page, error, SIX is down

**Guide**:
"Panduan": the tour of the window a new Student is offered after their first sign-in, once the app has opened. It opens each place in the sidebar's order and a course, and lights their parts one at a time, saying what each is for and how to use it, then the menus and tools around them. A part a page doesn't show right now is passed over. It can be skipped at any step, is offered once (again after signing out of everything, for the next Student), and Settings › Tentang starts it again. The first-run scan waits for it. Not offered to a Student who used the app before it existed. Called `guide` in code.
_Avoid_: onboarding, walkthrough, tutorial (in UI copy)

**Problem report**:
"Laporan masalah": what a Student can send the maintainer when the app couldn't read a page (a changed page, unrecognised rows, Edunex or SIX changing): the app's version and system, which page and which check, and that page as SIX or Edunex sent it, scrubbed on their computer (names, numbers, contacts, links replaced, grades and amounts made up). It also says whether the scrubbed page still fails the same way, and carries the App log. The page is kept in memory only, until that page reads again or they sign out, and nothing is sent until they choose how (the Report relay, LINE, GitHub), or by itself if they said so when the app asked. Called `report` in code ([ADR 0007](docs/adr/0007-report-a-page-the-app-couldnt-read.md), [ADR 0014](docs/adr/0014-a-report-carries-what-a-fix-needs.md)).
_Avoid_: crash report, log, telemetry, feedback

**Report relay**:
The maintainer's small service a Problem report goes to with one click ("Kirim langsung"), or by itself when the Student agreed: it keeps the whole report private for the maintainer and files a public GitHub issue with only its summary. Called `relay` in code.
_Avoid_: server, backend, cloud, telemetry

**Story**:
"Cerita": what the Student adds in their own words to a Problem report that went to the Report relay, right after it went. Public, on its issue. Called `note` in code.
_Avoid_: comment, feedback, description

**App log**:
"Yang dilakukan aplikasi": what the app did in the last hour (its reads, sign-ins, updates, notifications, errors), kept in memory only and carried, scrubbed, by every Problem report. Called `log` in code.
_Avoid_: telemetry, analytics, history ("Riwayat" is a Task's), "Catatan" (a lecturer's note)

**Course color**:
"Warna mata kuliah": a course's identity mark, its dot and its stripe, the same on every screen. One of ten named colors ("Biru", "Nila"), each with a tone for light and one for dark; none is a status hue or grey. A course's automatic color is remembered the first time it shows, so it never moves by itself; a color the Student picks stays with the course code, next term too. Kept on this computer.
_Avoid_: course status, tag color, theme

**Highlight**:
"Sorotan": text the Student marked in a file they read in the app (a PDF, a Word document, a text file), in one of four highlighter colors. Kept on this computer only, never sent to Edunex, by the file's content, so the same file shows its highlights wherever it's listed. Each is kept where its text is (a PDF's page and the characters on it), so it comes back at any zoom; one whose text isn't in the file any more isn't drawn. The Student removes one, or all of a file's at once, and can put them back right after. Removed when the Student signs out of everything, and when a different Student signs in.
_Avoid_: annotation, note, bookmark, mark (in UI copy)

**Page note**:
"Catatan halaman": what the Student writes about one page of a PDF they read in the app (a lecturer's slide, mostly), one note a page. A Word document or a text file, whose pages aren't fixed, has one note for the whole file. Kept with the file's highlights, by its content, on this computer only and never sent to Edunex, and removed with them (signing out of everything, a different Student signing in). On screen the Student's own notes are "Catatanku", so they're never taken for a lecturer's "Catatan" on Edunex.
_Avoid_: annotation, comment, footnote, a bare "Catatan" in UI copy (that's a lecturer's note on Edunex)

### Reports and fixes

**Drift**:
SIX or Edunex showing something the app doesn't read yet: a Changed page, or Unrecognised rows.
_Avoid_: breakage, outage (SIX still works; the app hasn't learned it)

**Report relay**:
The small service a Problem report goes to when the Student sends it from the app: it files the report as an issue on the app's repository, one issue per problem, and keeps the pages private for the maintainer. Called `relay` in code ([ADR 0015](docs/adr/0015-a-relay-files-reports-and-a-bot-drafts-the-fix.md)).
_Avoid_: server, backend, telemetry

**Signature**:
What makes two Problem reports the same problem: the system, the page, the kind (a Changed page or Unrecognised rows) and the check that failed, its numbers aside. Reports with one signature share one issue.
_Avoid_: fingerprint, hash

**Fix bot**:
The GitHub workflow that turns a relay issue into a draft fix: the report's pages as test data, a test that fails the way the Student's read did, and the reader changed until it passes. The maintainer reviews it; it never merges. Called `drift-fix` in code.
_Avoid_: auto-fix, AI agent

### SIX and ITB's rules

**SIX**:
ITB's academic information system at six.itb.ac.id: the official timetable with rooms, attendance counts, grades, the KRS and bills. Server-rendered HTML pages, not an API. See SIX.md.
_Avoid_: "Six", "the portal"

**NIM**:
Nomor Induk Mahasiswa, the Student's student number; SIX's page paths carry it.
_Avoid_: student ID

**Term**:
SIX's code for a semester: `YYYY-1` (odd), `YYYY-2` (even), `YYYY-3` (short semester), e.g. 2026-1. It maps to an Edunex Period.
_Avoid_: Period (that's Edunex's entity)

**Class**:
A course's section in SIX, "Kelas", e.g. 01.
_Avoid_: course (the course is what the class teaches)

**Class session**:
"Pertemuan", one scheduled meeting of a Class in SIX's timetable.
_Avoid_: lecture, meeting (in code identifiers)

**KRS**:
"Rencana Studi": the term's study plan, the Classes a Student takes, approved by their academic advisor. Read-only in the app.
_Avoid_: course registration

**DRS / URS**:
The windows in ITB's academic calendar for the KRS: DRS (Pengisian Rencana Studi) to fill it in, URS (also called PRS) to change it.

**SKS**:
Satuan Kredit Semester, credit units. The normal load is 20 SKS a term, up to 24 with the advisor's approval.
_Avoid_: credits in Indonesian copy (SKS stays as is)

**IP / IPK**:
Indeks Prestasi, the term GPA, and Indeks Prestasi Kumulatif, the cumulative GPA, on a 4.00 scale. For a retaken course only the newest grade counts.
_Avoid_: GPA in Indonesian copy

**Kehadiran**:
SIX's attendance percentage per Class, with the exact count in a tooltip: "Hadir X dari Y pertemuan" (present at X of Y Class sessions). ITB has no institute-wide minimum; each course contract sets one. The app's default target is 80%, editable, and a course can have its own target (from its contract). "Absences left" counts only meetings sure to come: a class SIX still lists in a UTS or UAS week or on a holiday may not run, so it isn't counted.
_Avoid_: Presence (that's the Edunex feature)

**Absence budget**:
"Jatah absen" ("Absences" on screen in English): the absences a course's target allows this term, the ones already missed plus the ones left, from SIX's count and the meetings sure to come. Presensi groups courses by it (absences to spare, no absences left, can't reach the target anymore) and draws it as a short bar, one segment per absence. Before SIX has a count it's estimated from the timetable alone. A class on now is neither held nor still to come until SIX counts it, so the budget can lose a segment during class and get it back once SIX counts it.
_Avoid_: "allowance", "skips"

**Tandai Hadir**:
SIX's own "mark present" button. During a class, the class's popup on SIX's timetable (Jadwal, then click the class) can show it; the Student presses it to be counted present in SIX's Kehadiran. While a class is on, the app reads that popup every 2 minutes and tells the Student when the button shows, and opens SIX on it; it never presses it. Kept as SIX's words in English copy too: it's what the Student looks for in SIX.
_Avoid_: check-in, self-attendance

**UKT**:
Uang Kuliah Tunggal, the single tuition fee paid each term.

**Bill**:
A term's UKT invoice in SIX (Status Keuangan): amount billed and paid, status, payment deadline and any instalments.
_Avoid_: invoice in code identifiers

**Kalender Pendidikan**:
ITB's academic calendar (a public calendar feed linked from SIX's home page): lecture period, UTS/UAS weeks, DRS/URS windows, the UKT deadline, the questionnaire window, the grade deadline and progress checks.
_Avoid_: "the schedule" (that's the Student's timetable)

**Peraturan Akademik**:
ITB's academic regulations. Honors need IPK ≥ 3.50 (cum laude), ≥ 3.75 (magna cum laude), or ≥ 3.85 with no retaken course (summa cum laude), all within 9 semesters. Progress checks expect 24/48/72/96/120 SKS by the end of years 1–5.
