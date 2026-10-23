---
name: copywriting
description: The app's on-screen words in Indonesian and English. Use when adding or changing a string in src/core/strings, writing a notification, dialog, menu or empty state, or reviewing copy in a pull request.
---

# Copywriting

The reader is a tired ITB student between classes who needs one answer. Write the shortest true sentence that tells them what happened or what to do, in both languages. The voice and the Glossary live in `docs/design-system.md` (Copy). This is the working checklist.

## Steps

1. Name the job: what happened, or what to do. One idea per string.
2. Write the Indonesian and the English each as a native speaker would, not one translated from the other.
3. Cut until every word left carries a fact, a condition or the action.
4. Check it against the budget, the punctuation and the tells below, then run `npm run lint`. Done when lint passes and each string still says every number, date and condition it said before.

## Length budget

| Element | Budget | From the app |
|---|---|---|
| Button | 1–3 words: a verb and its object | Putuskan HP · Atur ulang rencana |
| Title | under 6 words, no full stop | Perlu perhatianmu |
| Row meta line | facts joined by ` · `, no full stop | Tenggat {when} · belum dikumpulkan |
| Hint | one line, about 10 words | Digabung jika banyak sekaligus |
| Error | what went wrong, then the one fix | Sesimu berakhir. Masuk lagi, lalu coba lagi. |
| Toast | what happened, and when it comes back if it does, then Undo | Ditandai sudah dicek. Muncul lagi hanya jika dosen mengubahnya lagi. |
| Empty state | what shows here, and when | Mata kuliahmu muncul di sini setelah SIX mencantumkan kelasmu semester ini. |
| Confirm | the question names the action, the body names what's lost, the buttons are verbs | Putuskan HP? |
| Notification | title says what and `· {course}`, body gives the one detail | Tenggat 3 jam lagi · {course} |

A sentence past 20 words gets split or cut. Indonesian runs longer than English: fit the Indonesian.

## Punctuation

- End sentences with a full stop. Two short sentences beat one joined by a semicolon. To keep one sentence, join with a comma and a word (*jadi, tapi, karena* / *so, but, since*). The lint fails on a semicolon in `src/core/strings/`.
- Use a colon for a label, a time or a list ("Dosen wali: {name}", "SIX: {six} · Edunex: {edunex}", "Semua perubahanmu hilang: {list}."). A setup such as "Sudah aman: …" or "Tidak wajib: …" becomes a full stop or *karena*.
- Use hyphens and en dashes only. A range is an en dash with no spaces (15:00–23:59, 12–16 Okt). An empty value is `-`. The lint fails on an em dash in any string, template or JSX text under `src/`.
- Join the facts of one meta line with ` · `, never the clauses of a sentence.
- Buttons, titles, labels and fragment hints end without a full stop, as the rest of the catalog does.
- Write in sentence case, without exclamation marks. Swapping a dash for a comma isn't enough. Rewrite the sentence.

## AI tells, and what to write instead

| Tell | Instead |
|---|---|
| Explaining how the app works out a fact | The fact and the action. The how goes in "Cara menghitungnya", or nowhere. |
| The hint restating the title, the tooltip restating the label | A hint that adds the one thing the title can't say, or no hint |
| Setups: "Here's what…", "Perlu diingat", "It's important to note" | Start with the fact |
| "Not X, but Y" for rhythm | Say Y. Keep the contrast only when the student would otherwise guess X ("dihitung di SIX, bukan Edunex"). |
| Three items for rhythm | The items that are true, one or two is fine |
| Filler: seamlessly, easily, smart, powerful, simply, *dengan mudah* | Delete it |
| Stacked hedges: "might possibly", "mungkin saja bisa" | One hedge, only where the fact is uncertain ("mungkin tak ada") |
| "We", "kami", "please", "mohon", "oops" | "the app" / "aplikasi", or the verb alone (the lecturer email keeps *mohon*) |

## Indonesian

- *kamu* and *-mu*, never *Anda*. The Student's own buttons may speak in casual first person ("Sudah kucek", "Kelompokku sudah kumpul").
- Everyday words: *bisa* (not *dapat*), *lalu* (not *kemudian*), *cek*, *sudah*, *belum*.
- The Glossary's words, exactly: Tugas, Presensi (Edunex's session), Kehadiran (SIX's count), Pertemuan, Tenggat, Jatah absen. "Masa UTS", never "minggu UTS" (Minggu reads as Sunday next to a date).
- SKS, IP, IPK, KRS, UKT, UTS, UAS, Kurikulum and "Tandai Hadir" stay as ITB writes them, in English too.

## Facts stay exact

Attendance, deadlines and grades are never shortened into something false. Keep every count, date, condition ("hanya jika dikumpulkan di dalam jendelanya") and uncertainty ("mungkin tak ada", never "tidak ada"). Keys, `{placeholders}` and plural forms stay as they are.

## Before and after

| Before | After |
|---|---|
| Just this once; it usually takes under a minute. | Just this once, usually under a minute. |
| Tanpa SIX, belum pasti ini dihitung: catat saja untuk berjaga-jaga. | Tanpa SIX, belum pasti ini dihitung. Catat saja untuk berjaga-jaga. |
| Dosen menautkan tugas ini ke Presensi Edunex: mengumpulkan pada {date}, {time} juga mengisinya. Tidak wajib: kehadiran {course} dihitung di SIX. | Mengumpulkan tugas ini pada {date}, {time} juga mengisi Presensi Edunex. Tidak wajib, karena kehadiran {course} dihitung di SIX. |
| Lebih dari 100 MB: Edunex tidak menerima berkas sebesar ini | Edunex tidak menerima berkas lebih dari 100 MB |
| Kamu mengoreksi {list}; SIX masih mencatatnya belum diambil. | Kamu mengoreksi {list}, tapi SIX masih mencatatnya belum diambil. |
| {course} Presence is open; it's optional | {course} Presence is open, not required |
| UTS PL3032, minggu UTS 12–16 Okt | UTS PL3032, masa UTS 12–16 Okt |
| IPK — (no IPK yet) | IPK - |

## Check

- `npm run lint` runs the two copy rules in `biome-plugins/`, and `test/kit/copy-lint.test.ts` proves they still fire. Where an em dash is data, not words (a character table), write it as `\u2014`.
- Changed a string? `grep -rn` its old text in `test/` and update what asserts on it.
- Read both languages as the student would. The first two words should tell them what this is about.

Based on: Nielsen Norman Group (how users read, error messages, confirmation dialogs, tooltips), the GOV.UK style guide, the Microsoft Writing Style Guide (semicolons, colons, dashes), the Google developer documentation style guide, Apple's Human Interface Guidelines (Writing, Alerts), the Mailchimp Content Style Guide, Wikipedia's "Signs of AI writing", and EYD V (Badan Bahasa) on *titik koma*, *titik dua* and *tanda pisah*.
