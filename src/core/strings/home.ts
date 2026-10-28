// Text for Beranda: what needs the Student now, today, and what changed (#77),
// and the change alerts (Task edited, material for today's class).
import type { Entry } from "./entry";

export const homeStrings = {
  // The ITB calendar's next exam week, as a calm line under the greeting
  "home.utsStarts": { id: "Masa UTS mulai {date}", en: "UTS period starts {date}" },
  "home.uasStarts": { id: "Masa UAS mulai {date}", en: "UAS period starts {date}" },
  "home.utsNow": { id: "Masa UTS sampai {date}", en: "UTS period until {date}" },
  "home.uasNow": { id: "Masa UAS sampai {date}", en: "UAS period until {date}" },
  "home.inDays": { id: "{count} hari lagi", en: { one: "in {count} day", other: "in {count} days" } },

  // Sekarang: the class going on or next, where attendance counts, the open Presence
  "home.now": { id: "Sekarang", en: "Now" },
  "home.now.live": { id: "Sedang berlangsung · sampai {time}", en: "On now · until {time}" },
  "home.now.next": { id: "Berikutnya · {when}", en: "Next · {when}" },
  "home.now.later": { id: "Kuliah berikutnya · {day}", en: "Next class · {day}" },
  "home.now.presenceOnly": { id: "Presensi sedang dibuka", en: "Presence is open" },
  "home.now.countSix": {
    id: "Kehadiran dihitung di SIX. Tekan Tandai Hadir di SIX saat tombolnya muncul.",
    en: "Attendance counts in SIX. Press Tandai Hadir in SIX when it shows.",
  },
  "home.now.checkEvery": { id: "Aplikasi memeriksa tiap 2 menit", en: "The app checks every 2 minutes" },
  // The class's share in SIX, short, beside its absences left (the card names the course already)
  "home.now.share": { id: "Kehadiran {percent}%", en: "Attendance {percent}%" },
  "home.now.checkInWatch": { id: "Tekan Tandai Hadir di SIX saat tombolnya muncul.", en: "Press Tandai Hadir in SIX when it shows." },
  // SIX's "Tandai Hadir" for the class on now, as the app last saw it in the class's popup
  "home.now.checkInOpen": { id: "Tandai Hadir sudah dibuka di SIX", en: "Tandai Hadir is open in SIX" },
  "home.now.checkInOpenHint": { id: "Belum kamu tekan. Kuliah sampai {time}.", en: "You haven't pressed it yet. Class until {time}." },
  "home.now.checkInGone": {
    id: "Tandai Hadir sudah tidak tampil di SIX. Sudah kamu tekan, atau sudah ditutup.",
    en: "Tandai Hadir no longer shows in SIX. You pressed it, or it closed.",
  },
  "home.now.openSix": { id: "Buka di SIX", en: "Open in SIX" },
  // Starts with what the button shows (home.now.openSix), so a voice command for it works.
  "home.now.openSixLabel": { id: "Buka di SIX untuk Tandai Hadir di {course}", en: "Open in SIX to press Tandai Hadir for {course}" },
  "home.now.countEdunex": { id: "Kehadiran dihitung lewat Presensi Edunex.", en: "Attendance counts through Edunex Presence." },
  "home.now.countNotKnown": {
    id: "Belum tahu kehadiran dihitung di mana sampai SIX terhubung. Mengisinya tidak ada ruginya.",
    en: "Where attendance counts is unknown until SIX is connected. Filling it in costs nothing.",
  },
  "home.now.countNoSix": {
    id: "Tanpa SIX, belum pasti ini dihitung. Catat saja untuk berjaga-jaga.",
    en: "Without SIX it's not certain this counts. Record it just in case.",
  },
  "home.now.countUnknown": { id: "Belum ada hitungan kehadiran di SIX.", en: "SIX has no attendance count yet." },
  "home.now.presenceDo": { id: "{action} sebelum {time}", en: "{action} before {time}" },
  "home.now.presenceExtra": { id: "Presensi Edunex juga dibuka sampai {time}, tidak wajib.", en: "Edunex Presence is also open until {time}. It's optional." },
  "home.now.closesIn": { id: "tutup dalam {left}", en: "closes in {left}" },
  "home.now.closesWhen": { id: "tutup {when}", en: "closes {when}" },
  "home.now.recordLabel": { id: "Catat di Edunex: Presensi {course}", en: "Record in Edunex: {course} Presence" },
  "home.now.openTask": { id: "Buka tugasnya", en: "Open the Task" },
  "home.now.after": { id: "Setelah ini {time} · {course}", en: "After this {time} · {course}" },
  "home.now.lastToday": { id: "Kuliah terakhir hari ini", en: "Last class today" },
  "home.now.free": { id: "Tidak ada kuliah dalam seminggu ke depan.", en: "No classes in the coming week." },
  // A day with a class SIX shows that the app couldn't read: the next class, or a free week, isn't said without it.
  "home.now.unread": { id: "Ada kuliah yang belum terbaca · {day}", en: "A class the app can't read · {day}" },
  "home.now.openCourse": { id: "Buka mata kuliah", en: "Open course" },

  // Hari ini: today's classes, meetings outside SIX, and what's due today and tomorrow
  "home.today": { id: "Hari ini", en: "Today" },
  "home.today.none": { id: "Tidak ada kuliah atau tenggat hari ini.", en: "No classes or deadlines today." },
  "home.today.noneSnoozed": { id: "Tidak ada kuliah hari ini. Tenggat hari ini kamu tunda.", en: "No classes today. You snoozed today's deadlines." },
  "home.today.noneHandled": { id: "Tidak ada kuliah hari ini. Tenggat hari ini sudah beres.", en: "No classes today. Today's deadlines are handled." },
  "home.today.noSix": { id: "Jadwal dan ruang kuliah muncul setelah SIX terhubung.", en: "Classes and rooms show once SIX is connected." },
  "home.today.signInSix": { id: "Masuk ke SIX", en: "Sign in to SIX" },
  "home.today.done": { id: "Selesai", en: "Done" },
  "home.today.now": { id: "Sekarang", en: "Now" },
  "home.today.changed": { id: "Jam berubah · biasanya {usual}", en: "New time · usually {usual}" },
  "home.today.roomChanged": { id: "Ruang berubah · biasanya {room}", en: "New room · usually {room}" },
  "home.today.overlap": { id: "Bentrok dengan {course} {time}", en: "Clashes with {course} {time}" },
  "home.today.pick": { id: "Pilih ini kalau hanya bisa hadir di salah satunya.", en: "Go to this one if you can make only one." },
  // A past class: what SIX's count did after it, when the app saw
  "home.today.counted": { id: "Dihitung di SIX", en: "Counted in SIX" },
  "home.today.notCounted": { id: "Belum dihitung SIX", en: "Not counted yet" },
  "home.today.absent": { id: "Tercatat tidak hadir", en: "Marked absent" },
  "home.today.join": { id: "Gabung", en: "Join" },
  "home.today.joinLabel": { id: "Gabung kelas daring: {course}", en: "Join online class: {course}" },
  "home.today.notInSix": { id: "Tidak ada di jadwal SIX", en: "Not on SIX's timetable" },
  "home.today.meeting": { id: "Pertemuan {number}", en: "Meeting {number}" },
  "home.today.meetingOnline": { id: "Pertemuan {number} · daring", en: "Meeting {number} · online" },
  "home.today.due": { id: "Tenggat", en: "Due" },
  "home.today.tomorrow": { id: "Besok", en: "Tomorrow" },

  // Perlu perhatianmu: the days ahead the Student picked in Settings, without what Sekarang and Hari ini show
  "home.needs": { id: "Perlu perhatianmu", en: "Needs you" },
  "home.needs.none": {
    id: "Bebas tenggat {count} hari ke depan",
    en: { one: "Nothing due in the next {count} day", other: "Nothing due in the next {count} days" },
  },
  // {day}: the last day it looks at, which is free too
  "home.needs.noneHint": { id: "Tidak ada tugas atau ujian dengan tenggat sampai {day}.", en: "No Tasks or exams due by {day}." },
  // Something is due that the list doesn't show: Hari ini has it, or it isn't open yet
  "home.needs.noneElse": { id: "Tidak ada lagi yang perlu perhatianmu sekarang", en: "Nothing else needs you now" },
  "home.needs.noneElseHint": { id: "Tenggat berikutnya {when}.", en: "Next due {when}." },
  // Settings: how far ahead Perlu perhatianmu looks, in whole days
  "settings.needsAhead": { id: "Jangkauan Perlu perhatianmu", en: "How far ahead Needs you looks" },
  "settings.needsAhead.hint": {
    id: "Yang bertenggat sampai akhir hari terakhir muncul di Beranda.",
    en: "What's due by the end of the last day shows on Home.",
  },
  "settings.needsAhead.3": { id: "3 hari", en: "3 days" },
  "settings.needsAhead.7": { id: "1 minggu", en: "1 week" },
  "settings.needsAhead.14": { id: "2 minggu", en: "2 weeks" },
  "home.need.presence": { id: "Isi Presensi {course}", en: "Fill in {course} Presence" },
  "home.need.presence.closes": { id: "tutup {time}", en: "closes {time}" },
  "home.need.presenceOptional": { id: "Presensi {course} dibuka, tidak wajib", en: "{course} Presence is open, not required" },
  "home.need.presenceOptional.counted": { id: "Dihitung di SIX", en: "Counted in SIX" },
  "home.need.presenceNoSix": { id: "Presensi {course} dibuka", en: "{course} Presence is open" },
  "home.need.presenceNoSix.note": {
    id: "Belum pasti dihitung tanpa SIX · catat untuk berjaga-jaga",
    en: "Not certain it counts without SIX · record it just in case",
  },
  "home.need.presenceAhead.assignment": { id: "Kumpulkan {task}", en: "Hand in {task}" },
  "home.need.presenceAhead": { id: "Presensi {course}", en: "{course} Presence" },
  "home.need.presenceAhead.when": { id: "Juga presensi: {date}, {time}", en: "Also attendance: {date}, {time}" },
  "home.need.presenceAhead.span": { id: "Juga presensi: {from} sampai {to}", en: "Also attendance: {from} until {to}" },
  "home.need.task.overdue": { id: "Lewat tenggat, masih diterima", en: "Past due, still accepted" },
  "home.need.task.short": { id: "Hanya dibuka {duration}", en: "Open for only {duration}" },
  "home.need.task.due": { id: "Tenggat {when}", en: "Due {when}" },
  "home.need.task.draft": { id: "Draf belum dikumpulkan", en: "Draft not handed in" },
  "home.need.task.returned": { id: "Dikembalikan dosen", en: "Handed back by your lecturer" },
  "home.need.task.edited": { id: "Diubah dosen setelah kamu kumpulkan · cek lagi", en: "Changed after you handed it in · check again" },
  "home.need.task.editedCount": {
    id: "Diubah dosen setelah kamu kumpulkan · {count} perubahan",
    en: { one: "Changed after you handed it in · {count} change", other: "Changed after you handed it in · {count} changes" },
  },
  "home.need.task.editedMove": { id: "Diubah dosen setelah kamu kumpulkan · {change}", en: "Changed after you handed it in · {change}" },
  "home.need.task.changedCount": {
    id: "Diubah dosen · {count} perubahan",
    en: { one: "Changed by your lecturer · {count} change", other: "Changed by your lecturer · {count} changes" },
  },
  "home.need.task.changedMove": { id: "Diubah dosen · {change}", en: "Changed by your lecturer · {change}" },
  // One date moving, mid-sentence
  "home.move.deadline": { id: "tenggat diundur ke {date}", en: "deadline moved to {date}" },
  "home.move.deadlineEarlier": { id: "tenggat dimajukan ke {date}", en: "deadline moved earlier to {date}" },
  "home.move.deadlineAdded": { id: "sekarang ada tenggat {date}", en: "now due {date}" },
  "home.move.deadlineRemoved": { id: "tenggat dihapus", en: "deadline removed" },
  "home.move.opens": { id: "mulai bisa dijawab {date}", en: "opens for answers {date}" },
  "home.move.opensNow": { id: "langsung bisa dijawab", en: "open for answers now" },
  "home.need.attendance.none": { id: "{course}: jangan absen lagi", en: "{course}: don't miss another class" },
  "home.need.attendance.tomorrow": { id: "{course}: jangan absen besok", en: "{course}: don't miss tomorrow's class" },
  "home.need.attendance.out": { id: "{course}: tak bisa lagi capai {target}%", en: "{course}: can't reach {target}% anymore" },
  "home.need.attendance.outMeta": {
    id: "Paling tinggi {best}% · cek ke dosen kalau ada yang terlewat",
    en: "Best case {best}% · ask the lecturer if one was missed",
  },
  "home.need.attendance.noneMeta": { id: "Hadir {attended} dari {held} · target {target}%", en: "{attended} of {held} attended · target {target}%" },
  "home.need.meeting": { id: "{course} ada pertemuan {day}", en: "{course} meets {day}" },
  "home.need.meeting.online": { id: "{course} ada pertemuan daring {day}", en: "{course} meets online {day}" },
  "home.need.exam": { id: "{kind} {course}", en: "{course} {kind}" },
  "home.need.exam.disagree": { id: "SIX dan Edunex beda tanggal", en: "SIX and Edunex give different dates" },
  "home.need.exam.takeHome": { id: "Take-home tenggat {date}", en: "Take-home due {date}" },
  "home.need.exam.edunex": { id: "di Edunex", en: "in Edunex" },
  "home.need.exam.closes": { id: "Tutup {when}", en: "Closes {when}" },
  "home.need.krs": { id: "Kirim KRS", en: "Send your KRS" },
  "home.need.krs.closes": { id: "DRS tutup {date}", en: "DRS closes {date}" },
  "home.need.krs.opens": { id: "DRS dibuka {date}", en: "DRS opens {date}" },
  "home.need.bill": { id: "Bayar UKT · {amount}", en: "Pay UKT · {amount}" },
  "home.need.bill.due": { id: "Batas bayar {date}", en: "Pay by {date}" },
  "home.need.bill.overdue": { id: "Lewat batas bayar {date}", en: "Past the deadline, {date}" },
  "home.need.late": { id: "terlambat", en: "late" },

  // What changed
  "home.changes": { id: "Yang berubah", en: "What changed" },
  "home.changes.none": { id: "Tidak ada yang berubah minggu ini.", en: "Nothing changed this week." },
  "home.changes.all": { id: "Lihat semua", en: "See all" },
  "home.change.moved": { id: "Jadwal {course} berubah", en: "{course} schedule changed" },
  "home.change.moved.time": { id: "{dateId} {time} · biasanya {usualId}", en: "{dateEn} {time} · usually {usualEn}" },
  "home.change.moved.room": { id: "{dateId} di {room} · biasanya {usualId}", en: "{dateEn} in {room} · usually {usualEn}" },
  "home.change.meeting": { id: "Pertemuan {number} {course} diumumkan di Edunex", en: "{course} meeting {number} announced in Edunex" },
  "home.change.meeting.body": { id: "{dateId} {time} · tidak ada di jadwal SIX", en: "{dateEn} {time} · not on SIX's timetable" },

  // Alerts: changes Edunex never announces
  "alert.taskEdited": { id: "Tugas diubah · {course}", en: "Task edited · {course}" },
  "alert.taskEdited.afterSubmit": { id: "Diubah setelah kamu kumpulkan · {course}", en: "Changed after you handed in · {course}" },
  "alert.taskEdited.afterSubmit.body": { id: "{title} · cek apakah perlu dikumpulkan ulang", en: "{title} · check whether to hand it in again" },
  // How many things changed (History on the Task page says which); one date moving is said by name
  "alert.taskEdited.count": { id: "{title} · {count} perubahan", en: { one: "{title} · {count} change", other: "{title} · {count} changes" } },
  "alert.taskEdited.count.after": {
    id: "{title} · {count} perubahan · cek apakah perlu dikumpulkan ulang",
    en: { one: "{title} · {count} change · check whether to hand it in again", other: "{title} · {count} changes · check whether to hand it in again" },
  },
  "alert.taskEdited.deadline": { id: "Tenggat diundur ke {dateId}, {time} · {course}", en: "Deadline moved to {dateEn}, {time} · {course}" },
  "alert.taskEdited.deadlineEarlier": { id: "Tenggat dimajukan ke {dateId}, {time} · {course}", en: "Deadline moved earlier to {dateEn}, {time} · {course}" },
  "alert.taskEdited.deadlineAdded": { id: "Sekarang ada tenggat {dateId}, {time} · {course}", en: "Now due {dateEn}, {time} · {course}" },
  "alert.taskEdited.deadlineRemoved": { id: "Tenggat dihapus · {course}", en: "Deadline removed · {course}" },
  "alert.taskEdited.opens": { id: "Mulai bisa dijawab {dateId}, {time} · {course}", en: "Opens for answers {dateEn}, {time} · {course}" },
  "alert.taskEdited.opensNow": { id: "Sekarang langsung bisa dijawab · {course}", en: "Now open for answers · {course}" },
  // Edunex marked it changed, but nothing the app compares did: the bell alone, quietly
  "alert.taskEdited.none": { id: "Tugas ditandai berubah · {course}", en: "Task marked as changed · {course}" },
  "alert.taskEdited.none.body": { id: "{title} · tenggat, instruksi, dan berkas sama", en: "{title} · same deadline, instructions and files" },
  "alert.materialToday": { id: "Materi untuk kuliah hari ini · {course}", en: "Material for today's class · {course}" },
  "alert.materialToday.body": { id: "{title} · kuliah {time}", en: "{title} · class at {time}" },
  // The whole "changes" group: Task edits, and Jadwal's moved, extra and overlapping classes and meetings outside SIX.
  "settings.alerts.changes": { id: "Ada perubahan", en: "Something changed" },
  "settings.alerts.changesHint": { id: "Ruang/jam pindah, tugas diubah, pertemuan baru", en: "Room or time moved, Task edited, meeting added" },
} as const satisfies Record<string, Entry>;
