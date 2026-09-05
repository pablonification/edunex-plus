# EduNex Desktop

A cross-platform desktop client for ITB's EduNex LMS, wrapping the platform's internal API with a purpose-built UI. This glossary defines the domain language shared by all project decisions and code.

## Language

### Platform

**EduNex**:
ITB's learning management system at edunex.itb.ac.id; a homegrown Vue.js SPA built by vendor Cognisia. Not Moodle/Open edX/Sakai.
_Avoid_: "the LMS site", Edunex/edunex in prose (capital E, one word: EduNex)

**Edunex Plus**:
This project's product mark — the unofficial desktop client. Lowercase-n styling is deliberate, to stay distinct from Cognisia's EduNex trademark; never apply the "Edunex Plus" mark to EduNex itself.
_Avoid_: "EduNEX Plus", "EdunexPlus"

**Cognisia**:
The vendor that builds and operates EduNex; hosts the API under its own domain (api-edunex.cognisia.id).
_Avoid_: "ITB's servers" (the API is vendor-hosted)

**INA account**:
A student's or lecturer's Microsoft (Azure AD/Entra) ITB account used for SSO login to EduNex.
_Avoid_: "ITB email", "SSO password"

**Period**:
A semester/term entity in EduNex that scopes courses, RPS, and scheduling.
_Avoid_: semester (use Period when referring to the API entity)

### Roles

**Student**, **Lecturer**:
The two EduNex user levels relevant to the desktop client; one human can hold several accounts (e.g. student + lecturer) and switch between them.
_Avoid_: user (ambiguous between human and account)

### Academic features

**RPS**:
Rencana Pembelajaran Semester — the semester lesson plan attached to a course.
_Avoid_: syllabus

**CPMK**:
Course learning outcomes (Capaian Pembelajaran Mata Kuliah) that structure a course's RPS.

**Vicon**:
EduNex's video-conferencing feature for online classes.
_Avoid_: Zoom (Zoom is one backend, Vicon is the feature)

**CRS**:
Class Response System — in-class polling/quizzing within EduNex.

**Presence**:
Attendance records for a class meeting.
_Avoid_: attendance (use Presence when referring to the EduNex feature)

**Task**:
An assignment in EduNex's API (course/tasks); distinct from an exam.
_Avoid_: assignment in code identifiers (collides with programming terms); use Task

**To Do**:
EduNex's aggregated list of pending items (tasks, exams) for the logged-in account.
_Avoid_: todo list in UI copy without the EduNex meaning
