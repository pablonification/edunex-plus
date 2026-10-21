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

### In the app

**Snooze**:
"Ingatkan nanti" (Remind me later): the Student puts a Beranda item or a course's attendance banner off until a moment that fits it ("Besok pagi", "Sehari sebelum tenggat", "Saat dibuka"). It always ends: at that moment, at the item's last useful moment, or when the item changes (a moved deadline, a new count, turning urgent), two weeks at most. Kept on this computer; OS notifications and the bell are not affected.
_Avoid_: dismiss, mute, "don't remind me again" (nothing is hidden for good)

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
