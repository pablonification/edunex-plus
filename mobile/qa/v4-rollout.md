# v4 roll-out: rules for every helper (round 2, 2026-11-01)

The lead's brief for the five helpers that bring v4 to every tab in parallel. Your message from the lead names your piece,
base and branch.

**Why.** Arqila approved the v4 design on Beranda and said: "we need to move faster". v4 now goes out to every tab at the same time, with one helper per piece. You are one of five.

**Read first.**
- `mobile/design/r2-directions/v4/README.md` on `origin/mobile-r2-mockups` (also `v4-live.html` and the PNGs there).
- `mobile/DESIGN.md`, the "v4" section.
- Beranda as the model: `mobile/src/screens/home/` on `origin/mobile` (merged from `mobile-r2-home`).
- v4's shared parts, from ce99b274, all in `mobile/src/ui/`: `expressive.tsx` (WavyProgress, CookieCheck, PulseDot, CountUp, Rise), `tile.tsx` (each course's ink/tint tile), `press.tsx` (the press spring), `big-button.tsx`, and the tokens in `theme.ts`.
- `mobile/PROGRESS.md`, under "Round 2": the rules from Arqila's verdict (text budget, one title, look, joy) and your screens' plans. Use the shared parts. If you need a new shared part, add it to `mobile/src/ui/` and DESIGN.md, small and generic, and say so in your report: another helper may need it too.

**Hard gates. A screen isn't done until all of these pass.**
1. **Text budget.**
   - A row is a title plus at most one short meta line and at most one status (a chip or an icon, never a sentence).
   - No explanatory sentences on tab screens. They go one tap deeper, or they go. Buttons only appear when they can be used.
   - Each tab's first screen (light, `mid`, no scrolling) has words in the 40s, counted with `mobile/qa/words.sh <serial> <tab>`. Sub-screens: as few as the job allows.
   - The phone may say less than the desktop, but never less truly (Decision 24). Check A must still find every fact somewhere.
2. **One title per screen.** The bar's, or a large title that collapses into the bar. A name never appears twice.
3. **v4's look.**
   - Course colour as ink/tint tiles. One card led by a big number where the screen has a key number (CountUp).
   - Plus Jakarta Sans for headings and numbers, Roboto for the rest.
   - Few containers, one focal point per screen.
   - The press spring on every target. Rise once on first mount, never on tab switches.
   - Haptics on commits.
   - Every colour pair through the design skill's `scripts/contrast.py`. Targets at least 48 dp. Predictive back works.
4. **Words** go in `src/core/strings` (phone-only ones in `src/core/strings/mobile.ts`), written with `.claude/skills/copywriting`. Keys the desktop shows must keep working there.
5. **Checks.**
   - `npm run check` passes (on the desktop's Windows line endings, run biome on a clean LF copy).
   - Check A for your screens' scenarios stays at 100%.
   - Round 1's flows and your round 2 flows for your screens pass.

**Machines.** The Mac is offline, so every helper is on the desktop. Share it.

**C: is never used for builds or output.** On 2026-11-01 helpers' build copies, Gradle homes and Temp filled C:'s 237 GB. T3 crashed and every helper died with it. So:
- **Big files go on F:** (202 GB free) **or H:** (287 GB free), never C:.
  - That means build copies, Gradle homes, TEMP/TMP, emulator run output, screenshots, recordings and Perfetto traces.
  - `mobile/qa/env.sh` already points the lab there: `QA_OUT=F:/qa`, `QA_BUILD_ROOT=F:/b`, and TEMP/TMP set to `F:\qa\tmp`. Every lab script sources it.
  - Anything you run by hand writes under `F:\qa\<your piece>\` too.
- **Before every build and every emulator session, C: needs at least 20 GB free.** `build.sh` and `emu.sh` check this themselves (`qa_check_disk`). If C: is under 20 GB, stop and report it to the lead. Don't clean up other helpers' files.
- **No Gradle home of your own.** Each build slot has one Gradle home, shared by whoever builds in it (`F:\b\gradle-1.gradle`, `F:\b\gradle-2.gradle`).
- **A build copy goes once its APK is out.** `build.sh` deletes it and stops its Gradle daemon. `--keep` is only for an immediate rebuild.
- **Clean up after yourself.** Uninstall nothing from the lab. Delete your own runs once their pictures are pushed.

**Builds: GitHub Actions by default** (since 2026-11-01 08:45).
- With five helpers on the desktop, local builds took over 24 minutes and failed: a JdkImageTransform step in a fresh Gradle home, and "paging file too small".
- So build with `gh workflow run mobile.yml --ref <your-branch> -f apks=demo-release -f e2e=false -f desktop-shots=false`. To wait for it, run `until [ "$(gh run view <id> --json status -q .status)" = completed ]; do sleep 60; done` as a background command, then `t3_background_wait` on it. Then download the artifact `edunex-plus-demo-release-apk` to `F:\qa\<your piece>\`.
- The desktop is for the emulator session only, unless GitHub Actions is down.

**Gradle on the desktop (only when GitHub Actions can't build): at most two builds at once.**
- Build with `mobile/qa/build.sh <sha> --slot gradle-1` or `--slot gradle-2`. A busy slot refuses and tells you who has it, so try the other.
- If both are busy, build on GitHub Actions: `gh workflow run mobile.yml --ref <your-branch> -f apks=demo-release -f e2e=false -f desktop-shots=false`, then download the artifact `edunex-plus-demo-release-apk`.

**Emulators: at most two at once.**
- Take `C:\qa\locks\emu-1` or `C:\qa\locks\emu-2` with `mkdir` (it succeeds only if the lock is free), and write your helper name into its `owner` file.
- Use your own port: home 5562, Jadwal 5564, Tugas 5566, Kuliah 5572, Akademik 5574.
- Do your pictures, recording and Check A in one session, then stop your emulator and `rmdir` the lock.

**Locks and processes.**
- A stale lock (older than 40 minutes, its owner's processes gone) may be taken over.
- Never kill another helper's processes. If a build hangs, don't fight it: use GitHub Actions.

**Pictures and proof.**
- For each of your screens, on `mid`: light, dark and 1.3 font scale, as webp, in `mobile/report/img/v4/<piece>/`. Also `weak` light for each tab's first screen.
- One recording of your main flow, 20–40 s, on branch `media-<your-branch>` (never merged).
- The word count per tab's first screen goes into PROGRESS.md's word table. Your rows go into "What Arqila found" (W4, W9, W10, W11, W12 where they apply) and into your helper row.
- Speed numbers (screen open, JS stalls over 50 ms) if your emulator session allows. They must not get worse than the shell's numbers.

**Git.**
- Work on your own branch and push often. Before you finish, merge `origin/mobile` into your branch and resolve.
- Commits are Conventional Commits in plain words that say why it matters to the student. No AI trailers.
- PROGRESS.md: edit only your own helper row and your own table rows, to keep merges easy.
- Finish with a short report: what you built, the word counts, the gates (each pass/fail), anything from v4 that didn't fit your screens and what you did instead, and the last line `branch <name>, head <sha>`.
- Effort: high. Work on your own until done; nobody answers questions. When something is ambiguous, decide in v4's spirit and write the decision in your report.
