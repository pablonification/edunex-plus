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

### `mobile/flows/journeys/01-morning.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/01-morning.yaml:10: `tab.home`, tab bar
- mobile/flows/journeys/01-morning.yaml:14: `status.settling`, top bar
- mobile/flows/journeys/01-morning.yaml:18: `home.search`, Beranda
- mobile/flows/journeys/01-morning.yaml:21: `home.now`, Beranda
- mobile/flows/journeys/01-morning.yaml:22: text ".*Ekonomi dan Inovasi dalam Perencanaan.*", Beranda? (after `tab.home` at line 10, nothing else tapped since)
- mobile/flows/journeys/01-morning.yaml:25: `home.strip`, Beranda
- mobile/flows/journeys/01-morning.yaml:28: `home.grid`, Beranda
- mobile/flows/journeys/01-morning.yaml:31: `tab.home`, tab bar
- mobile/flows/journeys/01-morning.yaml:33: `tab.profile`, tab bar
- mobile/flows/journeys/01-morning.yaml:36: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)

### `mobile/flows/journeys/02-class-starts.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/02-class-starts.yaml:10: `tab.home`, tab bar
- mobile/flows/journeys/02-class-starts.yaml:14: `status.settling`, top bar
- mobile/flows/journeys/02-class-starts.yaml:18: `home.now`, Beranda
- mobile/flows/journeys/02-class-starts.yaml:23: `action\.(presence|checkIn)`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/flows/journeys/02-class-starts.yaml:34: `home.now`, Beranda
- mobile/flows/journeys/02-class-starts.yaml:40: `card.now.checkedIn`, Beranda
- mobile/flows/journeys/02-class-starts.yaml:42: `action\.(presence|checkIn)`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)

### `mobile/flows/journeys/03-deadline.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/03-deadline.yaml:11: `tab.home`, tab bar
- mobile/flows/journeys/03-deadline.yaml:15: `status.settling`, top bar
- mobile/flows/journeys/03-deadline.yaml:81: text "Berikutnya.*", Beranda? (string `mobile.home.next`, `done.toast.gotItClass` is used there)

### `mobile/flows/journeys/04-after-class.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/04-after-class.yaml:9: `tab.home`, tab bar
- mobile/flows/journeys/04-after-class.yaml:13: `status.settling`, top bar
- mobile/flows/journeys/04-after-class.yaml:18: `action.service.material`, Beranda (also drawn in screens/services/services-screen.tsx)
- mobile/flows/journeys/04-after-class.yaml:45: `home.grid`, Beranda

### `mobile/flows/journeys/05-after-exam.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/05-after-exam.yaml:10: `tab.home`, tab bar
- mobile/flows/journeys/05-after-exam.yaml:14: `status.settling`, top bar
- mobile/flows/journeys/05-after-exam.yaml:18: `action.service.grades`, Beranda (also drawn in screens/services/services-screen.tsx)
- mobile/flows/journeys/05-after-exam.yaml:54: `home.grid`, Beranda

### `mobile/flows/journeys/06-office.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/06-office.yaml:11: `tab.home`, tab bar
- mobile/flows/journeys/06-office.yaml:15: `status.settling`, top bar
- mobile/flows/journeys/06-office.yaml:20: `tab.profile`, tab bar
- mobile/flows/journeys/06-office.yaml:23: `screen.profile`, Profil
- mobile/flows/journeys/06-office.yaml:28: `row.nav.plan.krs`, Profil
- mobile/flows/journeys/06-office.yaml:32: `row.nav.plan.krs`, Profil
- mobile/flows/journeys/06-office.yaml:42: `row.nav.plan.bills`, Profil
- mobile/flows/journeys/06-office.yaml:46: `row.nav.plan.bills`, Profil
- mobile/flows/journeys/06-office.yaml:56: `row.nav.plan.deadlines`, Profil
- mobile/flows/journeys/06-office.yaml:60: `row.nav.plan.deadlines`, Profil
- mobile/flows/journeys/06-office.yaml:69: `tab.home`, tab bar
- mobile/flows/journeys/06-office.yaml:72: `home.grid`, Beranda
- mobile/flows/journeys/06-office.yaml:76: `action.service.krs`, Beranda (also drawn in screens/services/services-screen.tsx)
- mobile/flows/journeys/06-office.yaml:85: `home.grid`, Beranda
- mobile/flows/journeys/06-office.yaml:88: `action.service.bills`, Beranda (also drawn in screens/services/services-screen.tsx)
- mobile/flows/journeys/06-office.yaml:97: `home.grid`, Beranda
- mobile/flows/journeys/06-office.yaml:100: `action.service.calendar`, Beranda (also drawn in screens/services/services-screen.tsx)

### `mobile/flows/journeys/07-search.yaml`

Run by: `mobile/flows/journeys/README.md`

- mobile/flows/journeys/07-search.yaml:10: `tab.home`, tab bar
- mobile/flows/journeys/07-search.yaml:14: `status.settling`, top bar
- mobile/flows/journeys/07-search.yaml:18: `home.search`, Beranda
- mobile/flows/journeys/07-search.yaml:47: `home.search`, Beranda

### `mobile/flows/judge/edunex-only.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/tab.yaml`; `mobile/flows/judge/walk.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-map.md`

- mobile/flows/judge/edunex-only.yaml:7: `tab.home`, tab bar
- mobile/flows/judge/edunex-only.yaml:11: `status.settling`, top bar

### `mobile/flows/judge/first-run.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/walk.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/flows-check.mjs`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-map.md`

- mobile/flows/judge/first-run.yaml:18: `status.firstRead`, top bar (also drawn in shell/first-minute/scene.tsx)
- mobile/flows/judge/first-run.yaml:24: `card.firstScan`, Beranda
- mobile/flows/judge/first-run.yaml:29: `action.firstScan.open`, Beranda

### `mobile/flows/judge/walk.yaml`

Run by: not run on its own (mobile-e2e.sh skips `judge/`); `mobile/flows/judge/tab.yaml`; `mobile/flows/judge-dark.yaml`; `mobile/flows/judge-light.yaml`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`; `mobile/qa/superapp-map.md`; `mobile/scripts/make-report.mjs`

- mobile/flows/judge/walk.yaml:11: `tab.home`, tab bar
- mobile/flows/judge/walk.yaml:15: `status.settling`, top bar
- mobile/flows/judge/walk.yaml:21: `action.needs.all`, Beranda
- mobile/flows/judge/walk.yaml:24: `screen.needs`, Beranda
- mobile/flows/judge/walk.yaml:135: `sheet.nowClass`, Beranda
- mobile/flows/judge/walk.yaml:202: `row.nav.grades`, Profil
- mobile/flows/judge/walk.yaml:206: `row.nav.grades`, Profil
- mobile/flows/judge/walk.yaml:216: `row.nav.plan.planner`, Profil
- mobile/flows/judge/walk.yaml:226: `row.nav.plan.curriculum`, Profil
- mobile/flows/judge/walk.yaml:236: `row.nav.plan.krs`, Profil
- mobile/flows/judge/walk.yaml:246: `row.nav.plan.bills`, Profil
- mobile/flows/judge/walk.yaml:256: `row.nav.plan.deadlines`, Profil
- mobile/flows/judge/walk.yaml:315: `home.search`, Beranda
- mobile/flows/judge/walk.yaml:318: `home.search`, Beranda
- mobile/flows/judge/walk.yaml:330: `tab.home`, tab bar
- mobile/flows/judge/walk.yaml:334: `status.settling`, top bar
- mobile/flows/judge/walk.yaml:337: `action.syncStatus`, top bar and Beranda (also drawn in parts/b-header.tsx, screens/home/index.tsx, screens/schedule/schedule-screen.tsx; also drawn in parts/b-header.tsx, screens/schedule/schedule-screen.tsx, shell/source-status.tsx)
- mobile/flows/judge/walk.yaml:339: `action.refreshNow`, top bar
- mobile/flows/judge/walk.yaml:343: text ".*Memperbarui.*", top bar? (string `sync.checking` is used there)
- mobile/flows/judge/walk.yaml:349: `action.alerts`, top bar (also drawn in parts/b-header.tsx)
- mobile/flows/judge/walk.yaml:362: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/flows/judge/walk.yaml:366: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)

### `mobile/flows/round2/w01-files.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w01-files.yaml:13: `tab.home`, tab bar
- mobile/flows/round2/w01-files.yaml:18: text "Slide Pengantar Proposal TA", Beranda? (after `tab.home` at line 13, nothing else tapped since)
- mobile/flows/round2/w01-files.yaml:21: text "Slide Pengantar Proposal TA", Beranda? (after `tab.home` at line 13, nothing else tapped since)

### `mobile/flows/round2/w04-hierarchy.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w04-hierarchy.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:13: `tab.tasks`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:44: `tab.profile`, tab bar
- mobile/flows/round2/w04-hierarchy.yaml:46: `action.academic.grades`, Profil
- mobile/flows/round2/w04-hierarchy.yaml:47: text "3,26", Profil? (after `tab.profile` at line 44, nothing else tapped since)

### `mobile/flows/round2/w04-home-hierarchy.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w04-home-hierarchy.yaml:12: `tab.home`, tab bar
- mobile/flows/round2/w04-home-hierarchy.yaml:16: `status.settling`, top bar
- mobile/flows/round2/w04-home-hierarchy.yaml:20: `home.now`, Beranda
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
- mobile/flows/round2/w09-native-ui.yaml:14: `tab.profile`, tab bar
- mobile/flows/round2/w09-native-ui.yaml:17: `screen.profile`, Profil
- mobile/flows/round2/w09-native-ui.yaml:21: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/flows/round2/w09-native-ui.yaml:25: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)

### `mobile/flows/round2/w10-check-in-done.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w10-check-in-done.yaml:11: `tab.home`, tab bar
- mobile/flows/round2/w10-check-in-done.yaml:15: `status.settling`, top bar
- mobile/flows/round2/w10-check-in-done.yaml:19: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/flows/round2/w10-check-in-done.yaml:22: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/flows/round2/w10-check-in-done.yaml:29: `card.now.checkedIn`, Beranda

### `mobile/flows/round2/w10-hand-in-moment.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w10-hand-in-moment.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w10-hand-in-moment.yaml:13: `tab.tasks`, tab bar

### `mobile/flows/round2/w11-kuliah.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w11-kuliah.yaml:15: `tab.home`, tab bar
- mobile/flows/round2/w11-kuliah.yaml:18: `tab.courses`, tab bar

### `mobile/flows/round2/w12-one-target-akademik.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w12-one-target-akademik.yaml:10: `tab.home`, tab bar
- mobile/flows/round2/w12-one-target-akademik.yaml:13: `tab.profile`, tab bar
- mobile/flows/round2/w12-one-target-akademik.yaml:15: `card.profile`, Profil (also drawn in screens/settings/accounts.tsx)
- mobile/flows/round2/w12-one-target-akademik.yaml:22: `tab.tasks`, tab bar

### `mobile/flows/round2/w12-one-target.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

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

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/flows/round2/w13-tandai-hadir.yaml:19: `tab.home`, tab bar
- mobile/flows/round2/w13-tandai-hadir.yaml:28: text "Kuliah sudah mulai . PL3002", Beranda? (after `tab.home` at line 19, nothing else tapped since)
- mobile/flows/round2/w13-tandai-hadir.yaml:31: text "Tandai Hadir", Beranda? (string `mobile.notification.checkIn` is used there)
- mobile/flows/round2/w13-tandai-hadir.yaml:33: text "Di aplikasi asli, halaman SIX terbuka di sini.*", Beranda? (after `tab.home` at line 19, nothing else tapped since)

### `mobile/flows/round2/w15-onboarding.yaml`

Run by: `mobile/qa/flows-check.mjs`; `mobile/qa/superapp-flows.md`

- mobile/flows/round2/w15-onboarding.yaml:23: `tab.home`, tab bar
- mobile/flows/round2/w15-onboarding.yaml:27: `status.settling`, top bar
- mobile/flows/round2/w15-onboarding.yaml:33: `card.firstScan`, Beranda
- mobile/flows/round2/w15-onboarding.yaml:38: `action.firstScan.open`, Beranda

### `mobile/flows/screens.json`

Run by: CI `e2e (<scenario>)` (nightly and full runs): mobile/scripts/flows-from-inventory.mjs makes mobile/flows/data/<scenario>/*.yaml from it and mobile/flows/expected/*.json; `mobile/qa/flows-check.mjs`; `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-flows.mjs`; `mobile/qa/superapp-journeys.md`; `mobile/scripts/flows-from-inventory.mjs`; `mobile/scripts/inventory.mjs`

- mobile/flows/screens.json:48, 144, 229, 305, 433, 474, 564, 653, 940, 1540, 1630, 1806, 1839: `tab.home`, tab bar
- mobile/flows/screens.json:56, 271: `status.settling`, top bar
- mobile/flows/screens.json:151, 173, 346, 368, 1872, 4586, 4623, 4698, 4727, 4781, 4809, 4837, 4865, 5377, 5399: `tab.profile`, tab bar
- mobile/flows/screens.json:157, 167, 352, 362, 1877, 5383, 5393: `screen.profile`, Profil
- mobile/flows/screens.json:182, 191, 377, 386, 5408, 5417: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/flows/screens.json:205: text ".*Sistem dan Teknologi Informasi.*", Profil? (after `tab.profile` at line 173, nothing else tapped since)
- mobile/flows/screens.json:237, 313: `card.firstScan`, Beranda
- mobile/flows/screens.json:263: `(tab\.home|screen\.welcome)`, tab bar (also drawn in shell/first-minute/scene.tsx)
- mobile/flows/screens.json:320: `action.firstScan.open`, Beranda
- mobile/flows/screens.json:438, 480, 570, 659, 946, 1546, 1636, 1812: `screen.home`, Beranda
- mobile/flows/screens.json:458, 548, 637, 726, 778, 788, 804, 825, 877, 887, 903, 924, 1051, 1103, 1113, 1129, 1150, 1202, 1212, 1228, 1249, 1301, 1311, 1327, 1348, 1400, 1410, 1426, 1503, 1524, 1614, 1724, 1790, 2111, 2134, 2173, 2226, 2282, 2331, 2358, 2385, 2412, 2439, 2466, 2493, 2520, 2547, 2574, 2601, 2628, 2655, 2682, 2709, 2720, 2747, 2758, 2785, 2796, 2823, 2834, 2861, 2872, 2928, 2939, 2995, 3006, 3062, 3073, 3129, 3140, 3157, 3174, 3220, 3266, 3307, 3345, 3393, 3426, 3438, 3545, 3557, 3675: `sheet\.(nowClass|class)`, Beranda (also drawn in screens/schedule/details.tsx)
- mobile/flows/screens.json:468, 558, 647, 934, 1534, 1624, 1800: `screen\.(home|needs)|sheet\.nowClass`, Beranda
- mobile/flows/screens.json:492, 592, 616, 681, 705, 968, 1001, 1011, 1027, 1457, 1558, 1648, 1824: `sheet.nowClass`, Beranda
- mobile/flows/screens.json:502, 524, 582, 671, 958, 1447, 1568, 1590, 1658, 1680, 1714: `screen.needs`, Beranda
- mobile/flows/screens.json:509, 518, 1575, 1584, 1665, 1674: `action.needs.all`, Beranda
- mobile/flows/screens.json:601, 610: `row.today.class:2153983`, Beranda
- mobile/flows/screens.json:690, 699: `row.today.class:2194402`, Beranda
- mobile/flows/screens.json:736, 835, 1061, 1160, 1259, 1358: `screen\.(course|needs)`, Beranda (also drawn in screens/course/course-screen.tsx)
- mobile/flows/screens.json:744, 843, 1069, 1168, 1267, 1366, 1465, 2119, 2142, 2181, 3322, 3355: `tab.schedule`, tab bar
- mobile/flows/screens.json:975, 995, 1018: `action.nowClass`, Beranda
- mobile/flows/screens.json:985: `action.syncStatus`, top bar and Beranda (also drawn in parts/b-header.tsx, screens/home/index.tsx, screens/schedule/schedule-screen.tsx; also drawn in parts/b-header.tsx, screens/schedule/schedule-screen.tsx, shell/source-status.tsx)
- mobile/flows/screens.json:1691: `section.changes`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/flows/screens.json:1760, 1859, 1904, 3691, 3740, 3806, 3872, 4010, 4148, 4286, 4424, 4562, 5115, 5194, 5265: `tab.courses`, tab bar
- mobile/flows/screens.json:1844, 5348: `action.alerts`, top bar (also drawn in parts/b-header.tsx)
- mobile/flows/screens.json:1920, 1947, 1978, 2021: `tab.tasks`, tab bar
- mobile/flows/screens.json:3406, 3525: `sheet\.(nowClass|class|course)|screen\.course`, Beranda (also drawn in screens/course/course-screen.tsx, screens/course/course-sheet.tsx, screens/schedule/details.tsx)
- mobile/flows/screens.json:3444, 3563: `action.openCourse`, Beranda (also drawn in screens/schedule/details.tsx)
- mobile/flows/screens.json:4592, 4599, 4629, 4636: `row.nav.grades`, Profil
- mobile/flows/screens.json:4704, 4711, 4733, 4740: `row.nav.plan.planner`, Profil
- mobile/flows/screens.json:4787, 4794: `row.nav.plan.curriculum`, Profil
- mobile/flows/screens.json:4815, 4822: `row.nav.plan.krs`, Profil
- mobile/flows/screens.json:4843, 4850: `row.nav.plan.bills`, Profil
- mobile/flows/screens.json:4871, 4878: `row.nav.plan.deadlines`, Profil
- mobile/flows/screens.json:5329: `action.search`, top bar (also drawn in parts/b-header.tsx)

### `mobile/flows/smoke.yaml`

Run by: CI `e2e (app)`: .github/workflows/mobile.yml, through scripts/ci/mobile-e2e.sh (`*.yaml` of mobile/flows), on a pull request or push that changes mobile/, every night and by hand; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`; `.github/workflows/mobile.yml`

- mobile/flows/smoke.yaml:8: `tab.home`, tab bar
- mobile/flows/smoke.yaml:12: `status.settling`, top bar
- mobile/flows/smoke.yaml:15: `screen.home`, Beranda
- mobile/flows/smoke.yaml:20: `home.search`, Beranda
- mobile/flows/smoke.yaml:22: `home.now`, Beranda
- mobile/flows/smoke.yaml:23: text "Ekonomi dan Inovasi dalam Perencanaan", Beranda? (after `tab.home` at line 8, nothing else tapped since)
- mobile/flows/smoke.yaml:25: `home.strip`, Beranda
- mobile/flows/smoke.yaml:27: `home.grid`, Beranda

### `mobile/flows/use.yaml`

Run by: CI `e2e (app)`: .github/workflows/mobile.yml, through scripts/ci/mobile-e2e.sh (`*.yaml` of mobile/flows), on a pull request or push that changes mobile/, every night and by hand; `mobile/flows/round2/w10-hand-in-moment.yaml`; `mobile/qa/emu.sh`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`; `mobile/qa/superapp-map.md`; `scripts/ci/mobile-e2e.sh`

- mobile/flows/use.yaml:10: `tab.home`, tab bar
- mobile/flows/use.yaml:14: `status.settling`, top bar
- mobile/flows/use.yaml:20: `tab.tasks`, tab bar
- mobile/flows/use.yaml:97: `tab.schedule`, tab bar
- mobile/flows/use.yaml:145: `tab.courses`, tab bar
- mobile/flows/use.yaml:164: `tab.profile`, tab bar
- mobile/flows/use.yaml:167: `screen.profile`, Profil
- mobile/flows/use.yaml:171: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/flows/use.yaml:175: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)

### `mobile/qa/flows/before.yaml`

Run by: `mobile/qa/BASELINE.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/before.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/before.yaml:14: `action.alerts`, top bar (also drawn in parts/b-header.tsx)
- mobile/qa/flows/before.yaml:20: `action.search`, top bar (also drawn in parts/b-header.tsx)
- mobile/qa/flows/before.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/before.yaml:46: `tab.tasks`, tab bar
- mobile/qa/flows/before.yaml:54: `tab.schedule`, tab bar
- mobile/qa/flows/before.yaml:66: `row.nav.grades`, Profil

### `mobile/qa/flows/flashlight.yaml`

Run by: `mobile/qa/BASELINE.md`; `mobile/qa/README.md`; `mobile/qa/flashlight.sh`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/flashlight.yaml:8: `tab.home`, tab bar
- mobile/qa/flows/flashlight.yaml:11: `tab.tasks`, tab bar
- mobile/qa/flows/flashlight.yaml:16: `tab.schedule`, tab bar
- mobile/qa/flows/flashlight.yaml:18: `tab.courses`, tab bar
- mobile/qa/flows/flashlight.yaml:20: `tab\.(profile|academic)`, tab bar
- mobile/qa/flows/flashlight.yaml:22: `tab.home`, tab bar

### `mobile/qa/flows/home-idle-scroll.yaml`

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/home-idle-scroll.yaml:7: `tab.home`, tab bar

### `mobile/qa/flows/home-shots.yaml`

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/home-shots.yaml:18: `status.firstRead`, top bar (also drawn in shell/first-minute/scene.tsx)
- mobile/qa/flows/home-shots.yaml:24: `status.firstRead`, top bar (also drawn in shell/first-minute/scene.tsx)
- mobile/qa/flows/home-shots.yaml:28: `card.firstScan`, Beranda
- mobile/qa/flows/home-shots.yaml:39: `home.now`, Beranda
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

Run by: `mobile/qa/home-notes.md`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

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
- mobile/qa/flows/home-tour.yaml:60: `row.need.exam:DK4073-UTS`, Beranda

### `mobile/qa/flows/kuliah-shots.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/kuliah-shots.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/kuliah-shots.yaml:13: `status.settling`, top bar
- mobile/qa/flows/kuliah-shots.yaml:16: `action.notify.later`, Beranda
- mobile/qa/flows/kuliah-shots.yaml:19: `tab.courses`, tab bar

### `mobile/qa/flows/r2-akademik.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`; `mobile/qa/superapp-map.md`

- mobile/qa/flows/r2-akademik.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/r2-akademik.yaml:12: `tab.profile`, tab bar
- mobile/qa/flows/r2-akademik.yaml:15: `card.profile`, Profil (also drawn in screens/settings/accounts.tsx)
- mobile/qa/flows/r2-akademik.yaml:20: `card.profile`, Profil (also drawn in screens/settings/accounts.tsx)
- mobile/qa/flows/r2-akademik.yaml:36: `row.nav.plan.planner`, Profil
- mobile/qa/flows/r2-akademik.yaml:38: `row.nav.plan.planner`, Profil
- mobile/qa/flows/r2-akademik.yaml:44: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/r2-akademik.yaml:46: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/r2-akademik.yaml:52: `row.nav.plan.krs`, Profil
- mobile/qa/flows/r2-akademik.yaml:54: `row.nav.plan.krs`, Profil
- mobile/qa/flows/r2-akademik.yaml:60: `row.nav.plan.bills`, Profil
- mobile/qa/flows/r2-akademik.yaml:62: `row.nav.plan.bills`, Profil
- mobile/qa/flows/r2-akademik.yaml:68: `row.nav.plan.deadlines`, Profil
- mobile/qa/flows/r2-akademik.yaml:70: `row.nav.plan.deadlines`, Profil
- mobile/qa/flows/r2-akademik.yaml:76: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/qa/flows/r2-akademik.yaml:80: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/qa/flows/r2-akademik.yaml:100: `action.search`, top bar (also drawn in parts/b-header.tsx)
- mobile/qa/flows/r2-akademik.yaml:109: `tab.home`, tab bar
- mobile/qa/flows/r2-akademik.yaml:111: `action.alerts`, top bar (also drawn in parts/b-header.tsx)

### `mobile/qa/flows/r2-tasks-academic.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r2-tasks-academic.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:12: `tab.tasks`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:44: `tab.profile`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:49: `row.nav.grades`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:52: `row.nav.grades`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:63: `row.nav.plan.planner`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:65: `row.nav.plan.planner`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:71: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:73: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:79: `row.nav.plan.krs`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:81: `row.nav.plan.krs`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:87: `row.nav.plan.bills`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:89: `row.nav.plan.bills`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:95: `row.nav.plan.deadlines`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:97: `row.nav.plan.deadlines`, Profil
- mobile/qa/flows/r2-tasks-academic.yaml:103: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/qa/flows/r2-tasks-academic.yaml:107: `action.account`, top bar and Profil (also drawn in screens/academic/academic-screen.tsx)
- mobile/qa/flows/r2-tasks-academic.yaml:121: `action.search`, top bar (also drawn in parts/b-header.tsx)
- mobile/qa/flows/r2-tasks-academic.yaml:130: `tab.home`, tab bar
- mobile/qa/flows/r2-tasks-academic.yaml:132: `action.alerts`, top bar (also drawn in parts/b-header.tsx)

### `mobile/qa/flows/r3/01-today-due.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r3/01-today-due.yaml:18: `screen.home`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:23: `home.loading`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:31: `section.needs.reading`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/qa/flows/r3/01-today-due.yaml:34: `home.now`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:39: `action.needs.all`, Beranda
- mobile/qa/flows/r3/01-today-due.yaml:44: `screen.home`, Beranda

### `mobile/qa/flows/r3/02-task-file.yaml`

Run by: `mobile/qa/flows/r3/_next-task.yaml`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r3/02-task-file.yaml:20: `screen.home`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:24: `home.loading`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:28: `section.needs.reading`, Beranda (also drawn in screens/plan/curriculum.tsx)
- mobile/qa/flows/r3/02-task-file.yaml:35: `row\.need\.task:.*`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:38: `row\.need\.task:.*`, Beranda
- mobile/qa/flows/r3/02-task-file.yaml:82: `screen\..*`, Beranda and Profil (also drawn in screens/course/course-screen.tsx, screens/course/module-screen.tsx, screens/first-scan/first-scan-screen.tsx, …)

### `mobile/qa/flows/r3/03-tandai-hadir.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r3/03-tandai-hadir.yaml:21: `screen.home`, Beranda
- mobile/qa/flows/r3/03-tandai-hadir.yaml:25: `home.loading`, Beranda
- mobile/qa/flows/r3/03-tandai-hadir.yaml:36: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:39: `tab.courses`, tab bar
- mobile/qa/flows/r3/03-tandai-hadir.yaml:51: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:59: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:68: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:74: `action.checkIn`, Beranda (also drawn in screens/course/now.tsx, screens/presence/now.tsx, screens/schedule/details.tsx)
- mobile/qa/flows/r3/03-tandai-hadir.yaml:78: `screen\.(home|courses)`, Beranda (also drawn in screens/presence/presence-screen.tsx)

### `mobile/qa/flows/r3/04-course-material.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r3/04-course-material.yaml:17: `screen.home`, Beranda
- mobile/qa/flows/r3/04-course-material.yaml:20: `tab.courses`, tab bar

### `mobile/qa/flows/r3/05-grades.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/r3/05-grades.yaml:16: `screen.home`, Beranda
- mobile/qa/flows/r3/05-grades.yaml:19: `tab.profile`, tab bar
- mobile/qa/flows/r3/05-grades.yaml:23: `screen.profile`, Profil
- mobile/qa/flows/r3/05-grades.yaml:27: `academic.loading`, Profil
- mobile/qa/flows/r3/05-grades.yaml:32: `action.academic.grades`, Profil
- mobile/qa/flows/r3/05-grades.yaml:35: `action.academic.grades`, Profil
- mobile/qa/flows/r3/05-grades.yaml:49: `row.nav.grades`, Profil
- mobile/qa/flows/r3/05-grades.yaml:53: `row.nav.grades`, Profil

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
- mobile/qa/flows/rec-home-first-run.yaml:23: `status.firstRead`, top bar (also drawn in shell/first-minute/scene.tsx)
- mobile/qa/flows/rec-home-first-run.yaml:27: `card.firstScan`, Beranda
- mobile/qa/flows/rec-home-first-run.yaml:33: `action.firstScan.open`, Beranda

### `mobile/qa/flows/rec-home-v4.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/rec-home-v4.yaml:9: `home.now`, Beranda
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
- mobile/qa/flows/rec-tabs.yaml:13: `tab.courses`, tab bar
- mobile/qa/flows/rec-tabs.yaml:15: `tab\.(profile|academic)`, tab bar
- mobile/qa/flows/rec-tabs.yaml:17: `tab.home`, tab bar

### `mobile/qa/flows/schedule-shots.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/schedule-shots.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/schedule-shots.yaml:13: `status.settling`, top bar
- mobile/qa/flows/schedule-shots.yaml:17: `tab.schedule`, tab bar
- mobile/qa/flows/schedule-shots.yaml:28: `sheet.nowClass`, Beranda

### `mobile/qa/flows/shell-tabs-round1.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tabs-round1.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:11: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:14: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:23: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:26: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:29: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:38: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:41: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:44: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:53: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:56: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:59: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:68: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:71: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:74: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs-round1.yaml:83: `tab.home`, tab bar

### `mobile/qa/flows/shell-tabs.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tabs.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:16: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:19: `tab.profile`, tab bar
- mobile/qa/flows/shell-tabs.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:31: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:34: `tab.profile`, tab bar
- mobile/qa/flows/shell-tabs.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:46: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:49: `tab.profile`, tab bar
- mobile/qa/flows/shell-tabs.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:61: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:64: `tab.profile`, tab bar
- mobile/qa/flows/shell-tabs.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tabs.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tabs.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tabs.yaml:76: `tab.courses`, tab bar
- mobile/qa/flows/shell-tabs.yaml:79: `tab.profile`, tab bar
- mobile/qa/flows/shell-tabs.yaml:82: `tab.home`, tab bar

### `mobile/qa/flows/shell-tour-round1.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tour-round1.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:11: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:14: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:23: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:26: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:29: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:38: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:41: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:44: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:53: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:56: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:59: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:68: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:71: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:74: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:83: `tab.home`, tab bar
- mobile/qa/flows/shell-tour-round1.yaml:106: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour-round1.yaml:109: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour-round1.yaml:154: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour-round1.yaml:157: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour-round1.yaml:202: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour-round1.yaml:205: `row.nav.grades`, Profil

### `mobile/qa/flows/shell-tour.yaml`

Run by: `mobile/qa/shell-notes.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/shell-tour.yaml:5: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:10: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:13: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:16: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:19: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:22: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:25: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:28: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:31: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:34: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:37: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:40: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:43: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:46: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:49: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:52: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:55: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:58: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:61: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:64: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:67: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:70: `tab.schedule`, tab bar
- mobile/qa/flows/shell-tour.yaml:73: `tab.tasks`, tab bar
- mobile/qa/flows/shell-tour.yaml:76: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:79: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:82: `tab.home`, tab bar
- mobile/qa/flows/shell-tour.yaml:85: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:101: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:105: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:108: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:117: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:121: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:124: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:133: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:137: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:140: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:149: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:165: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:169: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:172: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:181: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:185: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:188: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:197: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:201: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:204: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:213: `tab.courses`, tab bar
- mobile/qa/flows/shell-tour.yaml:229: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:233: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:236: `row.nav.grades`, Profil
- mobile/qa/flows/shell-tour.yaml:245: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:249: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:252: `row.nav.plan.krs`, Profil
- mobile/qa/flows/shell-tour.yaml:261: `tab.profile`, tab bar
- mobile/qa/flows/shell-tour.yaml:265: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:268: `row.nav.plan.curriculum`, Profil
- mobile/qa/flows/shell-tour.yaml:277: `tab.courses`, tab bar

### `mobile/qa/flows/to-courses.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/to-courses.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-courses.yaml:9: `tab.courses`, tab bar

### `mobile/qa/flows/to-curriculum.yaml`

Run by: `mobile/qa/README.md`; `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/to-curriculum.yaml:8: `tab.home`, tab bar
- mobile/qa/flows/to-curriculum.yaml:11: `tab\.(profile|academic)`, tab bar
- mobile/qa/flows/to-curriculum.yaml:13: `row.nav.plan.curriculum`, Profil

### `mobile/qa/flows/to-schedule.yaml`

Run by: `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-schedule.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-schedule.yaml:9: `tab.schedule`, tab bar

### `mobile/qa/flows/to-tasks.yaml`

Run by: `mobile/qa/README.md`; `mobile/qa/superapp-flows.md`

- mobile/qa/flows/to-tasks.yaml:6: `tab.home`, tab bar
- mobile/qa/flows/to-tasks.yaml:9: `tab.tasks`, tab bar

### `mobile/qa/flows/v4-tasks.yaml`

Run by: `mobile/qa/superapp-flows.md`; `mobile/qa/superapp-journeys.md`

- mobile/qa/flows/v4-tasks.yaml:9: `tab.home`, tab bar
- mobile/qa/flows/v4-tasks.yaml:12: `tab.tasks`, tab bar
- mobile/qa/flows/v4-tasks.yaml:19: `tab.tasks`, tab bar

### The ids most used (how many flow files name each)

| id | on | flow files | mentions |
| --- | --- | ---: | ---: |
| `tab.home` | tab bar | 49 | 89 |
| `status.settling` | top bar | 22 | 25 |
| `tab.tasks` | tab bar | 16 | 37 |
| `tab.schedule` | tab bar | 15 | 42 |
| `tab.profile` | tab bar | 12 | 43 |
| `tab.courses` | tab bar | 11 | 37 |
| `sheet.nowClass` | Beranda | 10 | 24 |
| `action.account` | top bar | 7 | 34 |
| `row.nav.grades` | Profil | 7 | 23 |
| `screen.home` | Beranda | 7 | 15 |
| `home.now` | Beranda | 7 | 8 |
| `row.nav.plan.krs` | Profil | 6 | 15 |
| `row.nav.plan.curriculum` | Profil | 6 | 14 |
| `action.needs.all` | Beranda | 6 | 12 |
| `screen.needs` | Beranda | 5 | 15 |
| `screen.profile` | Profil | 5 | 11 |
| `row.nav.plan.bills` | Profil | 5 | 9 |
| `row.nav.plan.deadlines` | Profil | 5 | 9 |
| `home.grid` | Beranda | 5 | 7 |
| `action.nowClass` | Beranda | 5 | 7 |
| `card.firstScan` | Beranda | 5 | 6 |
| `action.alerts` | top bar | 5 | 6 |
| `action.checkIn` | Beranda | 4 | 11 |
| `row.nav.plan.planner` | Profil | 4 | 9 |
| `home.search` | Beranda | 4 | 6 |
| `card.now.checkedIn` | Beranda | 4 | 4 |
| `action.firstScan.open` | Beranda | 4 | 4 |
| `action.search` | top bar | 4 | 4 |
| `action.notify.later` | Beranda | 4 | 4 |
| `row.today.class:2153983` | Beranda | 3 | 5 |

### Flows with nothing on those surfaces

- `mobile/flows/judge-dark.yaml`
- `mobile/flows/judge-light.yaml`
- `mobile/flows/judge/tab.yaml`
- `mobile/flows/round2/w05-refresh.sh`
- `mobile/qa/flows/before-welcome.yaml`
- `mobile/qa/flows/r3/run.sh`

### Ids no source file draws today (flows already waiting for something gone)

- mobile/flows/journeys/03-deadline.yaml:20: `action.strip.tasks`
- mobile/flows/journeys/04-after-class.yaml:22: `screen.material`
- mobile/flows/journeys/04-after-class.yaml:28: `row\.material\..*`
- mobile/flows/journeys/04-after-class.yaml:40: `screen.material`
- mobile/flows/round2/w01-files.yaml:59: `row.module.2-catatan`
- mobile/flows/round2/w01-files.yaml:61: `row.module.2-catatan`
- mobile/flows/round2/w04-jadwal.yaml:27: `segment.view.*`
- mobile/flows/round2/w11-kuliah.yaml:28: `group.presence.out`
- mobile/flows/round2/w11-kuliah.yaml:38: `mark.counted.*`
- mobile/flows/round2/w11-kuliah.yaml:56: `action.changeTarget.*`
- mobile/flows/round2/w11-kuliah.yaml:83: `mark.courseAdvice`
- mobile/flows/round2/w12-one-target.yaml:47: `action.openExternal`
- mobile/flows/round2/w15-onboarding.yaml:14: `action.start`
- mobile/flows/screens.json:757: `day.2026-10-08`
- mobile/flows/screens.json:856: `day.2026-10-08`
- mobile/flows/screens.json:1082: `day.2026-10-08`
- mobile/flows/screens.json:1181: `day.2026-10-08`
- mobile/flows/screens.json:1280: `day.2026-10-08`
- mobile/flows/screens.json:1379: `day.2026-10-08`
- mobile/flows/screens.json:1476: `day.2026-10-09`
- mobile/flows/screens.json:1485: `day.2026-10-09`
- mobile/flows/screens.json:1734: `sheet.changes`
- mobile/flows/screens.json:2250: `day.2026-10-08`
- mobile/flows/screens.json:2291: `day.2026-10-08`
- mobile/flows/screens.json:2300: `day.2026-10-08`
- mobile/flows/screens.json:2340: `day.2026-10-01`
- mobile/flows/screens.json:2349: `day.2026-10-01`
- mobile/flows/screens.json:2367: `day.2026-10-08`
- mobile/flows/screens.json:2376: `day.2026-10-08`
- mobile/flows/screens.json:2394: `day.2026-10-09`
- mobile/flows/screens.json:2403: `day.2026-10-09`
- mobile/flows/screens.json:2421: `day.2026-10-15`
- mobile/flows/screens.json:2430: `day.2026-10-15`
- mobile/flows/screens.json:2448: `day.2026-10-16`
- mobile/flows/screens.json:2457: `day.2026-10-16`
- mobile/flows/screens.json:2475: `day.2026-10-22`
- mobile/flows/screens.json:2484: `day.2026-10-22`
- mobile/flows/screens.json:2502: `day.2026-10-29`
- mobile/flows/screens.json:2511: `day.2026-10-29`
- mobile/flows/screens.json:2529: `day.2026-10-30`
- mobile/flows/screens.json:2538: `day.2026-10-30`
- mobile/flows/screens.json:2556: `day.2026-10-01`
- mobile/flows/screens.json:2565: `day.2026-10-01`
- mobile/flows/screens.json:2583: `day.2026-10-08`
- mobile/flows/screens.json:2592: `day.2026-10-08`
- mobile/flows/screens.json:2610: `day.2026-10-09`
- mobile/flows/screens.json:2619: `day.2026-10-09`
- mobile/flows/screens.json:2637: `day.2026-10-15`
- mobile/flows/screens.json:2646: `day.2026-10-15`
- mobile/flows/screens.json:2664: `day.2026-10-29`
- mobile/flows/screens.json:2673: `day.2026-10-29`
- mobile/flows/screens.json:2690: `day.2026-10-08`
- mobile/flows/screens.json:2728: `day.2026-10-08`
- mobile/flows/screens.json:2766: `day.2026-10-08`
- mobile/flows/screens.json:2804: `day.2026-10-08`
- mobile/flows/screens.json:2842: `day.2026-10-09`
- mobile/flows/screens.json:2909: `day.2026-10-15`
- mobile/flows/screens.json:2976: `day.2026-10-15`
- mobile/flows/screens.json:3043: `day.2026-10-15`
- mobile/flows/screens.json:3110: `day.2026-10-15`
- mobile/flows/screens.json:3148: `day.2026-10-08`
- mobile/flows/screens.json:3165: `day.2026-10-09`
- mobile/flows/screens.json:3211: `day.2026-10-15`
- mobile/flows/screens.json:3257: `day.2026-10-16`
- mobile/flows/screens.json:3366: `day.2026-10-09`
- mobile/flows/screens.json:3375: `day.2026-10-09`
- mobile/flows/screens.json:4645: `row.term.{{2}}`
- mobile/flows/screens.json:4656: `row.term.{{2}}`
- mobile/flows/screens.json:4663: `row.term.{{2}}`
- mobile/flows/screens.json:4676: `row.term.{{2}}.open`
- mobile/flows/screens.json:4682: `row.term.{{2}}`
- mobile/flows/screens.json:5244: `row.module.{{3}}`
- mobile/flows/screens.json:5250: `row.module.{{3}}`
- mobile/flows/use.yaml:136: `day.2026-10-15`
- mobile/qa/flows/before-welcome.yaml:8: `action.start`
- mobile/qa/flows/before-welcome.yaml:13: `action.start`
- mobile/qa/flows/before-welcome.yaml:17: `action.connect.edunex`
- mobile/qa/flows/before.yaml:58: `tab.presence`
- mobile/qa/flows/before.yaml:62: `tab.more`
- mobile/qa/flows/before.yaml:76: `row.nav.plan`
- mobile/qa/flows/before.yaml:79: `screen.plan`
- mobile/qa/flows/before.yaml:109: `row.nav.settings`
- mobile/qa/flows/before.yaml:112: `row.nav.settings`
- mobile/qa/flows/home-idle-scroll.yaml:11: `nothing.here`
- mobile/qa/flows/kuliah-shots.yaml:82: `row.module.2-catatan`
- mobile/qa/flows/kuliah-shots.yaml:86: `row.module.2-catatan`
- mobile/qa/flows/r3/04-course-material.yaml:46: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:54: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:63: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:66: `row\.module\..*`
- mobile/qa/flows/r3/04-course-material.yaml:81: `row\.module\..*`
- mobile/qa/flows/rec-module.yaml:24: `row.module.modul-3`
- mobile/qa/flows/rec-module.yaml:28: `row.material.880004`
- mobile/qa/flows/shell-tabs-round1.yaml:17: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:20: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:32: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:35: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:47: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:50: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:62: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:65: `tab.more`
- mobile/qa/flows/shell-tabs-round1.yaml:77: `tab.presence`
- mobile/qa/flows/shell-tabs-round1.yaml:80: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:17: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:20: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:32: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:35: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:47: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:50: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:62: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:65: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:77: `tab.presence`
- mobile/qa/flows/shell-tour-round1.yaml:80: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:86: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:102: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:118: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:122: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:125: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:128: `screen.plan`
- mobile/qa/flows/shell-tour-round1.yaml:134: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:150: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:166: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:170: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:173: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:176: `screen.plan`
- mobile/qa/flows/shell-tour-round1.yaml:182: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:198: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:214: `tab.more`
- mobile/qa/flows/shell-tour-round1.yaml:218: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:221: `row.nav.plan`
- mobile/qa/flows/shell-tour-round1.yaml:224: `screen.plan`
- mobile/qa/flows/shell-tour.yaml:287: `row.module.*`
- mobile/qa/flows/shell-tour.yaml:290: `row.module.*`

<!-- flows:end -->
