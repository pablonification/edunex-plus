// Text for "new version available" (#82), and updating from inside the app.
import type { Entry } from "./entry";

export const updatesStrings = {
  "update.available": { id: "Versi baru tersedia", en: "New version available" },
  "update.version": { id: "Edunex Plus {version}", en: "Edunex Plus {version}" },
  "update.download": { id: "Unduh", en: "Download" },
  "update.install": { id: "Unduh & pasang", en: "Download & install" },
  "update.whatsNew": { id: "Lihat yang baru", en: "See what's new" },
  "update.downloading": { id: "Mengunduh Edunex Plus {version}…", en: "Downloading Edunex Plus {version}…" },
  "update.progress": { id: "{percent}% terunduh", en: "{percent}% downloaded" },
  "update.ready": {
    id: "Edunex Plus {version} siap dipasang. Aplikasi akan tertutup sebentar lalu terbuka lagi.",
    en: "Edunex Plus {version} is ready. The app closes for a moment and opens again.",
  },
  "update.restart": { id: "Mulai ulang untuk memperbarui", en: "Restart to update" },
  "update.retry": { id: "Coba lagi", en: "Try again" },
  "update.problem.offline": { id: "Tidak ada koneksi. Coba lagi saat sudah terhubung.", en: "No connection. Try again once you're online." },
  "update.problem.mismatch": {
    id: "File yang terunduh tidak sama dengan yang ada di rilis, jadi tidak dipasang.",
    en: "The downloaded file isn't the one the release lists, so it wasn't installed.",
  },
  "update.problem.failed": {
    id: "Unduhan tidak selesai. Coba lagi, atau unduh dari halaman rilis.",
    en: "The download didn't finish. Try again, or get it from the release page.",
  },
  "update.blocked.deb": { id: "Pasang file .deb barunya dengan apt, seperti pertama kali.", en: "Install the new .deb with apt, as you did the first time." },
  "update.blocked.diskImage": {
    id: "Edunex Plus sedang dibuka dari disk image. Pindahkan ke Applications agar bisa diperbarui dari sini.",
    en: "Edunex Plus is open from the disk image. Move it to Applications to update it from here.",
  },
  "update.blocked.translocated": {
    id: "macOS membuka salinan sementara Edunex Plus. Pindahkan ke Applications lalu buka lagi agar bisa diperbarui dari sini.",
    en: "macOS opened a temporary copy of Edunex Plus. Move it to Applications and open it again to update it from here.",
  },
  "update.blocked.readOnly": {
    id: "Edunex Plus tidak bisa mengganti dirinya di folder ini, jadi unduh versi barunya dari halaman rilis.",
    en: "Edunex Plus can't replace itself in this folder, so get the new version from the release page.",
  },
  "update.blocked.noFile": {
    id: "Rilis ini belum punya file untuk komputer ini, jadi halaman rilisnya dibuka.",
    en: "This release has no file for this computer yet, so its page opened instead.",
  },
} as const satisfies Record<string, Entry>;
