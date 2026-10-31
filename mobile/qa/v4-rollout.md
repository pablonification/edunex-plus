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

**Machines.** The desktop was restarted on 2026-11-01, so its Gradle locks are gone. The Mac is offline. Every helper is on the desktop, so share it:
- **Gradle: at most two builds at once.**
  - Take a slot with `mkdir C:\qa\locks\gradle-1` or `mkdir C:\qa\locks\gradle-2` (whichever succeeds first). Write your helper name into its `owner` file.
  - Then build: `mobile/qa/build.sh <sha> --slot <yours>`, with your own Gradle home. `rmdir` the slot when the build ends.
  - If both slots are taken, build on GitHub Actions instead: `gh workflow run mobile.yml --ref <your-branch> -f apks=demo-release -f e2e=false -f desktop-shots=false`, then download the artifact `edunex-plus-demo-release-apk`.
- **Emulators: at most two at once.**
  - Take `C:\qa\locks\emu-1` or `C:\qa\locks\emu-2` the same way.
  - Use your own port: home 5562, Jadwal 5564, Tugas 5566, Kuliah 5572, Akademik 5574.
  - Do your pictures, recording and Check A in one session, then stop your emulator and free the lock.
- **A stale lock** (older than 40 minutes, its owner's processes gone) may be taken over.
- **Never** kill another helper's processes. If a build hangs on a lock, don't fight it: use GitHub Actions.

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
