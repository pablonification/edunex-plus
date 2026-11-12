# The phone app's motion: as it is, and what's left

Sections 1–3 are the app as the code is on the morning of 11 Nov (after the layout rebuild and the motion pass over
`src/screens` and `src/parts`); the plan below is ticked against it. The parts to build with are in `src/ui/moves.tsx`;
the rule is in `DESIGN.md`, "Motion".

**The rule in one line:** every touch answers in the frame it lands; every change the Student causes moves from where
it was to where it is; joy (an overshoot, a drawn check, the success buzz) only for what they earned.

Words used below:

- **ripple**: Android's own, drawn by the system (no JS needed, so it's never late). **dim**: an iPhone's 55% fade
  (`iosPressed`). **give**: the thing shrinks a little under the finger (`PressScale`, `Tap`). **tint**: a faint
  overlay (`Tap` on an iPhone).
- **jump cut**: the old state is gone and the new one is there in the same frame, nothing between.
- Tokens are `motion.*` in `src/ui/theme.ts`: `spatialFast/Default/Slow` (things that move), `effectsFast/Default`
  (fades and colour, never overshoot), `expressive` (earned moments), `duration.short` 150 / `medium` 250 / `long` 400.

## 1. Pressed

What each kind of tappable thing shows under the finger, as the code is on the morning of 11 Nov. Every touch in
`src/screens` and `src/parts` answers on Android and on an iPhone; none is a bare `Pressable` with nothing.

| Kind | Where | Drawn by | What the Student sees | How long | Remove animations |
| --- | --- | --- | --- | --- | --- |
| Button, icon button, chip, segmented | everywhere | `ui/controls.tsx` | ripple; an iPhone dims | the system's | same |
| Row, sheet choice, menu item, snackbar's Urungkan | lists, sheets | `ui/layout.tsx`, `sheet.tsx`, `menu.tsx`, `toasts.tsx` | ripple; dim | the system's | same |
| Card (now card, a class on Jadwal, a Task row, a strip tile, "nanti") | Beranda, Jadwal, Tugas, a course | `PressScale` (`ui/press.tsx`) | gives 3.5% | down 120 ms, back on `expressive` | no give |
| Kit row and tile (`BRow`, `CountCell`, `ServiceTile`, `TileRow`, `GroupRow`, `SettingRow`, big button) | every list and grid | `PressScale` | gives 3.5% | as above | no give |
| A word that's a link ("Lihat semua", "Hari ini", the held-back list's toggle, "Urungkan", a change's instructions, Tenggat's clear, a course crumb, an exam's way to its modules) | Beranda, Jadwal, Task page, Tenggat, exam page | `Tap feel="row" borderless` | round ripple; an iPhone tints | in the touch's frame; tint out `short` | same |
| A title that opens the sync panel, Jadwal's status line | tab headers, Jadwal | `Tap feel="row"` | ripple; tint | as above | same |
| A Task's title (shows it whole), a step that opens, a mark with its "why", a handed-in file, the report's details toggle | Task page, Lapor masalah | `Tap feel="row"` | ripple; tint, no give (full width) | as above | same |
| The small "i" marks | Task page | `Tap feel="icon"` | round ripple, gives 12% | down `spatialFast`, back `expressive` | ripple only |
| A code to add, a colour to pick | Rencana studi, a course's colours | `Tap feel="tile"` | ripple, gives 8% | as above | ripple only |
| The two ways to send a report (cards) | Lapor masalah | `Tap feel="card"` | ripple, gives 3.5% | as above | ripple only |
| A point on the IPK chart | the chart | `Tap feel="row" borderless` | round ripple on the column; its label arrives | label: `medium` | label there |
| A course and today's lines on Kuliah, a Materi fold, a search result, an exam, Profil's cards, the notice's button | Kuliah, Materi, search, Ujian, Profil, Settings | `Tap` (row, tile, card) | ripple; tint | as above | same |
| Bottom tabs, switches | — | Android's own | ripple, thumb | native | native |

Still a `Pressable` of their own, each with a ripple and an iPhone dim already (left as they are, nothing to fix): the
"›" beside Perlu kamu urus (`home/urus.tsx`), Tugas's course filter (`tasks/list.tsx`), the comment field
(`tasks/thread.tsx`), a grade part's name (`course/grades.tsx`), a stand-in course (`plan/curriculum.tsx`), the grade
picker and its choices (`plan/projection.tsx`), a file row (`parts/files.tsx`), "Otomatis" in the colour picker.

## 2. State changes

| Screen | Change (trigger) | What it tells | Part and token | How long | Remove animations |
| --- | --- | --- | --- | --- | --- |
| All | Push, Back, tab switch, sheet, menu, pull to refresh | where you went | Android's own | native; tabs at once | native |
| Beranda | Now card: held shape to the class, one class to the next | the read landed; what's on now | `CrossFade` | fade `medium`, 98% to 100% on `spatialFast` | swap |
| Tugas | Skeleton to the list (first read lands while you look) | the Tasks came | `CrossFade` + `useArrivalId` | as above, once | swap |
| Tugas | Belum selesai / Selesai | which Tasks | `useSlidingMark` + `CrossFade` | mark `spatialFast`, list `medium` | mark jumps, list swaps |
| Tugas | A Task swiped done | done, put away | `SwipeRow` | `medium` | fades, folds at once |
| Materi | Skeleton to the list | the materials came | `CrossFade` + `useArrivalId` | once | swap |
| Nilai | Skeleton to the record (the big number also rises) | your grades came | `CrossFade` + `useArrivalId`, `Rise` | once | swap |
| A module | Skeleton to the module | it came | `CrossFade` + `useArrivalId` | once | swap |
| Kuliah | Skeleton to the courses | they came | `Rise` on the list, `Appear` on today's lines | `Rise`'s spring | there |
| A course | Skeleton to the page; a tab picked | it came; which part | `Rise`; `useSlidingMark` + `CrossFade` | `spatialFast` + `medium` | there; swap |
| Ujian | The list's first showing | here are your exams | `Arrive` | 40 ms apart, six items, `medium` | there |
| Semua layanan | The groups' first showing in a run | here's everything | `Arrive` | as above, once | there |
| Search | Before, found, nothing | what matches | `CrossFade` | `medium` | swap |
| Jadwal | A day picked | which day | `useSlidingMark`, the day slides in | `spatialFast` | jumps, swaps |
| Task page | A step opens | the change, in detail | `Unfold` (`moves.arrive`) | fade `medium`, 8 dp on `spatialDefault`; folds at once | there |
| Task page | Marked done / taken back | done, with Urungkan | `Appear` | arrive `medium`, leave `short` | there / gone |
| Task page | Handed in | it's in | `Celebration` | `expressive` | fades, check drawn |
| Lapor masalah | Details open | the technical part | `Unfold` | as a step | there |
| Settings, Notifikasi | "Notifikasi mati" comes and goes | reminders can't show / can again | `Appear` | arrive `medium`, leave `short` | there / gone |
| The IPK chart | A point tapped | that term's figures | `Appear` on the label | `medium` / `short` | there / gone |
| Profil | IPK and SKS change after a refresh | they moved | `RollTo` | `medium`, 3 dp nod | in place |

**Still a jump cut** (not done tonight): the skeletons of Jadwal, Profil, Rencana studi and Lapor masalah; folds
inside a group of rows (Beranda's held-back list, plan rules, Tenggat's groups, the transcript) and anything in a
FlashList cell (Materi's "Sebelumnya", Tugas's put-off group); the page under a fold (it moves at once, the new part
fades into the gap); the offline line and the problem banner (`shell/`); a row done from its menu; Tugas's two counts
and Beranda's strip figures (`RollTo` is a text field: not on a first frame the speed wall measures).

## 3. Haptics

On commits only. `ui/haptics.ts`: **tick** (a small step), **confirm** (done), **toggle** (a switch). `parts/hold.ts`:
**hold** (a long press took). No plain tap, navigation or scroll buzzes.

| Commit | Where | Haptic |
| --- | --- | --- |
| A swipe passing its threshold; letting go past it | `ui/swipe.tsx` | tick; confirm |
| A long press that opens a row's menu, its "Ingatkan nanti" times, a file's share sheet, a course's colours, a grade part's menu | `home/parts.tsx`, `tasks/rows.tsx`, `tasks/exam-rows.tsx`, `course/modules.tsx`, `presence/course-card.tsx`, `course/grades.tsx` | hold |
| Done from the row's menu or TalkBack's action (the swipe plays its own) | `home/parts.tsx`, `tasks/exam-rows.tsx` | confirm |
| An exam's Edunex part marked done on its page | `tasks/exam-page.tsx` | confirm |
| "Ingatkan nanti": a time picked | `parts/snooze.tsx` | confirm |
| Urungkan on a Task's page | `tasks/task-page.tsx` | tick |
| A comment sent | `tasks/thread.tsx` | confirm |
| A report sent | `report/report-screen.tsx` | confirm |
| A course saved offline (every file here) | `course/save-offline.tsx` | confirm |
| Exams added to the phone's calendar | `tasks/exam-page.tsx` | confirm |
| Presence marked (SIX no longer shows the check-in) | `home/banner.tsx`, `home/now.tsx`, `course/now.tsx` | confirm |
| Handed in | `ui/celebrate.tsx` | the phone's success |
| A grade guessed, the plan changed, a curriculum fix | `grades-screen.tsx`, `plan/planner-kit.tsx`, `plan/curriculum.tsx` | confirm |
| A setting saved: a switch; a choice or a colour; a step of the attendance target | `ui/settings-list.tsx`, `settings/*` | toggle; tick |
| Signed out, colours reset, all woken, all read | `settings/*`, `app/alerts.tsx` | confirm |

The tap on **Tandai hadir** no longer buzzes anywhere (it only opens SIX; the buzz is when presence is marked).
Not yet: signed in to Edunex or SIX (`shell/`); a report's "success" (there's none in `ui/haptics.ts`, so it's confirm).

## The plan: ten changes, in order

- [x] **1. No touch unanswered.** Every bare `Pressable` in the screens and parts that answered with nothing is a `Tap`.
  Nine keep their own `Pressable`: each already ripples and dims (listed under section 1).
- [ ] **2. `PressScale` to `Tap` on the kit's rows, cards and tiles** (so a card ripples and a full-width row doesn't
  shrink): `ui/`'s to do.
- [x] **3. Skeleton to data.** `CrossFade` on Beranda's now card, Tugas, Materi, Nilai and a module (`useArrivalId` in
  `parts/arrival.ts` plays it only when the data lands in front of the Student). Kuliah, a course and Ujian already
  arrive (`Rise`, `Arrive`): a fade on top would be a second move. Left: Jadwal, Profil, Rencana studi, Lapor masalah,
  Notifikasi (`app/`).
- [x] **4. The picked mark slides** on Tugas's two counts, a course's tabs and the day strip, each with `CrossFade`.
  Left: `Segmented` (`ui/`), the month.
- [ ] **5. Folds.** Partly: a Task's step and the report's details arrive (`Unfold` in `parts/unfold.tsx`). The page
  under them still moves at once, and folds inside a group of rows or a FlashList are as they were.
- [ ] **6. The now card's kinds.** Partly: the card cross-fades between classes; the page under it doesn't slide.
- [ ] **7. Numbers roll.** Profil's IPK and SKS only.
- [ ] **8. Things that come and go.** Partly: "Notifikasi mati", a Task's done line, today's presence lines, the chart's
  label. Left: the offline line and problem banner (`shell/`), the snackbar's leaving (`ui/`), a row done from its menu.
- [x] **9. Haptics on commits.** All in section 3. Left: signed in (`shell/`); `hold` moving into `ui/haptics.ts`.
- [ ] **10. First showings.** Semua layanan's groups and Ujian arrive once. Tugas doesn't (its rows are FlashList cells,
  and the tab mounts hidden, so it would never play); Notifikasi and search are `app/`'s.

## The parts (`src/ui/moves.tsx`)

| Part | For | Not for | Cost |
| --- | --- | --- | --- |
| `Tap` (`feel`: card, tile, row, icon; `borderless`) | anything tappable that isn't a Button, IconButton or Chip | a swipe row's own surface, a link in a sentence | one Animated view, one shared value (+ a tint view on iPhone) |
| `Appear` (`shifts`) | something that comes, goes or changes height | first draw (`Arrive`), content replacing content (`CrossFade`), FlashList cells | one Animated view; measured on mount, unmount, resize |
| `moves.arrive` / `moves.leave` / `moves.resize` | the same, on any `Animated.View` you already have | — | — |
| `CrossFade` (`id`) | skeleton → data, one filter's list → another's, a tab's panel | a thing where nothing was, a number | the new content mounts once in an Animated view |
| `RollTo` | a number that changes while seen | a clock ticking each second, a number in a sentence | a read-only TextInput: one or two per screen |
| `useSlidingMark` | the picked mark of a segment, a tab pill, a day | the bottom tabs | two shared values; one view laid out per frame of a move |
| `Arrive` (`list`, `index`) | a list's first showing, once per run | a screen's big parts (`Rise`), rows that come later | one Animated view per item at mount, then nothing |

All honour Remove animations (still: no movement; a tint or ripple still answers a touch). None loops, so none needs
`useLoopWhileShown`: a new looping part still must use it (`ui/motion.ts`).

## Proposed tokens (for `ui/theme.ts`'s `motion`; not added tonight)

- `motion.stagger: 40`: the step between items arriving (today: `Rise` 55, welcome 60/70, `Arrive` 40).
- `motion.nudge: 8`: how far a thing arriving travels (today: `Rise` 25 via FadeInDown's default, snackbar 16).
- `motion.give: { card: 0.965, tile: 0.92, icon: 0.88 }`: how far a pressed thing gives (today in `PressScale` and
  `moves.tsx`).
- `motion.easing.standard` (0.2, 0, 0, 1) and `motion.easing.emphasizedDecelerate` (0.05, 0.7, 0.1, 1): today written
  out in `celebrate.tsx`, `expressive.tsx`, `toasts.tsx`, `sign-in.tsx` and `moves.tsx`.
- `motion.duration.extraShort: 100`: a press going down (today `PressScale`'s 120 is not a token).

## What I'd change in files that aren't mine

- `ui/press.tsx`: `PressScale` presses down on `motion.spatialFast` (not a 120 ms timing), adds Android's ripple, and
  plays `haptic.hold()` when its long press runs; or becomes `Tap feel="card"`.
- `ui/haptics.ts`: add `hold()` (Android `Long_Press`, iOS medium impact) and `success()` (what `celebrate.tsx` calls
  directly today), so all haptics live in one place.
- `ui/controls.tsx`: `Segmented` with `useSlidingMark`; `Chip`'s fill on `effectsFast`; `DrawnSwitch` on Reanimated;
  `IconButton`'s ripple radius 24; filled and tonal `Button` give 0.97.
- `ui/expressive.tsx`: `Rise` on `motion.spatialDefault` and the proposed `motion.stagger`, not 16/170 and 55.
- `ui/toasts.tsx`: the snackbar leaves with `moves.leave` instead of unmounting.
- `ui/display.tsx`: `Bar` and `ProgressBar` spring their width (`spatialDefault`); `Skeleton` stays (its breathing
  already loops only while shown).
- `ui/haptics.ts` and `ui/press.tsx`, `ui/moves.tsx`: once `haptic.hold()` exists and `PressScale` / `Tap` play it when
  their long press runs, delete `parts/hold.ts` and its seven calls (or a long press buzzes twice).

## How to check it on the phone (for the conductor)

- Press: record the screen at 90 Hz with "Show taps" on, press each kind above; the ripple, tint or give is in the
  frame after the touch dot (≤ 100 ms = 9 frames).
- Jump cuts: record each change in section 2 and step frame by frame; a jump cut is one frame old, the next new.
- Remove animations (Settings → Accessibility → Remove animations) and font size 1.3: walk every screen; nothing left
  invisible (the `Rise` bug), nothing clipped mid-fold.
- Frames: `qa/jank.sh` on each animation and list scroll; janky frames < 5%, no worse than `qa/BASELINE.md`.
