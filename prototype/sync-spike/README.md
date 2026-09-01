# EduNex sync-architecture spike — PROTOTYPE, throwaway

Answers wayfinder ticket [#9](https://github.com/pablonification/edunex-desktop/issues/9):
does the chosen sync & data architecture (main-process jittered polling, JSON
snapshot cache, id-diff new-task detection, event-aligned presence checks,
seen-ledger) actually work in Electron 44 against the live EduNex API?

Lives on the `prototype/sync-spike` branch only. Never merge to main; the
validated decisions move on without this code.

## Run

```sh
cd prototype/sync-spike
npm install
SPIKE_FAIL_TICK=3 npm start   # simulates one network failure to prove backoff
npm start                     # plain run
```

Reuses the auth spike's `persist:spike-edunex-auth` partition; if it holds a
login, no user interaction is needed, otherwise a login window opens (credentials
never touch this code). Auto-quits 75s after sync starts. Timings are test-scale:
5s base tick ± 2s jitter (real app: 90s ± 30s), 60s backoff cap (real: ~15min).

## Verdict — every load-bearing claim proven (2026-09-02)

1. **Main-process tick is immune to window visibility; renderer timers are not.**
   Ticks held a 3.5–6.6s cadence through every run. The renderer heartbeat
   (250ms interval) throttled to 1 fire/s the whole time its window was occluded
   — including while technically *shown* behind the login window. A
   renderer-driven poller would already be degraded in normal desktop use.
   (spike-runA.log throughout)
2. **New-task detection = snapshot id-diff, fires exactly once.** Baseline was
   seeded empty; next tick flagged the real task `id=113986` and fired an OS
   notification; 13 subsequent ticks produced zero false positives.
   (spike-runB.log tick 2)
3. **Presence-open detection by event-aligned scheduling.** A window with
   `presence_start` = T+8s caused the *next tick* to be scheduled at open+1.5s
   grace; the OS notification fired on that aligned tick, not a slow poll later.
   (spike-runB.log ticks 1–3)
4. **Seen-ledger prevents re-notification across restarts.** After a restart
   with the diff baseline artificially wiped, the loaded ledger suppressed the
   id that would otherwise re-notify. (spike-runC.log tick 1)
5. **Backoff on failure, reset on success.** Simulated failure doubled the next
   interval 3121→6242ms; success resumed the jittered base. (run 1, tick 3–4)
6. **Partition token recovery works end-to-end.** After one manual login, every
   subsequent run recovered the bearer token from the partition with no user
   interaction and hit the API first try (45–116ms responses).
7. **Snapshots persist and serve as the diff baseline** — `snapshots/*.json`
   survived restarts; no extra storage needed for diffing.

## New API facts discovered while proving

- Bare `GET /notifications` → **404**. The SPA calls `GET /notifications/{userId}`
  (bundle: `get("/notifications/"+r.user.userInfo.id)`; userId = JWT `sub`) → 200,
  shape `{data: object}`; `PATCH /notifications` marks read.
- `GET /course/presences/list` → 200: per-course rows
  (`course_id, course_code, courses_name, class_id, class_name, semester, year, presences`).
- `GET /course/tasks` → 200: JSON-API envelope `{meta, data[], links}` with
  `type/id/attributes/links` per item — a *different* shape from `/todo`'s
  `{tasks, exams, questions, modules}`.
- `/todo` for the logged-in account currently holds 1 task; response in ~45ms —
  polling cost is trivial.

## Caveats

- Presence windows in the spike are synthetic; the endpoint that lists
  *upcoming* windows (`presence_start`/`presence_end`) still needs mapping for
  the real app (presences/list is history-shaped). Noted in the ticket resolution.
- Run logs are gitignored: they contain task ids and account-adjacent metadata.
