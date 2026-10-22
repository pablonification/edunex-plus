import type { Entry } from "./entry";

export const chatgptStrings = {
  "chatgpt.title": { id: "ChatGPT", en: "ChatGPT" },
  "chatgpt.connect": { id: "Continue with ChatGPT", en: "Continue with ChatGPT" },
  "chatgpt.hint": {
    id: "Hubungkan akun untuk fitur AI mendatang. Belum ada data kuliah yang dikirim atau fitur AI yang diaktifkan.",
    en: "Connect an account for future AI features. No course data is sent and no AI features are enabled yet.",
  },
  "chatgpt.unavailable": {
    id: "Koneksi ChatGPT belum tersedia di salinan aplikasi ini.",
    en: "ChatGPT connection is not available in this copy of the app yet.",
  },
  "chatgpt.waiting": { id: "Selesaikan masuk di browser, lalu kembali ke sini.", en: "Finish signing in in your browser, then return here." },
  "chatgpt.connected": { id: "Terhubung sebagai {name}", en: "Connected as {name}" },
  "chatgpt.disconnect": { id: "Putuskan ChatGPT", en: "Disconnect ChatGPT" },
  "chatgpt.disconnectTitle": { id: "Putuskan ChatGPT?", en: "Disconnect ChatGPT?" },
  "chatgpt.disconnectBody": {
    id: "Akun ChatGPT dilupakan di komputer ini. Kamu bisa menghubungkannya lagi kapan saja.",
    en: "This computer forgets your ChatGPT account. You can connect it again at any time.",
  },
  "chatgpt.cancel": { id: "Batalkan masuk", en: "Cancel sign-in" },
  "chatgpt.failed": { id: "ChatGPT belum terhubung. Coba masuk lagi.", en: "ChatGPT could not be connected. Try signing in again." },
  "chatgpt.callback": { id: "Kembali ke Edunex Plus untuk melihat hasil masuk.", en: "Return to Edunex Plus to see your sign-in result." },
} as const satisfies Record<string, Entry>;
