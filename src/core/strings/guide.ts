// Text for the guide: the short tour of the window after a new Student's first
// sign-in (shell/guide.tsx), and its row in Settings.
import type { Entry } from "./entry";

export const guideStrings = {
  "guide.intro.title": { id: "Kenalan dulu dengan Edunex Plus", en: "Get to know Edunex Plus" },
  "guide.intro.body": {
    id: "Lihat isi tiap bagian aplikasi dalam {count} langkah singkat.",
    en: { one: "See what each part of the app does, in {count} short step.", other: "See what each part of the app does, in {count} short steps." },
  },
  "guide.start": { id: "Mulai panduan", en: "Take the tour" },
  "guide.skip": { id: "Lewati panduan", en: "Skip the tour" },
  "guide.next": { id: "Lanjut", en: "Next" },
  "guide.done": { id: "Selesai", en: "Done" },
  "guide.step": { id: "{step} dari {count}", en: "{step} of {count}" },
  "guide.later": { id: "Panduan bisa dibuka lagi dari Pengaturan › Tentang", en: "Take the tour again from Settings › About" },

  // Each step: what the part of the window it points at is for.
  "guide.tasks.body": {
    id: "Semua tugas dan ujian dengan status aslinya. Simpan draf atau kumpulkan tugas langsung dari sini.",
    en: "Every Task and exam with its real status. Save a draft or hand a Task in from here.",
  },
  "guide.presence.body": {
    id: "Berapa kali lagi kamu boleh absen di tiap mata kuliah. Saat kuliah, aplikasi memberi tahu begitu Tandai Hadir di SIX dibuka.",
    en: "How many more classes you can miss in each course. In class, the app tells you the moment Tandai Hadir opens on SIX.",
  },
  "guide.courses.body": {
    id: "Tiap mata kuliah punya halaman sendiri berisi modul, materi, dan pertemuan. Materinya bisa dibaca langsung di aplikasi.",
    en: "Each course has its own page with modules, materials and meetings. Materials open right in the app.",
  },
  "guide.home.body": {
    id: "Yang perlu kamu urus sekarang dari Edunex dan SIX, yang paling penting di atas.",
    en: "What needs you now from Edunex and SIX, the most important first.",
  },
  "guide.search.title": { id: "Cari dari mana saja", en: "Search from anywhere" },
  "guide.search.body": {
    id: "Tekan {keys} untuk mencari mata kuliah, tugas, modul, atau materi.",
    en: "Press {keys} to find a course, Task, module or material.",
  },
  "guide.alerts.body": {
    id: "Tugas dan materi baru, tenggat yang mendekat, dan Presensi yang dibuka muncul di sini. Bisa dikirim ke HP-mu juga.",
    en: "New Tasks and materials, coming deadlines and Presence opening show here. They can reach your phone too.",
  },
  "guide.settings.body": {
    id: "Atur pengingat tenggat, notifikasi di HP, bahasa, dan tema. Panduan ini juga bisa dibuka lagi dari sini.",
    en: "Set deadline reminders, phone notifications, language and theme. You can take this tour again from here.",
  },

  // Settings
  "settings.guide": { id: "Panduan aplikasi", en: "Tour of the app" },
  "settings.guide.hint": { id: "Isi tiap bagian Edunex Plus, langkah demi langkah", en: "What each part of Edunex Plus does, step by step" },
  "settings.guide.start": { id: "Mulai", en: "Start" },
} as const satisfies Record<string, Entry>;
