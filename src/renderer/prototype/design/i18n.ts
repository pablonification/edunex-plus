// PROTOTYPE (#83) — throwaway. Shared Indonesian / English copy and human
// time formatting. All times are shown in WIB (Asia/Jakarta), whatever the
// machine's own time zone is.

export type Lang = "en" | "id";

const STRINGS = {
  today: { en: "Today", id: "Hari ini" },
  tomorrow: { en: "Tomorrow", id: "Besok" },
  yesterday: { en: "Yesterday", id: "Kemarin" },
  tasks: { en: "Tasks", id: "Tugas" },
  courses: { en: "Courses", id: "Mata kuliah" },
  schedule: { en: "Schedule", id: "Jadwal" },
  grades: { en: "Grades", id: "Nilai" },
  settings: { en: "Settings", id: "Pengaturan" },
  search: { en: "Search", id: "Cari" },
  status_not_started: { en: "Not started", id: "Belum dikerjakan" },
  status_draft: { en: "Draft", id: "Draf" },
  status_submitted: { en: "Submitted", id: "Terkumpul" },
  status_overdue: { en: "Overdue", id: "Terlambat" },
  status_closed: { en: "Closed", id: "Ditutup" },
  status_in_review: { en: "In review", id: "Sedang dinilai" },
  presence_open: { en: "Presence open", id: "Presensi dibuka" },
  closes_in: { en: "Closes in", id: "Ditutup dalam" },
  open_in_edunex: { en: "Open in EduNex", id: "Buka di EduNex" },
  attended: { en: "Attended", id: "Hadir" },
  next_class: { en: "Next class", id: "Kelas berikutnya" },
  now: { en: "Now", id: "Sekarang" },
  in_progress: { en: "In progress", id: "Sedang berlangsung" },
  upcoming_deadlines: { en: "Upcoming deadlines", id: "Tenggat terdekat" },
  due: { en: "Due", id: "Tenggat" },
  classes_today: { en: "Classes today", id: "Kuliah hari ini" },
  no_classes_today: { en: "No classes today", id: "Tidak ada kuliah hari ini" },
  all_caught_up: { en: "All caught up", id: "Semua beres" },
  room: { en: "Room", id: "Ruang" },
  lecturer: { en: "Lecturer", id: "Dosen" },
  sks: { en: "SKS", id: "SKS" },
  attendance: { en: "Attendance", id: "Kehadiran" },
  class_no: { en: "Class", id: "Kelas" },
  materials: { en: "Materials", id: "Materi" },
  announcements: { en: "Announcements", id: "Pengumuman" },
  presence: { en: "Presence", id: "Presensi" },
  overview: { en: "Overview", id: "Ringkasan" },
  online_class: { en: "Online class", id: "Kelas daring" },
  join: { en: "Join", id: "Gabung" },
  instructions: { en: "Instructions", id: "Instruksi" },
  lecturer_files: { en: "Files from lecturer", id: "Berkas dari dosen" },
  your_answer: { en: "Your answer", id: "Jawabanmu" },
  attach_files: { en: "Attach files", id: "Lampirkan berkas" },
  drop_files: { en: "Drop files here", id: "Lepas berkas di sini" },
  save_draft: { en: "Save draft", id: "Simpan draf" },
  submit: { en: "Submit", id: "Kumpulkan" },
  submitted_on: { en: "Submitted", id: "Dikumpulkan" },
  file_required: { en: "File required", id: "Wajib unggah berkas" },
  late_allowed: { en: "Late submission allowed", id: "Boleh terlambat" },
  late_not_allowed: { en: "No late submission", id: "Tidak bisa terlambat" },
  score: { en: "Score", id: "Nilai" },
  draft_vs_submit: {
    en: "A draft is only visible to you. Submit to hand it in.",
    id: "Draf hanya terlihat olehmu. Kumpulkan untuk menyerahkan.",
  },
  synced: { en: "Synced", id: "Tersinkron" },
  offline: { en: "Offline", id: "Offline" },
  welcome: { en: "Welcome to Edunex Plus", id: "Selamat datang di Edunex Plus" },
  tagline: { en: "EduNex and SIX, together in one calm place.", id: "EduNex dan SIX, dalam satu tempat yang tenang." },
  connect_edunex: { en: "Connect EduNex", id: "Hubungkan EduNex" },
  connect_six: { en: "Connect SIX", id: "Hubungkan SIX" },
  sign_in_ina: { en: "Sign in with your INA account", id: "Masuk dengan akun INA" },
  password_note: {
    en: "You type your password only on Microsoft's page.",
    id: "Kata sandi hanya kamu ketik di halaman Microsoft.",
  },
  connected: { en: "Connected", id: "Terhubung" },
  get_started: { en: "Get started", id: "Mulai" },
  continue: { en: "Continue", id: "Lanjut" },
  view_all: { en: "View all", id: "Lihat semua" },
  back: { en: "Back", id: "Kembali" },
  this_week: { en: "This week", id: "Minggu ini" },
  later: { en: "Later", id: "Nanti" },
  done: { en: "Done", id: "Selesai" },
  ipk: { en: "IPK", id: "IPK" },
} as const;

export type StringKey = keyof typeof STRINGS;

export function translate(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang];
}

export function pick(lang: Lang, text: { en: string; id: string }): string {
  return text[lang];
}

const ZONE = "Asia/Jakarta";
const DAY_MS = 86_400_000;

export interface Format {
  /** "08:00" */
  time(iso: string): string;
  /** "08:00–09:30" */
  timeRange(startIso: string, endIso: string): string;
  /** "Thursday" / "Kamis" */
  weekday(iso: string): string;
  /** "Thu" / "Kam" */
  weekdayShort(iso: string): string;
  /** "8 Oct" / "8 Okt" */
  dayMonth(iso: string): string;
  /** "Thursday, 8 October" / "Kamis, 8 Oktober" */
  dateLong(iso: string): string;
  /** "Today" / "Tomorrow" / "Yesterday", else "Thu, 8 Oct" */
  relativeDay(iso: string): string;
  /** "Today, 23:59" / "Tomorrow, 23:59" / "Fri 10 Oct, 23:59" */
  dueLabel(iso: string): string;
  /** "in 6 hours" / "dalam 6 jam", "2 days ago" / "2 hari yang lalu" */
  fromNow(iso: string): string;
  /** "18 min" / "1h 05m" (en), "18 mnt" / "1 jam 5 mnt" (id) */
  countdown(iso: string): string;
  /** "2026-10-08" in WIB, for grouping by day */
  dayKey(iso: string): string;
  /** Whole days from today (WIB) to that day: 0 today, 1 tomorrow, -1 yesterday */
  dayOffset(iso: string): number;
  /** "Good morning" / "Selamat pagi" etc., from the current WIB hour */
  greeting(): string;
  /** "1.9 MB" */
  fileSize(bytes: number): string;
}

export function makeFormat(lang: Lang, now: Date): Format {
  const locale = lang === "id" ? "id-ID" : "en-GB";
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: ZONE, ...options });
  const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const weekdayFmt = fmt({ weekday: "long" });
  const weekdayShortFmt = fmt({ weekday: "short" });
  const dayMonthFmt = fmt({ day: "numeric", month: "short" });
  const dateLongFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", hour12: false });
  const rtf = new Intl.RelativeTimeFormat(lang === "id" ? "id" : "en", { numeric: "auto" });

  const time = (iso: string) => timeFmt.format(new Date(iso)).replace(".", ":");
  const dayKey = (iso: string) => keyFmt.format(new Date(iso));
  const dayOffset = (iso: string) =>
    Math.round((Date.parse(`${dayKey(iso)}T00:00:00Z`) - Date.parse(`${dayKey(now.toISOString())}T00:00:00Z`)) / DAY_MS);
  const weekdayShort = (iso: string) => weekdayShortFmt.format(new Date(iso)).replace(".", "");
  const dayMonth = (iso: string) => dayMonthFmt.format(new Date(iso)).replace(".", "");
  const relativeDay = (iso: string) => {
    const offset = dayOffset(iso);
    if (offset === 0) return translate(lang, "today");
    if (offset === 1) return translate(lang, "tomorrow");
    if (offset === -1) return translate(lang, "yesterday");
    return `${weekdayShort(iso)}, ${dayMonth(iso)}`;
  };

  return {
    time,
    timeRange: (start, end) => `${time(start)}–${time(end)}`,
    weekday: (iso) => weekdayFmt.format(new Date(iso)),
    weekdayShort,
    dayMonth,
    dateLong: (iso) => dateLongFmt.format(new Date(iso)),
    relativeDay,
    dueLabel: (iso) => `${relativeDay(iso)}, ${time(iso)}`,
    fromNow: (iso) => {
      const diff = new Date(iso).getTime() - now.getTime();
      const abs = Math.abs(diff);
      if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
      if (abs < DAY_MS) return rtf.format(Math.round(diff / 3_600_000), "hour");
      return rtf.format(dayOffset(iso), "day");
    },
    countdown: (iso) => {
      const minutes = Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (lang === "id") return h ? `${h} jam ${m} mnt` : `${m} mnt`;
      return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
    },
    dayKey,
    dayOffset,
    greeting: () => {
      const hour = Number(hourFmt.format(now));
      if (lang === "id") {
        if (hour < 11) return "Selamat pagi";
        if (hour < 15) return "Selamat siang";
        if (hour < 18) return "Selamat sore";
        return "Selamat malam";
      }
      if (hour < 12) return "Good morning";
      if (hour < 18) return "Good afternoon";
      return "Good evening";
    },
    fileSize: (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    },
  };
}
