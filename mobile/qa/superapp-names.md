# One name per thing

The 13 pairs `superapp-journeys.md` found ("Names that change"), each with the one name the phone now says, in
Indonesian and English, and the keys that carry it. Phone-only words are in `phoneWording` (`src/core/strings/mobile.ts`),
so the desktop keeps its own where its name is right for it. `test/mobile/one-name.test.ts` keeps each pair together.

| Thing | The one name (ID / EN) | Keys | What changed tonight |
| --- | --- | --- | --- |
| The Tugas tab and its page | **Tugas** / **Tasks** | `mobile.tab.tasks`, `nav.tasks` (phone), `mobile.course.tab.tasks`, `task.backToTasks` ("Ke Tugas" / "Go to Tasks", phone) | `nav.tasks` and `task.backToTasks` said "Tugas & Ujian" on the phone. The desktop's sidebar keeps "Tugas & Ujian" |
| The Kuliah tab | **Kuliah** / **Courses** | `mobile.tab.courses` | Search no longer lists the desktop's "Presensi" page: it lists the phone's services by their tile names. "Presensi" (`nav.presence`) stays the name of the presence service on Semua layanan |
| Akademik | gone as a tab: **Akademik** names Profil's group only; the plan screen is **Rencana studi** / **Study plan**, its tile **Rencana** | `mobile.tab.academic`, `nav.plan`, `plan.tab.planner` | Nothing: the tab left with the frame. The tile's one word is the short form of the screen's name |
| The list to handle | **Perlu kamu urus** / **To handle** | `mobile.home.toHandle`, `home.needs` (phone), `mobile.service.needs` | `home.needs` said "Perlu perhatianmu" (TalkBack, the widget's heading), the service "Urusan" |
| Profil's KRS and UKT chips | **Urusan akademik** / **Academic to-dos** | `mobile.academic.todo` | Said "Perlu kamu urus", the same as Beranda's different list |
| Kuliah's courses at risk | **Perlu perhatian** / **Needs attention** | `mobile.kuliah.attention` | Nothing: a different list, already its own name |
| What changed | **Notifikasi** / **Notifications** | `alerts.title`, `home.changes` (phone) | `home.changes` said "Yang berubah" for the bell's own history |
| A grade | **Nilai** for the grades screen; in a course, the tab **Nilai** and its heading **Nilai di Edunex** | `nav.grades`, `course.tab.grades`, `grade.edunex` | Nothing yet: "Nilai di Edunex" is too long for the course's fifth tab (see below) |
| Handing in | **Terkumpul** / **Submitted** | `taskStatus.submitted`, `handIn.final` (phone: "Sudah terkumpul…" / "Submitted…") | `handIn.final` said "Sudah diserahkan" / "Handed in" |
| Done vs handed in | **Selesai** is the segment, **Terkumpul** a group inside it | `tasks.filter.done`, `tasks.group.submitted` | Nothing: two things (done holds handed in and closed), each named once |
| Presence | **Isi Presensi** / **Fill in Presence** on the app's own button; **Tandai Hadir** is SIX's button, named as SIX writes it | `home.now.edunexStep`, `mobile.notification.checkIn` | Nothing: the notification's and the widgets' "Tandai Hadir" opens SIX's own button (see below) |
| The window's end | **tutup {time}** / **closes {time}** for the Presence window | `home.need.presence.closes`; `presence.row.now` is the class's end, a different time | Nothing in the words: the card that shows both is Kuliah's (see below) |
| Material | **Materi** / **Materials** | `mobile.course.tab.material`, `search.group.material`, `mobile.search.placeholder` | The course's tab said "Modul", the search hint and the new Materi tile "Materi". One module is still "Modul" (`mobile.course.newestModule`) |
| Calendars | **Jadwal** (the week), **Jadwal bulanan** / **Monthly schedule** (the month view; search finds it by "bulan", "sebulan", "kalender", "month" too), **Kalender akademik** (its tile **Kalender**) | `nav.schedule`, `mobile.service.month`, `mobile.schedule.month` ("Lihat jadwal bulanan"), `plan.tab.deadlines`, `mobile.service.calendar` | The month view's tile said "Bulanan", its menu item "Lihat sebulan" |
| A course's fifth tab | **Info** / **News** (its announcements) | `mobile.course.tab.news` (phone) | Said "Pengumuman" / "Announcements" (`course.tab.announcements`, the desktop keeps it): short, so the five tabs fit a phone's width with none cut |
| A class | **kelas** for a class on Beranda's free line; **Kuliah** is the tab | `mobile.home.free` | Said "Tak ada kuliah", the tab's word |

## Left for a screen's owner

- **Presence button:** the decisions say "Isi Presensi" everywhere, but `mobile.notification.checkIn` ("Tandai Hadir") is
  also the widgets' label for SIX's own check-in button (`test/mobile/widget-model*.test.ts` hold it). The Widgets owner
  decides whether SIX's button keeps SIX's name.
- **A course's grades tab:** "Nilai di Edunex" for `course.tab.grades` would tell it apart from the grades screen, but
  five tabs share the course page's width (`mobile/src/screens/course/course-screen.tsx:54`). Kuliah's owner decides.
- **The window's end:** one class card says "tutup {time}" and "Sedang berlangsung sampai {time}": Kuliah's owner keeps
  the one that matters (the window's close while a Presence is open).
- **Semua layanan:** settled (11 Nov): it no longer lists "Kuliah"; "Presensi" (`presence`) is the one tile to the Kuliah
  tab (`mobile/src/screens/services/list.ts`).
