# The seven journeys, as flows

One file per journey of `mobile/qa/superapp-journeys.md`, written for the super-app layout (`mobile/qa/superapp-decisions.md`) and run on
the demo app (`io.github.pablonification.edunexplus.demo`, in Indonesian: `EDUNEX_DEMO_LANG=id`). Never the real app: a hand-in writes.

    mobile/qa/journeys.sh                 # on the USB phone ($ANDROID_SERIAL): all seven, one timed line each
    mobile/qa/journeys.sh 04 07           # some
    maestro test mobile/flows/journeys/   # by hand, on any device

| file | journey | limit (taps to the goal) |
| --- | --- | --- |
| `01-morning.yaml` | morning: my day, what's due, am I safe | 0 |
| `02-class-starts.yaml` | a class starts: Isi Presensi, then what's next | 2 |
| `03-deadline.yaml` | a deadline: Beranda, the brief, handed in, the finish | 3 to the brief |
| `04-after-class.yaml` | after class: the material, opened in its module | 3 (the demo's one item this week is a meeting link) |
| `05-after-exam.yaml` | after an exam: my grade and the IPK | 2 |
| `06-office.yaml` | KRS, UKT, Kalender (each from Profil, and from the grid) | 2 each |
| `07-search.yaml` | looking for something by name | 2 after typing |

How a flow is counted (by `journeys.sh`, and by `test/mobile/journeys.test.ts`):

- `# limit: N` on a flow's first lines is the hill's limit for it.
- Every tap of the Student's path is a numbered comment, `# tap 1: ...`, just above its `tapOn`. `# goal` marks the moment the
  Student has what they came for. The taps counted are the numbered ones before a goal (a flow with several goals, 06, counts each
  one from its own `# tap 1` and takes the most). What comes after the goal (the way Back, a hand-in, an extra walk) is never counted.
- `# gap: ...` says what the demo can't do as the hill words it; `# unverified: ...` what no one has seen on a phone. The runner prints both.
- Every step waits for what it taps (`extendedWaitUntil` on the id), asserts the screen it lands on, taps by testID only, and the
  way back is walked with `back`, one asserted screen at a time. The same thing is asserted by the same name on each screen it
  passes (the class, the Task "Tugas 02 Bab II", the exam "UTS Komunikasi Pemasaran", the course).
- The hand-in journey attaches `mobile/flows/files/jawaban.pdf`, which CI puts in Downloads (`scripts/ci/mobile-e2e.sh`); on a phone:
  `adb push mobile/flows/files/jawaban.pdf /sdcard/Download/jawaban.pdf` (the runner checks and says so; it never pushes).
- **In CI:** `scripts/ci/mobile-e2e.sh` runs them with the other flows, last.
- **`# pending: <who>`** marks an id of a screen that isn't built yet; `node mobile/qa/flows-check.mjs` lists it as pending, not missing.
  None are left.
