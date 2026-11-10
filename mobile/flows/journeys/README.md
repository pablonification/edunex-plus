# The seven journeys, as flows

One file per journey of `mobile/qa/superapp-journeys.md`, written for the super-app layout (`mobile/qa/superapp-decisions.md`) and run on
the demo app (`io.github.pablonification.edunexplus.demo`):

    maestro test mobile/flows/journeys/            # all seven
    maestro test mobile/flows/journeys/01-morning.yaml

| file | journey (`mobile/qa/superapp-journeys.md`) | budget |
| --- | --- | --- |
| `01-morning.yaml` | 6, morning: my day, what's due, am I safe | 0 taps |
| `02-class-starts.yaml` | 3, a class starts: Isi Presensi, then what's next | 2 |
| `03-deadline.yaml` | 4, a deadline: Beranda, Tugas, a Task, handed in | 3 to the brief |
| `04-after-class.yaml` | 2, after class: this week's material | 2 |
| `05-after-exam.yaml` | 1, after an exam: my grade and the IPK | 2 |
| `06-office.yaml` | 5, KRS, UKT, Kalender | 2 from Profil, 1 from the grid |
| `07-search.yaml` | 7, looking for something by name | 2 after typing |

Each step carries its tap count in a comment (`# tap 1 of 2`); a journey says its budget on its first lines and the flow ends
when the Student has what they came for. Every step waits for what it taps (`extendedWaitUntil` on the id), never a sleep.

- **Not in CI yet.** `scripts/ci/mobile-e2e.sh` leaves this folder out (like `judge/`) until the screens they name are built.
- **`# pending: <who>`** above a step marks an id or a behaviour of a screen that isn't built yet (Materi, Ujian, the hand-in's finish,
  the strip's `action.strip.*`). `node mobile/qa/flows-check.mjs` lists those ids as pending, not as missing; a pending step that
  is only a behaviour (the block moving on) is a plain assertion that fails until it is built.
- **After the screens land:** run `node mobile/qa/flows-check.mjs`; remove each `# pending:` whose screen exists (the checker says
  which no longer need it: an id marked pending that exists now is listed as "pending, but it exists").
- Ids come from the decisions' "testIDs". Where the decisions leave a row's id to its screen's owner (Profil's rows), the flow uses the id
  the base draws and says so.
- The hand-in journey attaches `mobile/flows/files/jawaban.pdf`, which CI puts in Downloads (`scripts/ci/mobile-e2e.sh`); on a phone:
  `adb push mobile/flows/files/jawaban.pdf /sdcard/Download/jawaban.pdf`.
