// The words of the hand-off page (mobile/report/index.html, made by mobile/scripts/make-report.mjs).
// Each flow names its pictures: round 2's from mobile/flows/judge/*.yaml ("light-01-beranda"), round 1's
// from mobile/report/img/before ("mid-light-beranda"). Demo data only, a made-up student.

export const TITLE = "Edunex Plus for Android, round 2: hand-off";

/** @type {{ id: string, title: string, steps: string[], shots: { phone: string, before?: string, caption: string }[] }[]} */
export const FLOWS = [
  {
    id: "first-run",
    title: "First run",
    steps: [
      "One welcome screen, then ITB's own sign-in page in the app. SIX joins on the same Microsoft sign-in.",
      "Beranda opens at once and fills in while the semester is read. The top bar says what it's reading.",
      "Once the read is in, one card says what the app found and opens the summary.",
    ],
    shots: [
      { phone: "32-pertama-selamat-datang", before: "selamat-datang", caption: "Welcome" },
      { phone: "33-pertama-beranda-mengisi", caption: "Beranda while the first read runs" },
      { phone: "34-pertama-siap", caption: "The read is in" },
      { phone: "35-pertama-temuan", caption: "What the first read found" },
    ],
  },
  {
    id: "beranda",
    title: "Beranda",
    steps: [
      "The class on now, in its course colour, with minutes left on a moving wave and the one action that's open.",
      "Perlu kamu urus. Two cards with one big number each, the most pressing first.",
      "Nanti hari ini. The rest of today, one row each.",
    ],
    shots: [
      { phone: "01-beranda", before: "beranda", caption: "Beranda" },
      { phone: "02b-perlu-kamu-urus", caption: "Perlu kamu urus" },
      { phone: "02-beranda-hari-ini", caption: "Nanti hari ini" },
    ],
  },
  {
    id: "jadwal",
    title: "Jadwal",
    steps: [
      "A week strip and one day under it. Swipe the strip for the next week.",
      "A class opens its sheet with three or four facts and one button.",
      "The month is its own screen. The phone's calendar is in the ⋮ menu.",
    ],
    shots: [
      { phone: "07-jadwal-minggu", before: "jadwal", caption: "A day" },
      { phone: "08-jadwal-detail", caption: "A class's sheet" },
      { phone: "09-jadwal-masa-uts", caption: "Exam weeks" },
      { phone: "10-jadwal-bulan", caption: "The month" },
      { phone: "11-ekspor-kalender", caption: "To the phone's calendar" },
    ],
  },
  {
    id: "tugas",
    title: "Tugas",
    steps: [
      "Belum selesai and Selesai, filtered by course. The nearest deadline is a big card with its days left.",
      "A Task opens with its brief, files and the answer box. Kumpulkan sits at the bottom, in reach of a thumb.",
    ],
    shots: [
      { phone: "03-tugas-ujian", before: "tugas-ujian", caption: "Tugas & Ujian" },
      { phone: "04-tugas", before: "tugas", caption: "A Task" },
      { phone: "04b-tugas-kumpulkan", caption: "Handing it in" },
      { phone: "06-ujian", before: "ujian", caption: "An exam" },
    ],
  },
  {
    id: "kuliah",
    title: "Kuliah",
    steps: [
      "Every course of the term, its absences left as a chip. The one that can't reach 80% any more comes first.",
      "A course opens on its meetings, modules, Tasks and grades.",
    ],
    shots: [
      { phone: "13-kuliah", before: "presensi", caption: "Kuliah (round 1's Presensi)" },
      { phone: "20-mata-kuliah", caption: "A course" },
      { phone: "21-pertemuan", caption: "Its meetings" },
      { phone: "22-kalkulator-nilai", caption: "The grade calculator" },
    ],
  },
  {
    id: "akademik",
    title: "Akademik",
    steps: ["The IPK and SKS as big numbers, then Nilai, Rencana, Kurikulum, KRS, UKT and the calendar, one row each."],
    shots: [
      { phone: "13b-akademik", before: "lainnya", caption: "Akademik (round 1's Lainnya)" },
      { phone: "14-nilai", before: "nilai", caption: "Nilai" },
      { phone: "15-rencana", before: "rencana-studi", caption: "Rencana studi" },
      { phone: "16-kurikulum", caption: "Kurikulum" },
      { phone: "17-krs", caption: "KRS" },
      { phone: "18-ukt", caption: "UKT" },
      { phone: "19-kalender-akademik", caption: "The academic calendar" },
    ],
  },
  {
    id: "around",
    title: "Search, alerts and settings",
    steps: ["Search, the alerts and Settings sit behind the top bar's icons and the avatar on every tab."],
    shots: [
      { phone: "23-cari", before: "cari", caption: "Search" },
      { phone: "25-notifikasi", before: "notifikasi", caption: "Alerts" },
      { phone: "24-status-data-memperbarui", caption: "Where the data stands" },
      { phone: "26-pengaturan", before: "pengaturan", caption: "Settings" },
    ],
  },
  {
    id: "edunex-only",
    title: "Without SIX",
    steps: ["Signed in to Edunex alone, every tab still works on what Edunex knows, and says what SIX would add."],
    shots: [
      { phone: "36-tanpa-six-beranda", caption: "Beranda" },
      { phone: "37-tanpa-six-jadwal", caption: "Jadwal" },
    ],
  },
];

export const SECTIONS = {
  top: `
<h1>Edunex Plus for Android, round 2</h1>
<p class="lead">Round 1 put every desktop feature on the phone. Arqila's verdict was that it was cluttered, wordy and joyless. Round 2 rebuilt every screen in v4 (course colours, big numbers, Plus Jakarta Sans, Material 3 motion), cut the words, and fixed what Arqila found broken. It also made the app fast and steady on a phone.</p>
<table>
<tr><th>Gate</th><th>Where it stands</th></tr>
<tr><td>WORKS</td><td>Every item on Arqila's list is a flow or test that failed first. Check A (the desktop's every item, found on the phone) ran at 100% before round 2's last fixes, and runs again on them.</td></tr>
<tr><td>FAST</td><td>Taps, tab switches, cold starts and scrolling meet the targets on mid. Weak meets them except Tugas' scrolling. The JS thread still blocks ~400 ms once at start (below).</td></tr>
<tr><td>FEELS MOBILE</td><td>The judge (Claude Opus 5.5, strict) scores 34 of 37 screens at 8/10 or more in light and 35 of 37 in dark, on e261d21a. Under 8 are Beranda (53 words: the per-class attendance chips stay), the Kumpulkan sheet (its second button is cut off) and, in light only, the Jadwal menu's status bar.</td></tr>
</table>
`,
  bottom: `
<h2 id="speed">Speed</h2>
<p>Release builds of the demo. "Before" is round 1 on the desktop lab's emulators. Round 2's mid numbers are from the lab (v4, b03d55f). The lab went down, so the weak numbers are from an Android 15 emulator on the Mac. The saved-start blocks are a before/after on one machine (Redroid), for comparison only.</p>
<table>
<tr><th>Measure</th><th>Target</th><th>Before (mid / weak)</th><th>Round 2</th></tr>
<tr><td>A tap responds</td><td>&lt; 100 ms</td><td>19–58 / 22–52 ms</td><td>mid 15–47 ms, weak 13–48 ms</td></tr>
<tr><td>Tab switch</td><td>&lt; 300 ms</td><td>~505–518 / ~502–524 ms</td><td>mid 104–160 ms first visit, 89–149 again. Weak 83–155 first, 68–120 again</td></tr>
<tr><td>A screen opens with its data</td><td>&lt; 500 ms</td><td>564–643, Nilai 900 / 583–773, Nilai 1221 ms</td><td>mid: class sheet 189, Task 276, course 211, module 104 ms. <b>Over: Nilai 602, Rencana 549</b></td></tr>
<tr><td>Scrolling long lists</td><td>full refresh on mid, &lt; 5% janky on weak</td><td>0.75% at 60 fps / 1.20%</td><td>mid 0.00–0.08% at 120 fps. Weak Jadwal 2.1%, Modul 3.3%, Nilai 1.3%, <b>Tugas 20%</b> (the wave, now a cached texture, to re-measure)</td></tr>
<tr><td>Cold start, fresh install to first data</td><td>&lt; 2 s on mid</td><td>6.6 / 7.8 s</td><td>mid 1.79 s median. Weak 1.16 s</td></tr>
<tr><td>Cold start with saved data</td><td></td><td>1.09 / 1.57 s</td><td>weak 0.76 s</td></tr>
<tr><td>JS thread blocked, saved start</td><td>never &gt; 50 ms</td><td></td><td>Redroid: 937–1460 ms this morning, <b>405–449 ms</b> now. Weak 401 ms worst</td></tr>
</table>

<h2 id="broke">What broke along the way, and why</h2>
<ul>
  <li><b>Sheets stayed off-screen</b> with Android's animations off (CI's emulator, and anyone with "Remove animations"). A bug in react-native-screens. Fixed with a patch of 4.30.1 (upstream's #4581, not yet released).</li>
  <li><b>Cards invisible on a tab's first visit.</b> Their entrance animation started while the tab was hidden and never ended. They now appear plainly unless the screen is in front.</li>
  <li><b>A second-long freeze on every start with saved data.</b> On the phone the engine shares one JS thread with the screens. Reading three of SIX's catalog pages and its curriculum page (about 300 KB of HTML each) held it for up to 1.4 s. They're now parsed in slices with the screens drawing between them.</li>
  <li><b>"Semua siap" came and went</b> after the first sign-in. SIX counted as signed out while it was still joining. A system still signing in now counts as coming.</li>
  <li><b>Screens kept drawing at rest</b>, up to 120 fps for a wave nobody could see. Loops now run only while their screen is in front and the app is open.</li>
  <li><b>The lab machine went down three times.</b> Its old F: disk stalled and its C: filled up. Builds moved to GitHub Actions, and the speed numbers were taken on the Mac.</li>
  <li><b>Tests that failed for reasons outside the app.</b> Android sometimes dropped a launch right after the app's data was cleared, and the new one-time question about problem reports covered the bottom of the screen. The flows now retry the launch and answer the question.</li>
</ul>

<h2 id="weak">What's still weak</h2>
<ul>
  <li><b>The JS thread still blocks ~400 ms on a start with saved data</b>, after Beranda shows. It's the engine's own start (loading and checking the saved data, the first alert plan) on Hermes. Finding which needs a profiler on a device.</li>
  <li><b>Nilai and Rencana open in 550–600 ms on mid</b>, over 500. Weak's readings are upper bounds, because the wave kept the screen busy.</li>
  <li><b>Tugas scrolled 20% janky on weak.</b> The wave now slides as a cached texture. That needs re-measuring.</li>
  <li><b>Mid's numbers for today are void.</b> The Mac ran out of memory while measuring. Retake them on the lab machine.</li>
  <li><b>The one-time question about problem reports</b> (from main) is a paragraph and four buttons over a third of a tab, against the text budget. It's main's design, so it's left as it is for Arqila to decide.</li>
  <li><b>For about a second before the first read's data</b>, Beranda's placeholder looks like a grey blob.</li>
  <li><b>The Kumpulkan sheet's second button</b> is cut off at the bottom in CI's pictures. The sheet already leaves room for the phone's bar, so finding why needs a device.</li>
  <li><b>Polish the judge still wants.</b> Stack screens use two title faces (Plus Jakarta on Perlu kamu urus and Lisensi, Roboto on the rest). A few one-line metas are cut mid-word where a shorter line would read better. The Jadwal menu's status bar went blank in light in the last pictures.</li>
  <li><b>Signing in with a real ITB account</b> hasn't been tried. Everything after the sign-in page works with the demo's made-up one.</li>
</ul>

<h2 id="run">Run it</h2>
<ol>
  <li>The demo, no account needed. <code>adb install edunex-plus-demo-release.apk</code>, then open <b>Edunex Plus Demo</b>. A made-up student on a pretend Edunex and SIX, on the recorded Thursday (8 Oct 2026).</li>
  <li>The real app. <code>adb install edunex-plus-release.apk</code>, open <b>Edunex Plus</b> and sign in on ITB's own page.</li>
</ol>
<p>Both APKs come from the <a href="https://github.com/pablonification/edunex-plus/actions/workflows/mobile.yml">Mobile workflow</a> on branch <code>mobile</code>.</p>

<h2 id="next">What Arqila needs to do next</h2>
<ol>
  <li>Sign in with your ITB account on the real app and say whether Edunex and SIX both say <b>Terhubung</b>.</li>
  <li>Confirm or refuse the two exceptions in CI's dependency review (PROGRESS.md, Blockers for Arqila).</li>
  <li>Bring the lab machine back, or say the Mac's numbers stand.</li>
  <li>Read and merge the pull request, <a href="https://github.com/pablonification/edunex-plus/pull/285">#285</a>.</li>
</ol>

<h2 id="how-made">How this was made</h2>
<p>Made with Claude Opus 5.5 in Claude Code (run from T3 Code), as the lead on one machine. Helpers in separate Claude Code sessions (Claude Opus 5.5) on a Mac and a Windows desktop built pieces on their own branches, and the lead reviewed and merged each. The judge ran four passes over every screen, light and dark. Pass 1 was Codex (gpt-6-luna), with 27 of 37 at 8+. Passes 2 to 4 were Claude Opus 5.5, going from 14 to 34 of 37 in light and from 16 to 35 in dark.</p>
`,
};
