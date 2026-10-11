// Every piece of text the app shows (screens, menus, windows), in Bahasa
// Indonesia and English. Keys name the meaning, not the screen. "{name}" placeholders are filled by t();
// English entries that depend on a count give "one" and "other" forms.
// Academic terms follow the glossary in docs/design-system.md: SKS, IPK, IP,
// KRS and UKT stay as they are in both languages.

type Forms = { one: string; other: string };
export type Entry = { id: string; en: string | Forms };

export const STRINGS = {
  // Shell
  "nav.home": { id: "Beranda", en: "Home" },
  "nav.courses": { id: "Mata kuliah", en: "Courses" },
  "nav.settings": { id: "Pengaturan", en: "Settings" },
  "action.refresh": { id: "Muat ulang", en: "Refresh" },
  "action.close": { id: "Tutup", en: "Close" },
  "action.cancel": { id: "Batal", en: "Cancel" },
  "action.tryAgain": { id: "Coba lagi", en: "Try again" },
  "action.copyDetails": { id: "Salin detail", en: "Copy details" },
  "action.copied": { id: "Tersalin", en: "Copied" },
  "action.openInEdunex": { id: "Buka di EduNex", en: "Open in EduNex" },
  "action.signIn": { id: "Masuk", en: "Sign in" },
  "action.signInAgain": { id: "Masuk lagi", en: "Sign in again" },
  "action.signOut": { id: "Keluar", en: "Sign out" },

  // Sources and their status
  "source.edunex": { id: "EduNex", en: "EduNex" },
  "source.six": { id: "SIX", en: "SIX" },
  "source.itb": { id: "Kalender ITB", en: "ITB calendar" },
  "status.signed-out": { id: "Belum masuk", en: "Not signed in" },
  "status.connecting": { id: "Memeriksa…", en: "Checking…" },
  "status.live": { id: "Terhubung", en: "Live" },
  "status.offline": { id: "Offline", en: "Offline" },
  "status.expired": { id: "Sesi berakhir", en: "Session ended" },
  "status.changed": { id: "{source} berubah", en: "{source} changed something" },
  "status.updated": { id: "Diperbarui {when}", en: "Updated {when}" },
  "status.neverUpdated": { id: "Belum ada data", en: "No data yet" },
  "status.refreshing": { id: "Memuat ulang…", en: "Refreshing…" },
  "status.expiredHint": {
    id: "{source} mengakhiri sesimu. Data terakhir tetap bisa dibaca.",
    en: "{source} ended your session. Your last data stays readable.",
  },
  "status.changedHint": {
    id: "{source} mengirim data yang tidak dikenali. Data terakhir tetap ditampilkan.",
    en: "{source} sent data the app doesn't recognise. Your last data is still shown.",
  },
  "status.signedOutHint": {
    id: "Masuk ke {source} untuk memperbarui data ini.",
    en: "Sign in to {source} to bring this up to date.",
  },
  "status.offlineHint": {
    id: "{source} tidak bisa dihubungi. Data terakhir tetap ditampilkan.",
    en: "{source} can't be reached. Your last data is still shown.",
  },

  // Welcome / sign-in
  "welcome.title": { id: "Selamat datang di Edunex Plus", en: "Welcome to Edunex Plus" },
  "welcome.lead": {
    id: "EduNex dan SIX tidak saling terhubung. Edunex Plus membaca keduanya dan memberi tahu apa yang perlu kamu urus, apa yang berubah, dan posisimu.",
    en: "EduNex and SIX don't talk to each other. Edunex Plus reads both and tells you what needs you, what changed, and where you stand.",
  },
  "welcome.edunexDetail": { id: "Tugas, materi, presensi, unggahan dosen", en: "Tasks, materials, Presence, lecturer posts" },
  "welcome.connect": { id: "Hubungkan", en: "Connect" },
  "welcome.connected": { id: "Terhubung", en: "Connected" },
  "welcome.waiting": { id: "Menunggu kamu masuk…", en: "Waiting for you to sign in…" },
  "welcome.passwordNote": { id: "Kata sandi hanya kamu ketik di halaman Microsoft.", en: "You type your password only on Microsoft's page." },
  "welcome.readOnly": {
    id: "Hanya membaca. Tidak ada yang dikumpulkan, ditandai, atau diubah kecuali kamu sendiri menekan tombolnya.",
    en: "Read-only. Nothing is submitted, marked or changed unless you press the button yourself.",
  },
  "welcome.signInFailed": { id: "Halaman masuk tidak bisa dibuka. Coba lagi.", en: "The sign-in page couldn't be opened. Try again." },

  // Home
  "home.coursesThisTerm": { id: "Mata kuliah semester ini", en: "Courses this semester" },
  "home.noCourses": { id: "Belum ada mata kuliah semester ini", en: "No courses this semester yet" },
  "home.coursesUnavailable": { id: "Daftar mata kuliah belum bisa dimuat", en: "Your courses couldn't be loaded yet" },
  "course.class": { id: "Kelas {no}", en: "Class {no}" },
  "course.count": { id: "{count} mata kuliah", en: { one: "{count} course", other: "{count} courses" } },

  // Settings
  "settings.appearance": { id: "Tampilan", en: "Appearance" },
  "settings.theme": { id: "Tema", en: "Theme" },
  "settings.theme.system": { id: "Sistem", en: "System" },
  "settings.theme.light": { id: "Terang", en: "Light" },
  "settings.theme.dark": { id: "Gelap", en: "Dark" },
  "settings.language": { id: "Bahasa", en: "Language" },
  "settings.accounts": { id: "Akun", en: "Accounts" },
  "settings.notConnected": { id: "Belum terhubung", en: "Not connected" },
  "settings.signOutAll": { id: "Keluar dari semua akun", en: "Sign out of everything" },
  "settings.signOutAllHint": {
    id: "Menghapus sesi dan semua data tersimpan dari komputer ini.",
    en: "Removes your sessions and all saved data from this computer.",
  },
  "settings.signOutAllConfirm": { id: "Keluar dan hapus semuanya?", en: "Sign out and remove everything?" },
  "settings.sessionNotSaved": {
    id: "Komputer ini tidak punya penyimpanan aman, jadi sesimu tidak disimpan. Kamu perlu masuk lagi setiap membuka aplikasi.",
    en: "This computer has no secure storage, so your session isn't saved. You'll sign in again each time you open the app.",
  },
  "settings.version": { id: "Versi {version}", en: "Version {version}" },

  // Desktop: menus and windows
  "menu.settings": { id: "Pengaturan…", en: "Settings…" },
  "menu.refresh": { id: "Muat ulang", en: "Refresh" },
  "menu.file": { id: "Berkas", en: "File" },
  "menu.view": { id: "Tampilan", en: "View" },
  "signIn.edunexTitle": { id: "Masuk ke EduNex", en: "Sign in to EduNex" },
  "app.startFailed": { id: "Edunex Plus tidak bisa dibuka", en: "Edunex Plus couldn't start" },

  // Crash guard
  "error.panel": { id: "Bagian ini gagal ditampilkan", en: "This part couldn't be shown" },
  "error.action": { id: "Tidak berhasil: {message}", en: "That didn't work: {message}" },

  // Task statuses (design system; used from the Tasks ticket on)
  "taskStatus.not_started": { id: "Belum dikerjakan", en: "Not started" },
  "taskStatus.draft": { id: "Draf", en: "Draft" },
  "taskStatus.submitted": { id: "Terkumpul", en: "Submitted" },
  "taskStatus.overdue": { id: "Terlambat", en: "Overdue" },
  "taskStatus.closed": { id: "Ditutup", en: "Closed" },
  "taskStatus.in_review": { id: "Sedang dinilai", en: "In review" },

  // Time words
  "time.today": { id: "Hari ini", en: "Today" },
  "time.tomorrow": { id: "Besok", en: "Tomorrow" },
  "time.yesterday": { id: "Kemarin", en: "Yesterday" },
  "time.justNow": { id: "baru saja", en: "just now" },
  "time.greeting.morning": { id: "Selamat pagi", en: "Good morning" },
  "time.greeting.midday": { id: "Selamat siang", en: "Good afternoon" },
  "time.greeting.afternoon": { id: "Selamat sore", en: "Good afternoon" },
  "time.greeting.evening": { id: "Selamat malam", en: "Good evening" },
  "term.label": { id: "Semester {n} {years}", en: "Semester {n}, {years}" },
  "term.short": { id: "Semester pendek {years}", en: "Short semester, {years}" },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
export type Lang = "id" | "en";
export type Vars = Record<string, string | number>;

const plural = { id: new Intl.PluralRules("id"), en: new Intl.PluralRules("en") };

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const entry: Entry = STRINGS[key];
  let text = entry[lang];
  if (typeof text !== "string") text = plural[lang].select(Number(vars?.count ?? 0)) === "one" ? text.one : text.other;
  return vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text;
}
