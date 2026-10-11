// PROTOTYPE (#83) — throwaway. The feature map: every feature of v2, the
// problem it solves in today's EduNex + SIX (with evidence from the recorded
// account), what the app does instead, where the data comes from, and a link
// to see it working. This is the product brief the prototype stands for.
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import type { Screen } from "./params";
import { attendanceHealth, clashes, examsOf, graduationPath, honorsPath, offTimetable, taskSignals } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import { SourceTag, cx, ui, useDSettings } from "./variant-d-ui";

type Source = "SIX" | "EduNex" | "ITB";
type Scope = "new" | "expanded" | "spec";

interface Feature {
  name: string;
  problem: string;
  /** A fact from the recorded account that shows the problem is real. */
  evidence: string;
  does: string;
  sources: Source[];
  scope: Scope;
  see: { screen: Screen; course?: string; task?: string; tab?: string; overlay?: string };
}

interface Pillar {
  title: string;
  lead: string;
  features: Feature[];
}

const SCOPE_TONE: Record<Scope, string> = {
  new: "bg-[#e3f5ea] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]",
  expanded: "bg-[#e6eefe] text-[#2f5fc4] dark:bg-[#1b2742] dark:text-[#9ab8ff]",
  spec: "bg-[#f0f0f2] text-[#55555c] dark:bg-[#27272b] dark:text-[#b9b9c1]",
};

export function FeatureMap(p: VariantProps) {
  const { data, now, f, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const health = data.courses.map((c) => attendanceHealth(data, c.code, now, f, attendanceTarget));
  const out = health.filter((h) => h.state === "out");
  const last = health.filter((h) => h.state === "last");
  const misleading = health.find((h) => h.edunexMisleading);
  const clash = clashes(data, now, f)[0];
  const exam = examsOf(data).find((e) => e.source === "SIX" && e.start);
  const takeHome = data.tasks.find((t) => t.domain === "uts");
  const hidden = offTimetable(data, f).find((m) => new Date(m.end) > now);
  const viaTask = data.presence.find((x) => x.taskId);
  const sigs = data.tasks.map((t) => ({ t, s: taskSignals(data, t, now) }));
  const edited = sigs.filter((x) => x.s.editedAt);
  const afterSubmit = sigs.filter((x) => x.s.editedAfterSubmit);
  const longDraft = sigs.map((x) => x.s.draftDays ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const shortTask = sigs.find((x) => x.s.shortNotice);
  const path = graduationPath(data);
  const leftSks = path.inProgress + path.requiredLeft.reduce((s, c) => s + c.sks, 0);
  const cum = honorsPath(data, leftSks).find((h) => h.key === "cum");
  const unread = data.notices.filter((n) => !n.read).length;
  const unannounced = data.tasks.filter((t) => !data.notices.some((n) => n.taskId === t.id)).length;
  const firstSurvey = data.academicCalendar.find((e) => e.key === "survey");

  const pillars: Pillar[] = [
    {
      title: tr({ en: "1. Don't lose marks to logistics", id: "1. Jangan kehilangan nilai karena urusan teknis" }),
      lead: tr({
        en: "Attendance, deadlines and exams are split between two systems that never warn you. The app watches both and tells you in time.",
        id: "Kehadiran, tenggat, dan ujian terpecah di dua sistem yang tidak pernah memperingatkan. Aplikasi memantau keduanya dan memberi tahu tepat waktu.",
      }),
      features: [
        {
          name: tr({ en: "Attendance in the right place", id: "Presensi di tempat yang benar" }),
          problem: tr({
            en: "Some lecturers count attendance in SIX. EduNex counts it only if you do the activity the lecturer picked, inside the window: open the course material, hand in a task, join the Vicon. Miss it and EduNex says \"Absent\", even when SIX counted you.",
            id: "Sebagian dosen mencatat di SIX. EduNex hanya menghitung jika kamu melakukan aktivitas pilihan dosen di dalam jendela waktu: membuka materi, mengumpulkan tugas, bergabung Vicon. Terlewat, EduNex menulis \"Absent\", walau SIX menghitungmu.",
          }),
          evidence: misleading
            ? tr({
                en: `${misleading.code}: EduNex marks ${misleading.edunexMarked} of ${misleading.edunexPast} (material not opened during class), SIX counts ${misleading.attended} of ${misleading.held}.${viaTask ? ` ${viaTask.courseCode}'s Friday sessions count only by handing in the task, 15:00–23:59.` : ""}`,
                id: `${misleading.code}: EduNex menandai ${misleading.edunexMarked} dari ${misleading.edunexPast} (materi tidak dibuka selama kuliah), SIX menghitung ${misleading.attended} dari ${misleading.held}.${viaTask ? ` Sesi Jumat ${viaTask.courseCode} hanya terhitung lewat pengumpulan tugas, 15:00–23:59.` : ""}`,
              })
            : "",
          does: tr({
            en: "Tells you, per session, where it counts and the exact action EduNex wants, alerts when the window opens, opens the right official page, and checks afterwards that you were counted.",
            id: "Memberi tahu, per sesi, di mana dihitung dan aksi persis yang diminta EduNex, mengingatkan saat jendela dibuka, membuka halaman resmi yang tepat, lalu memeriksa bahwa kamu tercatat.",
          }),
          sources: ["SIX", "EduNex"],
          scope: "expanded",
          see: { screen: "presence" },
        },
        {
          name: tr({ en: "Absences left", id: "Sisa jatah absen" }),
          problem: tr({
            en: "SIX shows a percentage and turns it red. It never says how many more you can miss, or when it's already too late.",
            id: "SIX hanya menampilkan persentase dan mewarnainya merah. Tidak pernah bilang berapa kali lagi boleh absen, atau kapan sudah terlambat.",
          }),
          evidence: tr({
            en: `${out.map((h) => `${h.code} can't reach ${attendanceTarget}% anymore (${h.attended}/${h.held}, best ${Math.round((h.best ?? 0) * 100)}%)`).join("; ")}${out.length && last.length ? "; " : ""}${last.length ? `no absences left in ${last.map((h) => h.code).join(" and ")}` : ""}.`,
            id: `${out.map((h) => `${h.code} tak bisa lagi capai ${attendanceTarget}% (${h.attended}/${h.held}, maks. ${Math.round((h.best ?? 0) * 100)}%)`).join("; ")}${out.length && last.length ? "; " : ""}${last.length ? `tidak boleh absen lagi di ${last.map((h) => h.code).join(" dan ")}` : ""}.`,
          }),
          does: tr({
            en: "Counts meetings left from SIX's timetable and ITB's calendar, and shows absences left, best case, and a warning before it's too late.",
            id: "Menghitung sisa pertemuan dari jadwal SIX dan kalender ITB, lalu menampilkan sisa jatah absen, nilai terbaik, dan peringatan sebelum terlambat.",
          }),
          sources: ["SIX", "ITB"],
          scope: "new",
          see: { screen: "presence" },
        },
        {
          name: tr({ en: "Clash check", id: "Cek bentrok jadwal" }),
          problem: tr({ en: "SIX accepts a KRS with overlapping classes and never mentions it.", id: "SIX menerima KRS dengan jadwal bentrok tanpa pernah menyebutnya." }),
          evidence: clash
            ? tr({
                en: `${clash.codes[0]} and ${clash.codes[1]} overlap every ${clash.weekday} ${clash.from}–${clash.to}. They're your two lowest-attendance courses.`,
                id: `${clash.codes[0]} dan ${clash.codes[1]} bentrok tiap ${clash.weekday} ${clash.from}–${clash.to}. Keduanya mata kuliah dengan kehadiran terendahmu.`,
              })
            : "",
          does: tr({
            en: "Flags clashes in this semester's timetable, and checks next semester's plan the day programs publish class times.",
            id: "Menandai bentrok di jadwal semester ini, dan memeriksa rencana semester depan begitu prodi menerbitkan jadwal kelas.",
          }),
          sources: ["SIX"],
          scope: "new",
          see: { screen: "schedule" },
        },
        {
          name: tr({ en: "What changed", id: "Apa yang berubah" }),
          problem: tr({
            en: "Lecturers move rooms and times, edit tasks and add meetings. Neither system tells you; EduNex's own feed even skips most tasks.",
            id: "Dosen memindah ruang dan jam, mengubah tugas, dan menambah pertemuan. Tidak ada sistem yang memberi tahu; feed EduNex bahkan melewatkan sebagian besar tugas.",
          }),
          evidence: tr({
            en: `${edited.length} tasks edited after posting, ${afterSubmit.length} after you submitted. ${unannounced} of ${data.tasks.length} tasks never appeared in EduNex's notifications.${hidden ? ` ${hidden.courseCode}'s meeting on ${f.weekdayShort(hidden.start)} ${f.dayMonth(hidden.start)} exists only in a parent-class text.` : ""}`,
            id: `${edited.length} tugas diubah setelah diunggah, ${afterSubmit.length} setelah kamu kumpulkan. ${unannounced} dari ${data.tasks.length} tugas tidak pernah muncul di notifikasi EduNex.${hidden ? ` Pertemuan ${hidden.courseCode} ${f.weekdayShort(hidden.start)} ${f.dayMonth(hidden.start)} hanya ada di teks kelas induk.` : ""}`,
          }),
          does: tr({
            en: "Compares every sync with the last one across both systems and shows the before and after, with an alert when it matters.",
            id: "Membandingkan tiap sinkronisasi dengan sebelumnya di kedua sistem dan menunjukkan sebelum-sesudahnya, dengan notifikasi saat penting.",
          }),
          sources: ["SIX", "EduNex"],
          scope: "expanded",
          see: { screen: "today" },
        },
        {
          name: tr({ en: "Exams in one place", id: "Ujian di satu tempat" }),
          problem: tr({
            en: "In-class exams and rooms are only in SIX's month grid. Take-home exams and the material are in EduNex. EduNex's Exams page is empty.",
            id: "Ujian di kelas dan ruangnya hanya di kalender bulanan SIX. Ujian take-home dan materinya di EduNex. Halaman Exams EduNex kosong.",
          }),
          evidence:
            exam?.start && takeHome?.dueAt
              ? tr({
                  en: `${exam.kind} ${exam.courseCode}: SIX says ${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)} in ${exam.room}; EduNex has a take-home due ${f.weekdayShort(takeHome.dueAt)} ${f.dayMonth(takeHome.dueAt)}.`,
                  id: `${exam.kind} ${exam.courseCode}: SIX bilang ${f.weekdayShort(exam.start)} ${f.dayMonth(exam.start)} di ${exam.room}; EduNex punya take-home tenggat ${f.weekdayShort(takeHome.dueAt)} ${f.dayMonth(takeHome.dueAt)}.`,
                })
              : "",
          does: tr({
            en: "One exam list from SIX, EduNex and ITB's exam weeks; a prep page with time, room, related tasks, material saved offline, and your attendance standing.",
            id: "Satu daftar ujian dari SIX, EduNex, dan masa ujian ITB; halaman persiapan dengan jam, ruang, tugas terkait, materi tersimpan offline, dan posisi kehadiranmu.",
          }),
          sources: ["SIX", "EduNex", "ITB"],
          scope: "new",
          see: { screen: "exam" },
        },
        {
          name: tr({ en: "Deadlines you can trust", id: "Tenggat yang bisa dipercaya" }),
          problem: tr({
            en: "EduNex's \"Save Answer\" isn't handing in, so drafts get forgotten. Its To Do times are off by 7 hours. Short in-class tasks appear without warning.",
            id: "\"Save Answer\" di EduNex bukan mengumpulkan, jadi draf terlupa. Jam di To Do-nya meleset 7 jam. Tugas singkat di kelas muncul tanpa peringatan.",
          }),
          evidence: tr({
            en: `One answer sat as a draft for ${longDraft} days before it was submitted.${shortTask ? ` "${shortTask.t.title}" was open for only ${Math.round((Date.parse(shortTask.t.dueAt!) - Date.parse(shortTask.t.opensAt!)) / 3_600_000)} hours.` : ""}`,
            id: `Satu jawaban jadi draf ${longDraft} hari sebelum dikumpulkan.${shortTask ? ` "${shortTask.t.title}" hanya dibuka ${Math.round((Date.parse(shortTask.t.dueAt!) - Date.parse(shortTask.t.opensAt!)) / 3_600_000)} jam.` : ""}`,
          }),
          does: tr({
            en: "True status from the server, loud draft warnings, reminders only if not submitted, hand-in with a checked receipt, and the task's full history.",
            id: "Status asli dari server, peringatan draf yang jelas, pengingat hanya jika belum dikumpulkan, pengumpulan dengan bukti terverifikasi, dan riwayat lengkap tugas.",
          }),
          sources: ["EduNex"],
          scope: "spec",
          see: { screen: "task", task: afterSubmit[0]?.t.id ?? data.tasks[0]?.id },
        },
      ],
    },
    {
      title: tr({ en: "2. Know where you stand", id: "2. Tahu posisimu" }),
      lead: tr({
        en: "The official screens show placeholders and raw tables. The app turns them into answers.",
        id: "Layar resmi menampilkan angka pengisi dan tabel mentah. Aplikasi mengubahnya jadi jawaban.",
      }),
      features: [
        {
          name: tr({ en: "Honest grades", id: "Nilai yang jujur" }),
          problem: tr({
            en: "EduNex's gradebook shows \"0.00 · E\" until it's published and hides task scores. SIX shows a grade only after the semester, and only once the questionnaire is filled.",
            id: "Buku nilai EduNex menampilkan \"0.00 · E\" sampai dirilis dan menyembunyikan nilai tugas. SIX hanya menampilkan nilai setelah semester, dan setelah kuesioner diisi.",
          }),
          evidence: tr({
            en: `All ${data.courses.length} courses show "0.00 · E" today.${firstSurvey ? ` Questionnaire window: ${f.dayMonth(firstSurvey.start)}–${f.dayMonth(firstSurvey.end)}.` : ""}`,
            id: `Semua ${data.courses.length} mata kuliah menampilkan "0.00 · E" hari ini.${firstSurvey ? ` Jendela kuesioner: ${f.dayMonth(firstSurvey.start)}–${f.dayMonth(firstSurvey.end)}.` : ""}`,
          }),
          does: tr({
            en: "Hides the placeholder, collects published scores, and with the weights from your course contract shows what you need on what's left. Reminds you of the questionnaire.",
            id: "Menyembunyikan angka pengisi, mengumpulkan nilai yang dirilis, dan dengan bobot dari kontrak kuliah menunjukkan nilai yang dibutuhkan. Mengingatkan kuesioner.",
          }),
          sources: ["EduNex", "SIX", "ITB"],
          scope: "new",
          see: { screen: "course", course: out[0]?.code ?? data.courses[0]?.code, tab: "grades" },
        },
        {
          name: tr({ en: "Honors path", id: "Jalan menuju predikat" }),
          problem: tr({ en: "SIX shows your IPK, not what it takes to reach cum laude.", id: "SIX menampilkan IPK, bukan apa yang dibutuhkan untuk cum laude." }),
          evidence:
            cum?.needAvg != null
              ? tr({
                  en: `IPK ${data.student.ipk?.toFixed(2)} now. Cum laude (≥ 3.50) needs about ${cum.needAvg.toFixed(2)} over your last ${leftSks} SKS.`,
                  id: `IPK ${data.student.ipk?.toFixed(2)} sekarang. Cum laude (≥ 3,50) butuh rata-rata ${cum.needAvg.toFixed(2)} di ${leftSks} SKS terakhir.`,
                })
              : "",
          does: tr({
            en: "Projects your graduation IPK from the grades you expect, using ITB's honors rules.",
            id: "Memproyeksikan IPK kelulusan dari nilai yang kamu perkirakan, memakai aturan predikat ITB.",
          }),
          sources: ["SIX", "ITB"],
          scope: "expanded",
          see: { screen: "grades" },
        },
      ],
    },
    {
      title: tr({ en: "3. Plan to graduation", id: "3. Rencanakan sampai lulus" }),
      lead: tr({
        en: "Your curriculum, transcript and ITB's calendar, combined into a plan instead of four separate pages.",
        id: "Kurikulum, transkrip, dan kalender ITB digabung jadi rencana, bukan empat halaman terpisah.",
      }),
      features: [
        {
          name: tr({ en: "Study planner", id: "Perencana studi" }),
          problem: tr({
            en: "SIX shows what you've taken and a 24-SKS limit; the course catalog is a separate public site. Planning every semester until graduation, and the grades a target IPK needs, means juggling all of it by hand.",
            id: "SIX menampilkan mata kuliah yang sudah diambil dan batas 24 SKS; katalog mata kuliah ada di situs publik terpisah. Merencanakan tiap semester sampai lulus, dan nilai yang dibutuhkan untuk target IPK, harus dikerjakan manual.",
          }),
          evidence: tr({
            en: `${path.passed + path.inProgress} of ${path.target} SKS after this semester; ${path.requiredLeft.map((c) => c.name).join(" and ")} still to take, and Kerja Praktik is a semester-7 (odd) course you'd now take in an even semester.${cum?.needAvg != null ? ` Cum laude needs about ${cum.needAvg.toFixed(2)} over the last ${leftSks} SKS.` : ""}`,
            id: `${path.passed + path.inProgress} dari ${path.target} SKS setelah semester ini; ${path.requiredLeft.map((c) => c.name).join(" dan ")} belum diambil, dan Kerja Praktik adalah mata kuliah semester 7 (ganjil) yang kini akan diambil di semester genap.${cum?.needAvg != null ? ` Cum laude butuh rata-rata ${cum.needAvg.toFixed(2)} di ${leftSks} SKS terakhir.` : ""}`,
          }),
          does: tr({
            en: "Every course in SIX's catalog (3,202 across ITB). Add and remove courses semester by semester while required courses, electives, specialization, minors, SKS limits and odd/even semesters are checked live. Expected grades project your IPK, show what a target needs, and include retakes.",
            id: "Semua mata kuliah di katalog SIX (3.202 se-ITB). Tambah dan hapus mata kuliah per semester sambil mata kuliah wajib, pilihan, spesialisasi, minor, batas SKS, dan semester ganjil/genap dicek langsung. Nilai perkiraan memproyeksikan IPK, menunjukkan kebutuhan target, termasuk mengulang mata kuliah.",
          }),
          sources: ["SIX", "ITB"],
          scope: "new",
          see: { screen: "academic" },
        },
        {
          name: tr({ en: "Academic deadlines", id: "Tenggat akademik" }),
          problem: tr({
            en: "DRS, URS, UKT, the questionnaire and exam weeks live in a PDF calendar. Missing UKT blocks your KRS; missing the questionnaire hides your grades.",
            id: "DRS, URS, UKT, kuesioner, dan masa ujian ada di kalender PDF. Telat UKT menahan KRS; lupa kuesioner menyembunyikan nilai.",
          }),
          evidence: tr({
            en: `${data.academicCalendar.filter((e) => new Date(e.end) >= now).length} official dates still ahead this academic year.`,
            id: `${data.academicCalendar.filter((e) => new Date(e.end) >= now).length} tanggal resmi masih akan datang tahun akademik ini.`,
          }),
          does: tr({
            en: "Reads ITB's calendar feed and turns each date into what you need to do, with reminders.",
            id: "Membaca feed kalender ITB dan mengubah tiap tanggal jadi hal yang perlu kamu lakukan, dengan pengingat.",
          }),
          sources: ["ITB", "SIX"],
          scope: "new",
          see: { screen: "academic", tab: "calendar" },
        },
      ],
    },
    {
      title: tr({ en: "4. The basics, done properly", id: "4. Dasar yang dikerjakan dengan benar" }),
      lead: tr({ en: "What every student expects, and the official sites don't do.", id: "Yang diharapkan tiap mahasiswa, dan tidak dilakukan situs resmi." }),
      features: [
        {
          name: tr({ en: "One course page", id: "Satu halaman mata kuliah" }),
          problem: tr({
            en: "A course is split: rooms, SKS and attendance in SIX; modules, tasks and files in EduNex, sometimes in a separate parent class.",
            id: "Satu mata kuliah terpecah: ruang, SKS, dan kehadiran di SIX; modul, tugas, dan berkas di EduNex, kadang di kelas induk terpisah.",
          }),
          evidence: tr({
            en: "II4091's Teams links and updated schedule exist only in its parent class.",
            id: "Link Teams dan jadwal terbaru II4091 hanya ada di kelas induknya.",
          }),
          does: tr({
            en: "EduNex's outline with SIX's meetings, rooms and attendance on one page, parent and child classes merged.",
            id: "Daftar isi EduNex dengan pertemuan, ruang, dan kehadiran SIX di satu halaman, kelas induk dan anak digabung.",
          }),
          sources: ["SIX", "EduNex"],
          scope: "spec",
          see: { screen: "course", course: "II4091", tab: "meetings" },
        },
        {
          name: tr({ en: "Files offline, calendar on your phone", id: "Berkas offline, kalender di HP" }),
          problem: tr({
            en: "EduNex makes you open every module to download one file at a time. Your phone doesn't know your classes or deadlines.",
            id: "EduNex mengharuskan membuka tiap modul untuk mengunduh satu per satu. HP-mu tidak tahu jadwal dan tenggatmu.",
          }),
          evidence: tr({
            en: `SIX already publishes your timetable as a calendar feed${data.sixCalendarFeed ? "" : " (not found)"}, but nobody tells you; EduNex deadlines aren't in it.`,
            id: `SIX sebenarnya menerbitkan jadwalmu sebagai feed kalender${data.sixCalendarFeed ? "" : " (tidak ditemukan)"}, tapi tidak ada yang memberi tahu; tenggat EduNex tidak ada di sana.`,
          }),
          does: tr({
            en: "Saves every course file by course and module, readable offline. One calendar feed with classes, rooms, exams and deadlines for your phone.",
            id: "Menyimpan semua berkas per mata kuliah dan modul, bisa dibaca offline. Satu feed kalender berisi kuliah, ruang, ujian, dan tenggat untuk HP.",
          }),
          sources: ["EduNex", "SIX"],
          scope: "expanded",
          see: { screen: "exam" },
        },
        {
          name: tr({ en: "Notifications that respect you", id: "Notifikasi yang menghargaimu" }),
          problem: tr({
            en: "EduNex has no push alerts and marks items read when you open the page; its badge is stuck. SIX has none at all.",
            id: "EduNex tidak punya notifikasi push dan menandai dibaca saat halaman dibuka; badge-nya macet. SIX tidak punya sama sekali.",
          }),
          evidence: tr({ en: `EduNex's badge shows ${unread} unread, including tasks you already submitted.`, id: `Badge EduNex menunjukkan ${unread} belum dibaca, termasuk tugas yang sudah dikumpulkan.` }),
          does: tr({
            en: "Desktop alerts for everything above, grouped, quiet at night, never marking anything read on the official sites.",
            id: "Notifikasi desktop untuk semua di atas, dikelompokkan, tenang di malam hari, tanpa menandai apa pun dibaca di situs resmi.",
          }),
          sources: ["EduNex", "SIX"],
          scope: "spec",
          see: { screen: "today", overlay: "inbox" },
        },
      ],
    },
  ];

  const open = (see: Feature["see"]) => go(see.screen, { course: see.course, task: see.task, tab: see.tab, overlay: see.overlay });

  return (
    <div className={cx("relative h-screen overflow-y-auto bg-[#f5f5f7] dark:bg-[#121214]", ui.text)}>
      <TrafficLights />
      <div className="mx-auto max-w-[920px] px-8 pt-16 pb-24">
        <p className={cx("text-[13px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>Edunex Plus v2 · {tr({ en: "feature map", id: "peta fitur" })}</p>
        <h1 className="mt-3 text-[32px] leading-[1.15] font-semibold tracking-[-0.025em]">
          {tr({
            en: "EduNex and SIX hold the data. Neither tells you what it means for you.",
            id: "EduNex dan SIX menyimpan datanya. Tidak ada yang memberi tahu artinya untukmu.",
          })}
        </h1>
        <p className={cx("mt-3 max-w-[720px] text-[15px] leading-[1.6]", ui.muted)}>
          {tr({
            en: "Edunex Plus reads both, plus ITB's academic calendar, and tells you what needs you, what changed, and where you stand, before it costs you marks. Every fact below comes from one real account's recordings.",
            id: "Edunex Plus membaca keduanya, ditambah kalender akademik ITB, lalu memberi tahu apa yang perlu kamu urus, apa yang berubah, dan posisimu, sebelum merugikan nilaimu. Semua fakta di bawah berasal dari rekaman satu akun asli.",
          })}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => go("signin")} className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold", ui.primary, ui.focus)}>
            {tr({ en: "Start from first run", id: "Mulai dari awal" })}
            <Icons.ChevronRight className="size-4" />
          </button>
          <button onClick={() => go("today")} className={cx("inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold", ui.secondary, ui.focus)}>
            {tr({ en: "Open the app", id: "Buka aplikasi" })}
          </button>
          <span className={cx("ml-2 flex items-center gap-2 text-[12px]", ui.faint)}>
            <span className={cx("rounded px-1.5 py-0.5 font-semibold", SCOPE_TONE.new)}>{tr({ en: "New", id: "Baru" })}</span>
            <span className={cx("rounded px-1.5 py-0.5 font-semibold", SCOPE_TONE.expanded)}>{tr({ en: "Expanded", id: "Diperluas" })}</span>
            <span className={cx("rounded px-1.5 py-0.5 font-semibold", SCOPE_TONE.spec)}>{tr({ en: "Already in spec #68", id: "Sudah di spec #68" })}</span>
          </span>
        </div>

        {pillars.map((pillar) => (
          <section key={pillar.title} className="mt-12">
            <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{pillar.title}</h2>
            <p className={cx("mt-1 text-[14px]", ui.muted)}>{pillar.lead}</p>
            <ul className="mt-4 space-y-3">
              {pillar.features.map((x) => (
                <li key={x.name} className={cx("overflow-hidden", ui.card)}>
                  <div className="flex items-start justify-between gap-4 px-5 pt-4">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      {x.name}
                      <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold", SCOPE_TONE[x.scope])}>
                        {x.scope === "new" ? tr({ en: "New", id: "Baru" }) : x.scope === "expanded" ? tr({ en: "Expanded", id: "Diperluas" }) : "#68"}
                      </span>
                    </p>
                    <span className="flex shrink-0 gap-1">
                      {x.sources.map((s) => (
                        <SourceTag key={s} source={s} />
                      ))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 px-5 pt-2.5 pb-4 text-[13px] leading-[1.55]">
                    <div>
                      <p className={cx("text-[11.5px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>{tr({ en: "Today", id: "Saat ini" })}</p>
                      <p className="mt-1">{x.problem}</p>
                      {x.evidence && (
                        <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#fdf6e3] px-3 py-2 text-[12.5px] text-[#5c3d00] dark:bg-[#2e2510] dark:text-[#f2d79a]">
                          <Icons.Search className="mt-0.5 size-3.5 shrink-0" />
                          <span>{x.evidence}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <p className={cx("text-[11.5px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>{tr({ en: "With Edunex Plus", id: "Dengan Edunex Plus" })}</p>
                      <p className="mt-1">{x.does}</p>
                      <button onClick={() => open(x.see)} className={cx("mt-2.5 inline-flex items-center gap-1 rounded text-[12.5px] font-semibold", ui.accentText, ui.focus)}>
                        {tr({ en: "See it", id: "Lihat" })}
                        <Icons.ArrowUpRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className={cx("mt-12 rounded-xl px-5 py-4", ui.fill)}>
          <h2 className="text-[15px] font-semibold">{tr({ en: "What it will never do", id: "Yang tidak akan pernah dilakukan" })}</h2>
          <ul className={cx("mt-2 list-disc space-y-1 pl-5 text-[13px] leading-[1.55]", ui.muted)}>
            <li>{tr({ en: "Mark attendance, send a KRS or grab class seats for you. It opens the official page; you press the button.", id: "Menandai presensi, mengirim KRS, atau merebut kursi kelas untukmu. Aplikasi membuka halaman resmi; kamu yang menekan tombolnya." })}</li>
            <li>{tr({ en: "Submit anything without your click. The only writes are saving and handing in your own Task answers.", id: "Mengumpulkan apa pun tanpa klikmu. Satu-satunya yang ditulis hanyalah menyimpan dan mengumpulkan jawaban tugasmu." })}</li>
            <li>{tr({ en: "See your password, or read SIX's control panel and personal records.", id: "Melihat kata sandimu, atau membaca control panel dan data pribadi SIX." })}</li>
            <li>{tr({ en: "Hit the official servers faster than a person would.", id: "Mengakses server resmi lebih cepat dari manusia." })}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
