# Which flows lean on the screens tonight's layout moves

Tonight Beranda is rebuilt (a search bar `home.search`, the now card `home.now`, a strip `home.strip`, a service grid
`home.grid`), Akademik becomes Profil (`tab.profile`), and the avatar leaves the top bar. This is the list of every
Maestro flow (and the scripts around them) that names something on those screens, so the next child knows which to move.

The list is made by `node mobile/qa/superapp-flows.mjs --write` (it rewrites everything between the two markers at the
bottom; run it again after the layout has moved, and `--stale` on its own prints the ids nothing draws any more). Texts
are guesses (marked `?`), the ids are exact. Flows live in `mobile/flows/` and `mobile/qa/flows/`; there is no `.maestro`
folder.

## Who runs the flows

| Flows | Run by | When |
| --- | --- | --- |
| `mobile/flows/*.yaml` (`smoke`, `use`, `judge-light`, `judge-dark`) | CI job `e2e (app)` in `.github/workflows/mobile.yml`, through `scripts/ci/mobile-e2e.sh` (glob `*.yaml`) | a pull request or push that changes `mobile/`, every night, by hand |
| `mobile/flows/judge/*.yaml` | the same job, but only through `judge-light.yaml` and `judge-dark.yaml` (`runFlow`); `mobile-e2e.sh` skips the folder on its own. `mobile/scripts/make-report.mjs` runs `walk.yaml` for the report's pictures | with the job above |
| `mobile/flows/data/<scenario>/*.yaml` (made, not in the repository) | CI jobs `e2e (signed-in)`, `e2e (edunex-only)` and thirteen more scenarios, made by `mobile/scripts/flows-from-inventory.mjs` from `mobile/flows/screens.json` and `mobile/flows/expected/*.json` | nightly and full runs only (1.5 to 3 hours each) |
| `mobile/flows/round2/*` | nothing; run by hand in round 2 | never in CI |
| `mobile/qa/flows/*.yaml`, `r3/*` | the lab's scripts (`jank.sh` runs `to-<list>.yaml`, `flashlight.sh` runs `flashlight.yaml`, `r3/run.sh` runs `r3/0*.yaml`); the rest by hand | never in CI |

`screens.json` is the one file that decides how every generated flow reaches a screen. It names `tab.academic` and
`action.account` (to reach Settings) and every Akademik row, so it moves with the layout or the scenario jobs stop at
Beranda.

## Not Maestro, but the same ids

| File | Line | Depends on |
| --- | --- | --- |
| `scripts/ci/mobile-e2e.sh` | 81 | `for tab in home schedule tasks courses academic`: the words check of every tab; `profile` must replace `academic` |
| `mobile/qa/words.sh` | 4, 26, 67, 73 | the tab names `home\|schedule\|tasks\|courses\|academic` it accepts; waits for `tab.home`; taps `tab.<name>` |
| `mobile/qa/taps/plan.txt` | 7, 12, 23 (`tab.academic`); 24, 26, 28 (`row.nav.grades`, `row.nav.plan.planner`, `row.nav.plan.curriculum`); 14, 16 (`action.alerts`, `action.search`) | Akademik and the top bar's icons |
| `mobile/qa/mac/plan.txt` | 5, 10, 23; 24, 26, 28; 14, 16 | the same steps, for the Mac |
| `mobile/qa/taps/plan-round1.txt` | all | round 1's tabs (`tab.more`, `tab.presence`): already stale |
| `mobile/qa/mac/jank.sh` | 47 | `tab.academic` then `row.nav.grades` (the "grades" walk) |
| `mobile/scripts/flows-from-inventory.mjs` | 166 to 168 | goes back to Beranda by `tab.home` (stays) |
| `mobile/qa/layout-read.mjs` | `TABS` | wants `tab.profile` last and no `action.account`; written for tonight |

## What moves, from what the lists below show

- **`tab.academic` goes to `tab.profile`** (8 flow files, 39 mentions, and 15 lines of `screens.json`), and `screen.academic` with it
  (`screens.json`, `r3/05-grades.yaml`). The Akademik rows `row.nav.grades` and `row.nav.plan.*` are reached from there in
  `judge/walk.yaml`, `r2-akademik.yaml`, `r2-tasks-academic.yaml`, `r3/05-grades.yaml`, `shell-tour.yaml` and `screens.json`: they need a new way in
  (the Profil tab, or Semua layanan behind "Lainnya").
- **`action.account` (the avatar) leaves the top bar** (6 files). Flows that open Settings through it: `use.yaml:163`,
  `judge/walk.yaml:360`, `round2/w09-native-ui.yaml:13`, `r2-akademik.yaml:75`, `r2-tasks-academic.yaml:102`, and
  `screens.json` (lines 182, 189, 375, 382, 5414, 5421: the generated flows' way to Settings). Settings now opens from Profil.
- **`action.search` and `action.alerts`** (top bar): `judge/walk.yaml`, `r2-*`, `before.yaml`, `screens.json`. On Beranda the search is a bar
  (`home.search`); where the icons stay on other tabs, nothing changes.
- **Beranda's own ids** (`card.now`, `action.nowClass`, `sheet.nowClass`, `row.need.*`, `row.today.class:*`, `section.today`,
  `action.needs.all`, `screen.needs`, `card.firstScan`, `action.firstScan.open`, `action.notify.later`) are named by `smoke.yaml`,
  `judge/walk.yaml`, `use.yaml` and many `screens.json` entries: the ones the new Beranda keeps must keep their testID, the
  others need the flow changed. `status.settling` (top bar, 15 files) is how the flows wait for the first read: keep it.
- **`tab.home`, `tab.schedule`, `tab.tasks`, `tab.courses`** stay, and are the most used ids of all (42, 15, 16, 9 files).
- **Already stale before tonight** (nothing draws them; the lists end with them): round 1's `tab.more` and `tab.presence`
  (`before.yaml`, `shell-tabs-round1.yaml`, `plan-round1.txt`) and a few more. Ids built inside shared controls
  (a segmented control's `segment.theme.dark`, a row's `row.module.*`) are not written out in any file; the script
  counts an id as drawn when a drawn id plus a dot is its start, but some of the stale list below may still be false alarms.

## By flow

<!-- flows:start -->

### `mobile/flows/judge/edunex-only.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/tab.yaml`; `mobile/flows/judge/walk.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/superapp-flows.md`

- mobile/flows/judge/edunex-only.yaml:7: `tab.home`, tab bar
- mobile/flows/judge/edunex-only.yaml:11: `status.settling`, top bar

### `mobile/flows/judge/first-run.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/walk.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/superapp-flows.md`

- mobile/flows/judge/first-run.yaml:18: `status.firstRead`, top bar
- mobile/flows/judge/first-run.yaml:24: `card.firstScan`, Beranda
- mobile/flows/judge/first-run.yaml:29: `action.firstScan.open`, Beranda

### `mobile/flows/judge/walk.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/tab.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/superapp-flows.md`; `mobile/scripts/make-report.mjs`

- mobile/flows/judge/walk.yaml:11: `tab.home`, tab bar
- mobile/flows/judge/walk.yaml:15: `status.settling`, top bar
- mobile/flows/judge/walk.yaml:21: `action.needs.all`, Beranda
- mobile/flows/judge/walk.yaml:24: `screen.needs`, Beranda
- mobile/flows/judge/walk.yaml:135: `sheet.nowClass`, Beranda
- mobile/flows/judge/walk.yaml:202: `row.nav.grades`, Akademik
- mobile/flows/judge/walk.yaml:206: `row.nav.grades`, Akademik
- mobile/flows/judge/walk.yaml:216: `row.nav.plan.planner`, Akademik
- mobile/flows/judge/walk.yaml:226: `row.nav.plan.curriculum`, Akademik
- mobile/flows/judge/walk.yaml:236: `row.nav.plan.krs`, Akademik
- mobile/flows/judge/walk.yaml:246: `row.nav.plan.bills`, Akademik
- mobile/flows/judge/walk.yaml:256: `row.nav.plan.deadlines`, Akademik
- mobile/flows/judge/walk.yaml:314: `action.search`, top bar
- mobile/flows/judge/walk.yaml:317: `action.search`, top bar
- mobile/flows/judge/walk.yaml:329: `tab.home`, tab bar
- mobile/flows/judge/walk.yaml:333: `status.settling`, top bar
- mobile/flows/judge/walk.yaml:336: `action.syncStatus`, top bar and Beranda (also drawn in screens/home/header.tsx, screens/schedule/schedule-screen.tsx; also drawn in screens/schedule/schedule-screen.tsx, shell/source-status.tsx)
- mobile/flows/judge/walk.yaml:338: `action.refreshNow`, top bar
- mobile/flows/judge/walk.yaml:342: text ".*Memperbarui.*", top bar? (string `sync.checking` is used there)
- mobile/flows/judge/walk.yaml:348: `action.alerts`, top bar
- mobile/flows/judge/walk.yaml:360: `action.account`, top bar

### `mobile/flows/round2/w01-files.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w01-files.yaml:13: `tab.home`, tab bar
- mobile/flows/round2/w01-files.yaml:18: text "Slide Pengantar Proposal TA", Beranda? (after `tab.home` at line 13, nothing else tapped since)
- mobile/flows/round2/w01-files.yaml:21: text "Slide Pengantar Proposal TA", Beranda? (after `tab.home` at line 13, nothing else tapped since)

### `mobile/flows/round2/w04-hierarchy.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w04-hierarchy.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:13: `tab.tasks`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:44: `tab.academic`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:46: `action.academic.grades`, Akademik
- mobile/flows/round2/w04-hierarchy.yaml:47: text "3,26", Akademik? (after `tab.academic` at line 44, nothing else tapped since)

### `mobile/flows/round2/w04-home-hierarchy.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w04-home-hierarchy.yaml:12: `tab.home`, tab bar
- mobile/flows/round2/w04-home-hierarchy.yaml:16: `status.settling`, top bar
- mobile/flows/round2/w04-home-hierarchy.yaml:20: `card.now`, Beranda
- mobile/flows/round2/w04-home-hierarchy.yaml:24: `status.settling`, top bar
- mobile/flows/round2/w04-home-hierarchy.yaml:26: text ".*Ekonomi dan Inovasi dalam Perencanaan.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:27: text ".*Dicek tiap 2 menit.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:28: text ".*Presensi Edunex juga dibuka.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:31: `action.nowClass`, Beranda
- mobile/flows/round2/w04-home-hierarchy.yaml:34: `sheet.nowClass`, Beranda
- mobile/flows/round2/w04-home-hierarchy.yaml:36: text ".*Boleh absen.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:37: text ".*Kehadiran 85%.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:38: text ".*Tandai Hadir belum muncul.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:39: text ".*Setelah ini.*", Beranda? (after `tab.home` at line 12, nothing else tapped since)
- mobile/flows/round2/w04-home-hierarchy.yaml:43: `section.today`, Beranda (also drawn in screens/plan/curriculum.tsx)

### `mobile/flows/round2/w04-jadwal.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w04-jadwal.yaml:13: `tab.home`, tab bar
- mobile/flows/round2/w04-jadwal.yaml:16: `tab.schedule`, tab bar
- mobile/flows/round2/w04-jadwal.yaml:24: text "Jadwal", tab bar (a tab's label)
- mobile/flows/round2/w04-jadwal.yaml:55: `sheet.nowClass`, Beranda
- mobile/flows/round2/w04-jadwal.yaml:57: text "TVST C", Beranda? (after `sheet.nowClass` at line 55, nothing else tapped since)
- mobile/flows/round2/w04-jadwal.yaml:58: text ".*11:00.12:59.*", Beranda? (after `sheet.nowClass` at line 55, nothing else tapped since)

### `mobile/flows/round2/w07-swipe.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w07-swipe.yaml:11: `tab.home`, tab bar
- mobile/flows/round2/w07-swipe.yaml:15: `status.settling`, top bar
- mobile/flows/round2/w07-swipe.yaml:18: `action.needs.all`, Beranda
- mobile/flows/round2/w07-swipe.yaml:21: `screen.needs`, Beranda
- mobile/flows/round2/w07-swipe.yaml:25: `row.need.attendance:KU5014:out`, Beranda
- mobile/flows/round2/w07-swipe.yaml:31: `row.need.attendance:KU5014:out`, Beranda
- mobile/flows/round2/w07-swipe.yaml:35: text "Urungkan", Beranda? (after `tab.home` at line 11, nothing else tapped since)
- mobile/flows/round2/w07-swipe.yaml:38: `row.need.attendance:KU5014:out`, Beranda
- mobile/flows/round2/w07-swipe.yaml:39: text "Urungkan", Beranda? (after `tab.home` at line 11, nothing else tapped since)
- mobile/flows/round2/w07-swipe.yaml:42: `row.need.attendance:KU5014:out`, Beranda
- mobile/flows/round2/w07-swipe.yaml:46: `row.need.exam:DK4073-UTS`, Beranda
- mobile/flows/round2/w07-swipe.yaml:56: `row.need.attendance:KU5014:out`, Beranda
- mobile/flows/round2/w07-swipe.yaml:59: `sheet.row`, Beranda

### `mobile/flows/round2/w09-native-ui.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w09-native-ui.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w09-native-ui.yaml:13: `action.account`, top bar

### `mobile/flows/round2/w10-check-in-done.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w10-check-in-done.yaml:11: `tab.home`, tab bar
- mobile/flows/round2/w10-check-in-done.yaml:15: `status.settling`, top bar
- mobile/flows/round2/w10-check-in-done.yaml:19: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/flows/round2/w10-check-in-done.yaml:22: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/flows/round2/w10-check-in-done.yaml:29: `card.now.checkedIn`, Beranda

### `mobile/flows/round2/w10-hand-in-moment.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w10-hand-in-moment.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w10-hand-in-moment.yaml:13: `tab.tasks`, tab bar

### `mobile/flows/round2/w11-kuliah.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w11-kuliah.yaml:15: `tab.home`, tab bar
- mobile/flows/round2/w11-kuliah.yaml:18: `tab.courses`, tab bar

### `mobile/flows/round2/w12-one-target-akademik.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w12-one-target-akademik.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w12-one-target-akademik.yaml:13: `tab.academic`, tab bar
- mobile/flows/round2/w12-one-target-akademik.yaml:15: `card.profile`, Akademik (also drawn in screens/settings/accounts.tsx)
- mobile/flows/round2/w12-one-target-akademik.yaml:22: `tab.tasks`, tab bar

### `mobile/flows/round2/w12-one-target.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w12-one-target.yaml:12: `tab.home`, tab bar
- mobile/flows/round2/w12-one-target.yaml:16: `status.settling`, top bar
- mobile/flows/round2/w12-one-target.yaml:19: `action.openCourse`, Beranda (also drawn in screens/schedule/details.tsx)
- mobile/flows/round2/w12-one-target.yaml:21: `action.nowClass`, Beranda
- mobile/flows/round2/w12-one-target.yaml:24: `sheet.nowClass`, Beranda
- mobile/flows/round2/w12-one-target.yaml:29: `row.today.class:.*`, Beranda
- mobile/flows/round2/w12-one-target.yaml:34: `row.today.class:.*`, Beranda
- mobile/flows/round2/w12-one-target.yaml:37: `sheet.nowClass`, Beranda
- mobile/flows/round2/w12-one-target.yaml:42: `section.today`, Beranda (also drawn in screens/plan/curriculum.tsx)

### `mobile/flows/round2/w13-schedule.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w13-schedule.yaml:13: `tab.home`, tab bar
- mobile/flows/round2/w13-schedule.yaml:16: `tab.schedule`, tab bar
- mobile/flows/round2/w13-schedule.yaml:66: `sheet.nowClass`, Beranda
- mobile/flows/round2/w13-schedule.yaml:68: text "R.SG PWK LT.6", Beranda? (after `sheet.nowClass` at line 66, nothing else tapped since)

### `mobile/flows/round2/w13-tandai-hadir.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w13-tandai-hadir.yaml:19: `tab.home`, tab bar
- mobile/flows/round2/w13-tandai-hadir.yaml:28: text "Kuliah sudah mulai . PL3002", Beranda? (after `tab.home` at line 19, nothing else tapped since)
- mobile/flows/round2/w13-tandai-hadir.yaml:31: text "Tandai Hadir", Beranda? (string `mobile.notification.checkIn` is used there)
- mobile/flows/round2/w13-tandai-hadir.yaml:33: text "Di aplikasi asli, halaman SIX terbuka di sini.*", Beranda? (after `tab.home` at line 19, nothing else tapped since)

### `mobile/flows/round2/w15-onboarding.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w15-onboarding.yaml:23: `tab.home`, tab bar
- mobile/flows/round2/w15-onboarding.yaml:27: `status.settling`, top bar
- mobile/flows/round2/w15-onboarding.yaml:33: `card.firstScan`, Beranda
- mobile/flows/round2/w15-onboarding.yaml:38: `action.firstScan.open`, Beranda

### `mobile/flows/screens.json`

Run by: CI `e2e (<scenario>)` (nightly and full runs): mobile/scripts/flows-from-inventory.mjs makes mobile/flows/data/<scenario>/*.yaml from it and mobile/flows/expected/*.json; `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-flows.mjs`; `mobile/scripts/flows-from-inventory.mjs`; `mobile/scripts/inventory.mjs`

- mobile/flows/screens.json:48, 144, 227, 303, 429, 470, 560, 649, 936, 1536, 1626, 1802, 1835: `tab.home`, tab bar
- mobile/flows/screens.json:56, 269: `status.settling`, top bar
- mobile/flows/screens.json:151, 173, 344, 366, 1868, 4592, 4629, 4704, 4733, 4787, 4815, 4843, 4871, 5383, 5405: `tab.academic`, tab bar
- mobile/flows/screens.json:157, 167, 350, 360, 1873, 5389, 5399: `screen.academic`, Akademik
- mobile/flows/screens.json:182, 189, 375, 382, 5414, 5421: `action.account`, top bar
- mobile/flows/screens.json:235, 311: `card.firstScan`, Beranda
- mobile/flows/screens.json:261: `(tab\.home|screen\.welcome)`, tab bar (also drawn in shell/welcome.tsx)
- mobile/flows/screens.json:318: `action.firstScan.open`, Beranda
- mobile/flows/screens.json:434, 476, 566, 655, 942, 1542, 1632, 1808: `screen.home`, Beranda
- mobile/flows/screens.json:454, 544, 633, 722, 774, 784, 800, 821, 873, 883, 899, 920, 1047, 1099, 1109, 1125, 1146, 1198, 1208, 1224, 1245, 1297, 1307, 1323, 1344, 1396, 1406, 1422, 1499, 1520, 1610, 1720, 1786, 2107, 2130, 2169, 2222, 2278, 2327, 2354, 2381, 2408, 2435, 2462, 2489, 2516, 2543, 2570, 2597, 2624, 2651, 2678, 2705, 2716, 2743, 2754, 2781, 2792, 2819, 2830, 2857, 2868, 2924, 2935, 2991, 3002, 3058, 3069, 3125, 3136, 3153, 3170, 3216, 3262, 3303, 3341, 3389, 3422, 3434, 3541, 3553, 3671: `sheet\.(nowClass|class)`, Beranda (also drawn in screens/schedule/details.tsx)
- mobile/flows/screens.json:464, 554, 643, 930, 1530, 1620, 1796: `screen\.(home|needs)|sheet\.nowClass`, Beranda
- mobile/flows/screens.json:488, 588, 612, 677, 701, 964, 997, 1007, 1023, 1453, 1554, 1644, 1820: `sheet.nowClass`, Beranda
- mobile/flows/screens.json:498, 520, 578, 667, 954, 1443, 1564, 1586, 1654, 1676, 1710: `screen.needs`, Beranda
- mobile/flows/screens.json:505, 514, 1571, 1580, 1661, 1670: `action.needs.all`, Beranda
- mobile/flows/screens.json:597, 606: `row.today.class:2153983`, Beranda
- mobile/flows/screens.json:686, 695: `row.today.class:2194402`, Beranda
- mobile/flows/screens.json:732, 831, 1057, 1156, 1255, 1354: `screen\.(course|needs)`, Beranda (also drawn in screens/course/course-screen.tsx)
- mobile/flows/screens.json:740, 839, 1065, 1164, 1263, 1362, 1461, 2115, 2138, 2177, 3318, 3351: `tab.schedule`, tab bar
- mobile/flows/screens.json:971, 991, 1014: `action.nowClass`, Beranda
- mobile/flows/screens.json:981: `action.syncStatus`, top bar and Beranda (also drawn in screens/home/header.tsx, screens/schedule/schedule-screen.tsx; also drawn in screens/schedule/schedule-screen.tsx, shell/source-status.tsx)
- mobile/flows/screens.json:1687: `section.changes`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/flows/screens.json:1756, 1855, 1900, 3687, 3736, 3807, 3878, 4016, 4154, 4292, 4430, 4568, 5121, 5200, 5271: `tab.courses`, tab bar
- mobile/flows/screens.json:1840, 5354: `action.alerts`, top bar
- mobile/flows/screens.json:1916, 1943, 1974, 2017: `tab.tasks`, tab bar
- mobile/flows/screens.json:3402, 3521: `sheet\.(nowClass|class|course)|screen\.course`, Beranda (also drawn in screens/course/course-screen.tsx, screens/course/course-sheet.tsx, screens/schedule/details.tsx)
- mobile/flows/screens.json:3440, 3559: `action.openCourse`, Beranda (also drawn in screens/schedule/details.tsx)
- mobile/flows/screens.json:4598, 4605, 4635, 4642: `row.nav.grades`, Akademik
- mobile/flows/screens.json:4710, 4717, 4739, 4746: `row.nav.plan.planner`, Akademik
- mobile/flows/screens.json:4793, 4800: `row.nav.plan.curriculum`, Akademik
- mobile/flows/screens.json:4821, 4828: `row.nav.plan.krs`, Akademik
- mobile/flows/screens.json:4849, 4856: `row.nav.plan.bills`, Akademik
- mobile/flows/screens.json:4877, 4884: `row.nav.plan.deadlines`, Akademik
- mobile/flows/screens.json:5335: `action.search`, top bar

### `mobile/flows/smoke.yaml`

Run by: CI `e2e (app)`: .github/workflows/mobile.yml, through scripts/ci/mobile-e2e.sh (`*.yaml` of mobile/flows), on a pull request or push that changes mobile/, every night and by hand; `mobile/qa/superapp-flows.md`; `.github/workflows/mobile.yml`

- mobile/flows/smoke.yaml:8: `tab.home`, tab bar
- mobile/flows/smoke.yaml:12: `status.settling`, top bar
- mobile/flows/smoke.yaml:15: `screen.home`, Beranda
- mobile/flows/smoke.yaml:17: text "(Pagi|Siang|Sore|Malam), Dimas", Beranda (the greeting, header.tsx)
- mobile/flows/smoke.yaml:19: `card.now`, Beranda
- mobile/flows/smoke.yaml:20: text "Ekonomi dan Inovasi dalam Perencanaan", Beranda? (after `tab.home` at line 8, nothing else tapped since)

### `mobile/flows/use.yaml`

Run by: CI `e2e (app)`: .github/workflows/mobile.yml, through scripts/ci/mobile-e2e.sh (`*.yaml` of mobile/flows), on a pull request or push that changes mobile/, every night and by hand; `mobile/flows/round2/w10-hand-in-moment.yaml`; `mobile/qa/emu.sh`; `mobile/qa/superapp-flows.md`; `scripts/ci/mobile-e2e.sh`

- mobile/flows/use.yaml:10: `tab.home`, tab bar
- mobile/flows/use.yaml:14: `status.settling`, top bar
- mobile/flows/use.yaml:20: `tab.tasks`, tab bar
- mobile/flows/use.yaml:97: `tab.schedule`, tab bar
- mobile/flows/use.yaml:145: `tab.courses`, tab bar
- mobile/flows/use.yaml:163: `action.account`, top bar

### `mobile/qa/flows/before.yaml`

Run by: `mobile/qa/BASELINE.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/before.yaml:8: `tab.home`, tab bar
- mobile/qa/flows/before.yaml:13: `action.alerts`, top bar
- mobile/qa/flows/before.yaml:19: `action.search`, top bar
- mobile/qa/flows/before.yaml:27: `tab.tasks`, tab bar
- mobile/qa/flows/before.yaml:45: `tab.tasks`, tab bar
- mobile/qa/flows/before.yaml:53: `tab.schedule`, tab bar
- mobile/qa/flows/before.yaml:65: `row.nav.grades`, Akademik

### `mobile/qa/flows/flashlight.yaml`

Run by: `mobile/qa/BASELINE.md`; `mobile/qa/README.md`; `mobile/qa/flashlight.sh`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/flashlight.yaml:8: `tab.home`, tab bar
- mobile/qa/flows/flashlight.yaml:11: `tab.tasks`, tab bar
- mobile/qa/flows/flashlight.yaml:16: `tab.schedule`, tab bar
- mobile/qa/flows/flashlight.yaml:18: `tab\.(courses|presence)`, tab bar
- mobile/qa/flows/flashlight.yaml:20: `tab\.(academic|more)`, tab bar
- mobile/qa/flows/flashlight.yaml:22: `tab.home`, tab bar

### `mobile/qa/flows/home-idle-scroll.yaml`

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/home-idle-scroll.yaml:7: `tab.home`, tab bar

### `mobile/qa/flows/home-shots.yaml`

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/home-shots.yaml:18: `status.firstRead`, top bar
- mobile/qa/flows/home-shots.yaml:24: `status.firstRead`, top bar
- mobile/qa/flows/home-shots.yaml:28: `card.firstScan`, Beranda
- mobile/qa/flows/home-shots.yaml:39: `card.now`, Beranda
- mobile/qa/flows/home-shots.yaml:43: `status.settling`, top bar
- mobile/qa/flows/home-shots.yaml:46: `action.notify.later`, Beranda
- mobile/qa/flows/home-shots.yaml:50: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/home-shots.yaml:56: `action.nowClass`, Beranda
- mobile/qa/flows/home-shots.yaml:59: `sheet.nowClass`, Beranda
- mobile/qa/flows/home-shots.yaml:66: `section.today`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/qa/flows/home-shots.yaml:73: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/home-shots.yaml:78: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/home-shots.yaml:83: `card.now.checkedIn`, Beranda
- mobile/qa/flows/home-shots.yaml:89: `action.needs.all`, Beranda
- mobile/qa/flows/home-shots.yaml:92: `screen.needs`, Beranda
- mobile/qa/flows/home-shots.yaml:98: `row.need.attendance:KU5014:out`, Beranda
- mobile/qa/flows/home-shots.yaml:102: text "Urungkan", Beranda? (after `card.firstScan` at line 28, nothing else tapped since)
- mobile/qa/flows/home-shots.yaml:104: text "Urungkan", Beranda? (after `card.firstScan` at line 28, nothing else tapped since)
- mobile/qa/flows/home-shots.yaml:108: `row.need.exam:DK4073-UTS`, Beranda

### `mobile/qa/flows/home-tour.yaml`

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/home-tour.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/home-tour.yaml:8: `action.notify.later`, Beranda
- mobile/qa/flows/home-tour.yaml:14: `action.nowClass`, Beranda
- mobile/qa/flows/home-tour.yaml:17: `sheet.nowClass`, Beranda
- mobile/qa/flows/home-tour.yaml:24: `tab.schedule`, tab bar
- mobile/qa/flows/home-tour.yaml:26: `tab.home`, tab bar
- mobile/qa/flows/home-tour.yaml:29: `row.today.class:2153983`, Beranda
- mobile/qa/flows/home-tour.yaml:36: `row.today.class:2153983`, Beranda
- mobile/qa/flows/home-tour.yaml:39: `sheet.nowClass`, Beranda
- mobile/qa/flows/home-tour.yaml:44: `action.needs.all`, Beranda
- mobile/qa/flows/home-tour.yaml:50: `action.needs.all`, Beranda
- mobile/qa/flows/home-tour.yaml:53: `screen.needs`, Beranda

### `mobile/qa/flows/kuliah-shots.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/kuliah-shots.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/kuliah-shots.yaml:13: `status.settling`, top bar
- mobile/qa/flows/kuliah-shots.yaml:16: `action.notify.later`, Beranda
- mobile/qa/flows/kuliah-shots.yaml:19: `tab.courses`, tab bar

### `mobile/qa/flows/r2-akademik.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r2-akademik.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/r2-akademik.yaml:12: `tab.academic`, tab bar
- mobile/qa/flows/r2-akademik.yaml:15: `card.profile`, Akademik (also drawn in screens/settings/accounts.tsx)
- mobile/qa/flows/r2-akademik.yaml:20: `card.profile`, Akademik (also drawn in screens/settings/accounts.tsx)
- mobile/qa/flows/r2-akademik.yaml:36: `row.nav.plan.planner`, Akademik
- mobile/qa/flows/r2-akademik.yaml:38: `row.nav.plan.planner`, Akademik
- mobile/qa/flows/r2-akademik.yaml:44: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/r2-akademik.yaml:46: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/r2-akademik.yaml:52: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/r2-akademik.yaml:54: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/r2-akademik.yaml:60: `row.nav.plan.bills`, Akademik
- mobile/qa/flows/r2-akademik.yaml:62: `row.nav.plan.bills`, Akademik
- mobile/qa/flows/r2-akademik.yaml:68: `row.nav.plan.deadlines`, Akademik
- mobile/qa/flows/r2-akademik.yaml:70: `row.nav.plan.deadlines`, Akademik
- mobile/qa/flows/r2-akademik.yaml:75: `action.account`, top bar
- mobile/qa/flows/r2-akademik.yaml:95: `action.search`, top bar
- mobile/qa/flows/r2-akademik.yaml:104: `tab.home`, tab bar
- mobile/qa/flows/r2-akademik.yaml:106: `action.alerts`, top bar

### `mobile/qa/flows/r2-tasks-academic.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r2-tasks-academic.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:12: `tab.tasks`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:44: `tab.academic`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:49: `row.nav.grades`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:52: `row.nav.grades`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:63: `row.nav.plan.planner`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:65: `row.nav.plan.planner`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:71: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:73: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:79: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:81: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:87: `row.nav.plan.bills`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:89: `row.nav.plan.bills`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:95: `row.nav.plan.deadlines`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:97: `row.nav.plan.deadlines`, Akademik
- mobile/qa/flows/r2-tasks-academic.yaml:102: `action.account`, top bar
- mobile/qa/flows/r2-tasks-academic.yaml:116: `action.search`, top bar
- mobile/qa/flows/r2-tasks-academic.yaml:125: `tab.home`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:127: `action.alerts`, top bar

### `mobile/qa/flows/r3/01-today-due.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/01-today-due.yaml:18: `screen.home`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:23: `home.loading`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:27: `card.now.reading`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:31: `section.needs.reading`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/qa/flows/r3/01-today-due.yaml:34: `card.now`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:39: `action.needs.all`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:44: `screen.home`, Beranda

### `mobile/qa/flows/r3/02-task-file.yaml`

Run by: `mobile/qa/flows/r3/_next-task.yaml`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/02-task-file.yaml:20: `screen.home`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:24: `home.loading`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:28: `section.needs.reading`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/qa/flows/r3/02-task-file.yaml:82: `screen\..*`, Beranda and Akademik (also drawn in screens/course/course-screen.tsx, screens/course/module-screen.tsx, screens/first-scan/first-scan-screen.tsx, …)

### `mobile/qa/flows/r3/03-tandai-hadir.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/03-tandai-hadir.yaml:21: `screen.home`, Beranda
- mobile/qa/flows/r3/03-tandai-hadir.yaml:25: `home.loading`, Beranda
- mobile/qa/flows/r3/03-tandai-hadir.yaml:29: `card.now.reading`, Beranda
- mobile/qa/flows/r3/03-tandai-hadir.yaml:36: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:39: `tab.courses`, tab bar
- mobile/qa/flows/r3/03-tandai-hadir.yaml:51: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:59: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:68: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:74: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:78: `screen\.(home|courses)`, Beranda (also drawn in screens/presence/presence-screen.tsx)

### `mobile/qa/flows/r3/04-course-material.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/04-course-material.yaml:17: `screen.home`, Beranda
- mobile/qa/flows/r3/04-course-material.yaml:20: `tab.courses`, tab bar

### `mobile/qa/flows/r3/05-grades.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/05-grades.yaml:16: `screen.home`, Beranda
- mobile/qa/flows/r3/05-grades.yaml:19: `tab.academic`, tab bar
- mobile/qa/flows/r3/05-grades.yaml:23: `screen.academic`, Akademik
- mobile/qa/flows/r3/05-grades.yaml:27: `academic.loading`, Akademik
- mobile/qa/flows/r3/05-grades.yaml:32: `action.academic.grades`, Akademik
- mobile/qa/flows/r3/05-grades.yaml:35: `action.academic.grades`, Akademik
- mobile/qa/flows/r3/05-grades.yaml:49: `row.nav.grades`, Akademik
- mobile/qa/flows/r3/05-grades.yaml:53: `row.nav.grades`, Akademik

### `mobile/qa/flows/r3/_next-task.yaml`

Run by: `mobile/qa/flows/r3/02-task-file.yaml`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/r3/_next-task.yaml:20: `tab.tasks`, tab bar

### `mobile/qa/flows/rec-cold.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-cold.yaml:9: `tab.home`, tab bar

### `mobile/qa/flows/rec-home-first-run.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-home-first-run.yaml:15: `tab.home`, tab bar
- mobile/qa/flows/rec-home-first-run.yaml:19: `status.settling`, top bar
- mobile/qa/flows/rec-home-first-run.yaml:23: `status.firstRead`, top bar
- mobile/qa/flows/rec-home-first-run.yaml:27: `card.firstScan`, Beranda
- mobile/qa/flows/rec-home-first-run.yaml:33: `action.firstScan.open`, Beranda

### `mobile/qa/flows/rec-home-v4.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-home-v4.yaml:9: `card.now`, Beranda
- mobile/qa/flows/rec-home-v4.yaml:13: `status.settling`, top bar
- mobile/qa/flows/rec-home-v4.yaml:16: `action.notify.later`, Beranda
- mobile/qa/flows/rec-home-v4.yaml:20: `row.today.class:2153983`, Beranda
- mobile/qa/flows/rec-home-v4.yaml:23: `sheet.nowClass`, Beranda
- mobile/qa/flows/rec-home-v4.yaml:28: `tab.schedule`, tab bar
- mobile/qa/flows/rec-home-v4.yaml:31: `tab.home`, tab bar
- mobile/qa/flows/rec-home-v4.yaml:34: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/rec-home-v4.yaml:39: `card.now.checkedIn`, Beranda

### `mobile/qa/flows/rec-module.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-module.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/rec-module.yaml:9: `tab\.(courses|more)`, tab bar

### `mobile/qa/flows/rec-sheet.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-sheet.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/rec-sheet.yaml:9: `tab\.(courses|more)`, tab bar

### `mobile/qa/flows/rec-tabs.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/rec-tabs.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/rec-tabs.yaml:9: `tab.tasks`, tab bar
- mobile/qa/flows/rec-tabs.yaml:11: `tab.schedule`, tab bar
- mobile/qa/flows/rec-tabs.yaml:13: `tab\.(courses|presence)`, tab bar
- mobile/qa/flows/rec-tabs.yaml:15: `tab\.(academic|more)`, tab bar
- mobile/qa/flows/rec-tabs.yaml:17: `tab.home`, tab bar

### `mobile/qa/flows/schedule-shots.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/schedule-shots.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/schedule-shots.yaml:13: `status.settling`, top bar
- mobile/qa/flows/schedule-shots.yaml:17: `tab.schedule`, tab bar
- mobile/qa/flows/schedule-shots.yaml:28: `sheet.nowClass`, Beranda

### `mobile/qa/flows/shell-tabs-round1.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tabs-round1.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:82: `tab.home`, tab bar

### `mobile/qa/flows/shell-tabs.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tabs.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:16: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:19: `tab.academic`, tab bar
- mobile/qa/flows/shell-tabs.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:31: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:34: `tab.academic`, tab bar
- mobile/qa/flows/shell-tabs.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:46: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:49: `tab.academic`, tab bar
- mobile/qa/flows/shell-tabs.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:61: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:64: `tab.academic`, tab bar
- mobile/qa/flows/shell-tabs.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:76: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:79: `tab.academic`, tab bar
- mobile/qa/flows/shell-tabs.yaml:82: `tab.home`, tab bar

### `mobile/qa/flows/shell-tour-round1.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tour-round1.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:82: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:105: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour-round1.yaml:108: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour-round1.yaml:153: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour-round1.yaml:156: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour-round1.yaml:201: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour-round1.yaml:204: `row.nav.grades`, Akademik

### `mobile/qa/flows/shell-tour.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tour.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:16: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:19: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:31: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:34: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:46: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:49: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:61: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:64: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:76: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:79: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:82: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:85: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:101: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:105: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:108: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:117: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:121: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:124: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:133: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:137: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:140: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:149: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:165: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:169: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:172: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:181: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:185: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:188: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:197: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:201: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:204: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:213: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:229: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:233: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:236: `row.nav.grades`, Akademik
- mobile/qa/flows/shell-tour.yaml:245: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:249: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:252: `row.nav.plan.krs`, Akademik
- mobile/qa/flows/shell-tour.yaml:261: `tab.academic`, tab bar
- mobile/qa/flows/shell-tour.yaml:265: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:268: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/shell-tour.yaml:277: `tab.courses`, tab bar

### `mobile/qa/flows/to-courses.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-courses.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-courses.yaml:9: `tab.courses`, tab bar

### `mobile/qa/flows/to-curriculum.yaml`

Run by: `mobile/qa/README.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-curriculum.yaml:7: `tab.home`, tab bar
- mobile/qa/flows/to-curriculum.yaml:10: `tab\.(academic|more)`, tab bar
- mobile/qa/flows/to-curriculum.yaml:14: `row.nav.plan.curriculum`, Akademik
- mobile/qa/flows/to-curriculum.yaml:17: `row.nav.plan.curriculum`, Akademik

### `mobile/qa/flows/to-schedule.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-schedule.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-schedule.yaml:9: `tab.schedule`, tab bar

### `mobile/qa/flows/to-tasks.yaml`

Run by: `mobile/qa/README.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-tasks.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-tasks.yaml:9: `tab.tasks`, tab bar

### `mobile/qa/flows/v4-tasks.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/v4-tasks.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/v4-tasks.yaml:12: `tab.tasks`, tab bar
- mobile/qa/flows/v4-tasks.yaml:19: `tab.tasks`, tab bar

### The ids most used (how many flow files name each)

| id | on | flow files | mentions |
| --- | --- | ---: | ---: |
| `tab.home` | tab bar | 42 | 80 |
| `tab.tasks` | tab bar | 16 | 37 |
| `tab.schedule` | tab bar | 15 | 42 |
| `status.settling` | top bar | 15 | 18 |
| `sheet.nowClass` | Beranda | 10 | 24 |
| `tab.courses` | tab bar | 9 | 35 |
| `tab.academic` | tab bar | 8 | 39 |
| `row.nav.grades` | Akademik | 7 | 23 |
| `screen.home` | Beranda | 7 | 15 |
| `row.nav.plan.curriculum` | Akademik | 6 | 15 |
| `action.needs.all` | Beranda | 6 | 12 |
| `action.account` | top bar | 6 | 11 |
| `screen.needs` | Beranda | 5 | 15 |
| `row.nav.plan.krs` | Akademik | 5 | 13 |
| `action.nowClass` | Beranda | 5 | 7 |
| `card.firstScan` | Beranda | 5 | 6 |
| `action.search` | top bar | 5 | 6 |
| `action.alerts` | top bar | 5 | 6 |
| `card.now` | Beranda | 5 | 5 |
| `action.checkIn` | Beranda | 4 | 11 |
| `row.nav.plan.planner` | Akademik | 4 | 9 |
| `row.nav.plan.bills` | Akademik | 4 | 7 |
| `row.nav.plan.deadlines` | Akademik | 4 | 7 |
| `action.firstScan.open` | Beranda | 4 | 4 |
| `action.notify.later` | Beranda | 4 | 4 |
| `row.today.class:2153983` | Beranda | 3 | 5 |
| `status.firstRead` | top bar | 3 | 4 |
| `section.today` | Beranda | 3 | 3 |
| `card.now.checkedIn` | Beranda | 3 | 3 |
| `tab\.(academic|more)` | tab bar | 3 | 3 |

### Flows with nothing on those surfaces

- `mobile/flows/judge-dark.yaml`
- `mobile/flows/judge-light.yaml`
- `mobile/flows/judge/tab.yaml`
- `mobile/flows/round2/w05-refresh.sh`
- `mobile/qa/flows/before-welcome.yaml`
- `mobile/qa/flows/r3/run.sh`

### Ids no source file draws today (flows already waiting for something gone)

- mobile/flows/round2/w01-files.yaml:59: `row.module.2-catatan`
- mobile/flows/round2/w01-files.yaml:61: `row.module.2-catatan`
- mobile/flows/round2/w04-jadwal.yaml:27: `segment.view.*`
- mobile/flows/round2/w11-kuliah.yaml:37: `mark.counted.*`
- mobile/flows/round2/w11-kuliah.yaml:55: `action.changeTarget.*`
- mobile/flows/round2/w11-kuliah.yaml:82: `mark.courseAdvice`
- mobile/flows/round2/w12-one-target.yaml:47: `action.openExternal`
- mobile/flows/round2/w15-onboarding.yaml:14: `action.start`
- mobile/flows/screens.json:753: `day.2026-10-08`
- mobile/flows/screens.json:852: `day.2026-10-08`
- mobile/flows/screens.json:1078: `day.2026-10-08`
- mobile/flows/screens.json:1177: `day.2026-10-08`
- mobile/flows/screens.json:1276: `day.2026-10-08`
- mobile/flows/screens.json:1375: `day.2026-10-08`
- mobile/flows/screens.json:1472: `day.2026-10-09`
- mobile/flows/screens.json:1481: `day.2026-10-09`
- mobile/flows/screens.json:1730: `sheet.changes`
- mobile/flows/screens.json:2246: `day.2026-10-08`
- mobile/flows/screens.json:2287: `day.2026-10-08`
- mobile/flows/screens.json:2296: `day.2026-10-08`
- mobile/flows/screens.json:2336: `day.2026-10-01`
- mobile/flows/screens.json:2345: `day.2026-10-01`
- mobile/flows/screens.json:2363: `day.2026-10-08`
- mobile/flows/screens.json:2372: `day.2026-10-08`
- mobile/flows/screens.json:2390: `day.2026-10-09`
- mobile/flows/screens.json:2399: `day.2026-10-09`
- mobile/flows/screens.json:2417: `day.2026-10-15`
- mobile/flows/screens.json:2426: `day.2026-10-15`
- mobile/flows/screens.json:2444: `day.2026-10-16`
- mobile/flows/screens.json:2453: `day.2026-10-16`
- mobile/flows/screens.json:2471: `day.2026-10-22`
- mobile/flows/screens.json:2480: `day.2026-10-22`
- mobile/flows/screens.json:2498: `day.2026-10-29`
- mobile/flows/screens.json:2507: `day.2026-10-29`
- mobile/flows/screens.json:2525: `day.2026-10-30`
- mobile/flows/screens.json:2534: `day.2026-10-30`
- mobile/flows/screens.json:2552: `day.2026-10-01`
- mobile/flows/screens.json:2561: `day.2026-10-01`
- mobile/flows/screens.json:2579: `day.2026-10-08`
- mobile/flows/screens.json:2588: `day.2026-10-08`
- mobile/flows/screens.json:2606: `day.2026-10-09`
- mobile/flows/screens.json:2615: `day.2026-10-09`
- mobile/flows/screens.json:2633: `day.2026-10-15`
- mobile/flows/screens.json:2642: `day.2026-10-15`
- mobile/flows/screens.json:2660: `day.2026-10-29`
- mobile/flows/screens.json:2669: `day.2026-10-29`
- mobile/flows/screens.json:2686: `day.2026-10-08`
- mobile/flows/screens.json:2724: `day.2026-10-08`
- mobile/flows/screens.json:2762: `day.2026-10-08`
- mobile/flows/screens.json:2800: `day.2026-10-08`
- mobile/flows/screens.json:2838: `day.2026-10-09`
- mobile/flows/screens.json:2905: `day.2026-10-15`
- mobile/flows/screens.json:2972: `day.2026-10-15`
- mobile/flows/screens.json:3039: `day.2026-10-15`
- mobile/flows/screens.json:3106: `day.2026-10-15`
- mobile/flows/screens.json:3144: `day.2026-10-08`
- mobile/flows/screens.json:3161: `day.2026-10-09`
- mobile/flows/screens.json:3207: `day.2026-10-15`
- mobile/flows/screens.json:3253: `day.2026-10-16`
- mobile/flows/screens.json:3362: `day.2026-10-09`
- mobile/flows/screens.json:3371: `day.2026-10-09`
- mobile/flows/screens.json:3747: `card.kuliahNumber`
- mobile/flows/screens.json:3756: `card.kuliahNumber`
- mobile/flows/screens.json:3818: `card.kuliahNumber`
- mobile/flows/screens.json:3827: `card.kuliahNumber`
- mobile/flows/screens.json:4651: `row.term.{{2}}`
- mobile/flows/screens.json:4662: `row.term.{{2}}`
- mobile/flows/screens.json:4669: `row.term.{{2}}`
- mobile/flows/screens.json:4682: `row.term.{{2}}.open`
- mobile/flows/screens.json:4688: `row.term.{{2}}`
- mobile/flows/screens.json:5250: `row.module.{{3}}`
- mobile/flows/screens.json:5256: `row.module.{{3}}`
- mobile/flows/use.yaml:136: `day.2026-10-15`
- mobile/qa/flows/before-welcome.yaml:8: `action.start`
- mobile/qa/flows/before-welcome.yaml:13: `action.start`
- mobile/qa/flows/before-welcome.yaml:17: `action.connect.edunex`
- mobile/qa/flows/before.yaml:57: `tab.presence`
- mobile/qa/flows/before.yaml:61: `tab.more`
- mobile/qa/flows/before.yaml:75: `row.nav.plan`
- mobile/qa/flows/before.yaml:78: `screen.plan`
- mobile/qa/flows/before.yaml:108: `row.nav.settings`
- mobile/qa/flows/before.yaml:111: `row.nav.settings`
- mobile/qa/flows/home-idle-scroll.yaml:11: `nothing.here`
- mobile/qa/flows/home-tour.yaml:60: `card.need.exam:DK4073-UTS`
- mobile/qa/flows/kuliah-shots.yaml:82: `row.module.2-catatan`
- mobile/qa/flows/kuliah-shots.yaml:86: `row.module.2-catatan`
- mobile/qa/flows/r3/02-task-file.yaml:35: `card\.need\.task:.*`
- mobile/qa/flows/r3/02-task-file.yaml:38: `card\.need\.task:.*`
- mobile/qa/flows/r3/04-course-material.yaml:46: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:54: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:63: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:66: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:81: `row\.module\..*`
- mobile/qa/flows/rec-module.yaml:24: `row.module.modul-3`
- mobile/qa/flows/rec-module.yaml:28: `row.material.880004`
- mobile/qa/flows/shell-tabs-round1.yaml:16: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:19: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:31: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:34: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:46: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:49: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:61: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:64: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:76: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:79: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:16: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:19: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:31: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:34: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:46: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:49: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:61: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:64: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:76: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:79: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:85: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:101: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:117: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:121: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:124: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:127: `screen.plan`
- mobile/qa/flows/shell-tour-round1.yaml:133: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:149: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:165: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:169: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:172: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:175: `screen.plan`
- mobile/qa/flows/shell-tour-round1.yaml:181: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:197: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:213: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:217: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:220: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:223: `screen.plan`
- mobile/qa/flows/shell-tour.yaml:287: `row.module.*`
- mobile/qa/flows/shell-tour.yaml:290: `row.module.*`
- mobile/qa/flows/to-curriculum.yaml:25: `row.nav.plan`
- mobile/qa/flows/to-curriculum.yaml:28: `row.nav.plan`
- mobile/qa/flows/to-curriculum.yaml:31: `screen.plan`
- mobile/qa/flows/to-curriculum.yaml:34: `tab.plan.curriculum`

<!-- flows:end -->
