# Before: round 1 (9395cea) on the lab's `mid` emulator

Recordings of the demo release APK of 9395cea (mobile/qa/build.sh), on `mid` (Pixel 7 class, 1080×2400, 120 Hz
display; the app draws at 60), light theme, recorded by the emulator from the host at 60 fps
(`mobile/qa/shots.sh <flow> --record`, flows in `mobile/qa/flows/` on the branch `mobile-qa`). Each starts with a
few seconds of the screen before Maestro's first step. How they were measured and what was seen in them:
`mobile/qa/BASELINE.md` on `mobile-qa`.

| File | Flow | What it shows |
| --- | --- | --- |
| `mid-1-cold-start-to-beranda.mp4` | `rec-cold.yaml` | the app stopped, then opened from its saved data: splash, then Beranda (round 1's resumed demo shows "Belum ada data" and a signed-out banner: a demo quirk, fixed in f63bdff) |
| `mid-2-every-tab.mp4` | `rec-tabs.yaml` | Tugas, Jadwal, Presensi, Lainnya, Beranda: each tab slides in, the tab's ripple fades for ~0.9 s |
| `mid-3-course-modul-module-file.mp4` | `rec-module.yaml` | Lainnya → II4091 → Modul → Modul 3 → its PDF "Slide Pengantar Proposal TA": the first tap downloads it, the second opens nothing and says nothing |
| `mid-4-course-menu-sheet.mp4` | `rec-sheet.yaml` | a course's menu sheet opened and closed: the dark scrim slides up from the bottom with the sheet (~0.2 s, at 23.0–23.3 s) instead of fading in |
