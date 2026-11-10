# The phone app's motion: as it is, as it should be

Night of 10–11 Nov. Read from the code on `mobile-superapp-layout` (34948721), before tonight's layout rebuild: the
new Beranda parts (search bar, strip, service grid, Semua layanan) are listed as "new" with what they should do.
The parts to build it with are in `src/ui/moves.tsx`; the rule is in `DESIGN.md`, "Motion".

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

What every kind of tappable thing shows under the finger. **NOTHING** = no ripple, no give, no tint on Android (most
of them dim on an iPhone, or don't even do that). The 100 ms bar is met by a ripple whatever the JS thread is doing;
a give alone depends on the JS thread hearing the touch (fine at rest, late while a list is loading).

| Kind | Drawn by | Today | Should |
| --- | --- | --- | --- |
| Button (filled, tonal, outlined, text, danger) | `ui/controls.tsx` `Button` | ripple, dim | keep; filled and tonal also give 0.97 (M3 Expressive's press) |
| Big button (Tandai hadir, Kumpulkan) | `ui/big-button.tsx` | give only | give **and** ripple: `Tap feel="card"` inside it |
| Icon button (top bar, back, ⋮, close) | `ui/controls.tsx` `IconButton` | ripple (borderless, r 20), dim | keep; radius 24 so the ripple fills the 48 dp target |
| Account circle in the top bar | `shell/source-status.tsx` `action.account` | dim on iPhone, **NOTHING** on Android | goes tonight (Profil tab); if it stays: `Tap feel="icon"` |
| Screen title that opens the sync panel | `screens/home/header.tsx`, `screens/schedule/schedule-screen.tsx`, `shell/source-status.tsx` (`action.syncStatus`) | **NOTHING** | `Tap feel="row" borderless` |
| Status line under Jadwal's title | `screens/schedule/schedule-screen.tsx` | **NOTHING** | `Tap feel="row" borderless` |
| "Hari ini" link on Jadwal | `screens/schedule/schedule-screen.tsx` `action.today` | **NOTHING** | `Tap feel="row" borderless` |
| "Lihat semua" link | `screens/home/changes.tsx` `action.changes.all` | **NOTHING** | `Tap feel="row" borderless` |
| Fold / unfold toggle (held back, report details) | `screens/home/needs.tsx` `action.heldBack`; `screens/report/report-screen.tsx` `action.reportDetails` | **NOTHING** (report's chevron jumps 90°) | `Tap feel="row"`; chevron turns on `spatialFast` |
| Task page: presence line, a step that opens, "batalkan" | `screens/tasks/task-page.tsx` (`line.presence`, steps, unmark) | **NOTHING** | `Tap feel="row"` |
| Task title (shows it whole), course crumb | `screens/tasks/task-bar.tsx` | **NOTHING** | title: `Tap feel="row"`; crumb: `Tap feel="row" borderless` |
| Exam's course link | `screens/tasks/exam-page.tsx` | **NOTHING** | `Tap feel="row" borderless` |
| A handed-in file | `screens/tasks/hand-in.tsx` | **NOTHING** | `Tap feel="row"` |
| "Tampilkan lagi" on Tenggat | `screens/plan/deadlines.tsx` | **NOTHING** | `Tap feel="row" borderless` |
| A course to add to the plan | `screens/plan/planner-add.tsx` | **NOTHING** | `Tap feel="row"` |
| A point on the IPK chart | `screens/plan/chart.tsx` | **NOTHING** (its label jumps in) | `Tap feel="icon" borderless`; label: `Appear` |
| Row (classic list) | `ui/layout.tsx` `Row` | ripple, dim | keep |
| Tile row, group row, panel, setting row | `ui/v4-list.tsx` `TileRow`, `ui/group.tsx` `Panel`/`GroupRow`, `ui/settings-list.tsx` `SettingRow` | give only | give is wrong for a full-width row (it looks like the page breathing): ripple or tint, no give: `Tap feel="row"` |
| Card (now card, Perlu kamu urus, nanti, a class on the timeline, a Task row) | `screens/home/now.tsx`, `urus.tsx`, `later.tsx`, `screens/schedule/day.tsx`, `screens/tasks/row-parts.tsx` (all `PressScale`) | give only | give and ripple: `Tap feel="card"` |
| Day in the day strip, a day in the month | `screens/schedule/strip.tsx`, `month.tsx` (`PressScale`) | give only | `Tap feel="tile"`; the picked mark slides (`useSlidingMark`) |
| Course tab pill (Pertemuan, Materi, Tugas…) | `screens/course/course-screen.tsx` `TabBar` (`PressScale`) | give; the picked pill's colour jumps | `Tap feel="tile"`; picked mark slides (`useSlidingMark`) |
| Segmented control (Tugas's filter, nilai, proyeksi, tenggat) | `ui/controls.tsx` `Segmented` | ripple; the picked segment jumps | keep the ripple; picked mark slides (`useSlidingMark`) |
| Chip | `ui/controls.tsx` `Chip` | ripple; selected fill jumps | keep; fill fades on `effectsFast` |
| Switch (Android) | `ui/controls.tsx` `MaterialSwitch` (native) | native ripple and thumb | keep |
| Switch (drawn fallback) | `ui/controls.tsx` `DrawnSwitch` | none; thumb springs on the **JS thread** (`useNativeDriver: false`) | Reanimated (`interpolateColor` + `withSpring(motion.spatialFast)`) |
| Sheet choice, menu item | `ui/sheet.tsx`, `ui/menu.tsx` | ripple, dim | keep |
| Choice in a choice sheet | `ui/settings-list.tsx` `ChoiceSheet` | give | `Tap feel="row"`; the radio dot grows in on `spatialFast` |
| Snackbar's Urungkan | `ui/toasts.tsx` | ripple, dim | keep |
| Bottom tabs | `app/(tabs)/_layout.tsx` (NativeTabs) | native ripple, icon fills | keep (Android's own) |
| Search bar (new, `home.search`) | tonight's Beranda | — | `Tap feel="row"` (tint, no give: it's a field) |
| Strip tile (new, `home.strip`) | tonight's Beranda | — | `Tap feel="tile"` |
| Service tile (new, `home.grid`, Semua layanan) | tonight's Beranda | — | `Tap feel="tile"`: the filled icon's colour square gives, the word stays |
| Welcome, sign-in buttons | `shell/welcome.tsx`, `shell/sign-in.tsx` | ripple | keep |

Count: **19 kinds answer with NOTHING on Android today**, every one of them a bare `Pressable`.

## 2. State changes

What the Student causes or sees, screen by screen. "Remove animations" is what happens with Android's setting on:
nothing slides or springs; a change is simply there, and a fade only where it is already safe (see the last column).

| Screen | Change (trigger) | What it tells | Today | Should | Token | Remove animations |
| --- | --- | --- | --- | --- | --- | --- |
| All | Push to a screen, Back | where you went | native | keep | native | native (instant) |
| All | Tab switch (bottom bar) | which tab | native, instant | keep instant (speed wall: p90 < 100 ms) | — | same |
| All | Tab badge appears (`TabBadges`, after the first frame) | something needs you there | native (BottomNavigationView) | keep native | — | same |
| All | A screen's first showing | here's the page | `Rise` (stagger, M3 spring 16/170: not a token) | keep; move its spring to `spatialDefault`, its stagger to the proposed `motion.stagger` | spatialDefault | there at once |
| All | Skeleton becomes content | the data came | **jump cut** | `CrossFade id={ready ? "data" : "wait"}` | medium | swap |
| All | Pull to refresh | it's checking | native `RefreshControl` | keep native | native | native |
| All | A section appears after a refresh (new Task, new change) | something new | **jump cut** (and what's below jumps down) | `Appear` on the new part, `Appear shifts` on what's below | arrive: medium + spatialDefault | there at once |
| All | Error banner / offline line comes and goes (`ProblemBanner`, status line) | something's wrong / fine again | **jump cut**; the page jumps by its height | `Appear shifts` around the banner | arrive / leave: short | there / gone at once |
| All | Snackbar arrives | what happened, with Urungkan | rises 16 dp and fades (RN Animated, native driver, emphasized decelerate, medium) | keep; on its own token (8 dp, `moves.arrive`) | medium | fades |
| All | Snackbar leaves | — | **jump cut** (unmounts) | `moves.leave` on its view | short | gone |
| All | Sheet opens, closes | a closer look | native Material sheet | keep | native | native |
| All | Long-press menu opens | the row's actions | native sheet / menu (fade + scale) | keep | native | native |
| Beranda | Now card: "next" → "now" → "window open" → "marked" | what to do about this class now | **jump cut** between kinds (button appears, wave appears, check appears); "marked" draws `CookieCheck` | each kind's new part `Appear`; the card `Appear shifts` so Beranda below it slides; the check stays the earned moment | spatialDefault | there at once (check already drawn) |
| Beranda | Now card's minutes left (each minute) | how long | **jump cut** | `RollTo` (count + 3 dp nod) | medium | changes in place |
| Beranda | Now card's wave (live class) | how far along | moves, loops only while shown | keep | — | still |
| Beranda | Strip numbers (due, at risk) after a refresh (new) | today's load | — | `RollTo` | medium | in place |
| Beranda | Strip tile leaving because it's good news now (new: "no tile that says 0") | done | — | `Appear` (leave short), its neighbours `shifts` | short + spatialDefault | gone at once |
| Beranda | "Perlu kamu urus" held back unfolds (`action.heldBack`) | there's more | **jump cut** | `Appear` on the held part, `Appear shifts` below; chevron turns | spatialDefault | there at once |
| Beranda | A card in Perlu kamu urus goes (done elsewhere) | one less | **jump cut** | `Appear` + neighbours `shifts` | short + spatialDefault | gone at once |
| Beranda | Changes ("Perubahan") gets a new line | something moved | **jump cut** | `Appear` | medium | there |
| Semua layanan (new) | Search filters the services | what matches | — | each group `Appear shifts`; tiles that go leave short | short | at once |
| Search | Results arrive as the Student types | what matches | `Rise` on the first 1.5 s only; after that **jump cut** | `CrossFade id={query}` on the results block; first results `Arrive list="search"` | medium | swap |
| Jadwal | Day picked in the strip | which day | the day's timeline slides in from the side it came from (FadeInLeft/Right, spring 20/220: not a token); the picked day's mark **jumps** | keep the slide, on `spatialDefault`; mark slides (`useSlidingMark`) | spatialDefault / spatialFast | timeline swaps, mark jumps |
| Jadwal | "Hari ini" (back to today) | today | as above | as above | — | — |
| Jadwal | Month view: a day picked | that day's classes | **jump cut** | `CrossFade id={day}` on the list under the month | medium | swap |
| Jadwal | The "now" line moving through the day | where you are in the day | moves each minute (redraw) | keep (a minute's step is not a motion) | — | same |
| Tugas | Filter (Segmented) switched | which Tasks | **jump cut**; mark jumps | mark slides (`useSlidingMark`), list `CrossFade id={filter}` | spatialFast + medium | swap |
| Tugas | Task swiped past its threshold | letting go will do it | icon grows, haptic tick (`SwipeRow`) | keep | spatialFast | follows the finger, no grow |
| Tugas | Task marked done (swipe) | done, put away | slides out, folds (`SwipeRow`), snackbar with Urungkan | keep; rows below use `moves.resize` so they close the gap together | medium | fades, folds at once |
| Tugas | Task marked done (long-press menu, TalkBack action) | done | **jump cut** (row vanishes) | the row `Appear` (leave), rows below `shifts` | short + spatialDefault | gone at once |
| Tugas | Urungkan (undo) brings the row back | it's back | **jump cut** | `Appear` | medium | there |
| Tugas | Counts in section titles change | how many left | **jump cut** | `RollTo` | medium | in place |
| Task page | Handed in (Kumpulkan) | it's in | `Celebration` (cookie, drawn check, success buzz) | keep: the earned moment | expressive | fades, check drawn |
| Task page | Upload progress | how far | `ProgressBar` width **jumps** per step | width springs (`spatialDefault`) | spatialDefault | jumps |
| Task page | Time left counting (`CountUp`) | how long | counts up once | keep for the first showing; later changes `RollTo` | — | there |
| Task page | A step opens / folds | the detail | **jump cut** | `Appear shifts` | spatialDefault | at once |
| Task page | Comment sent (thread) | it's there | **jump cut** (row appears) | the new comment `Appear` | medium | there |
| Task page | Draft saved | safe | snackbar | keep | — | — |
| Kuliah / course | Course tab switched (pill) | which part | panel **jump cut**; pill colour jumps | mark slides (`useSlidingMark`), panel `CrossFade id={tab}` | spatialFast + medium | swap |
| Kuliah / course | Save offline progress | how far | bar jumps per file | width springs | spatialDefault | jumps |
| Kuliah / course | Presence marked (course now card) | done | `CookieCheck` | keep: earned | expressive | check drawn |
| Kuliah | Absences left number changes after a sync | how close to the limit | **jump cut** | `RollTo` | medium | in place |
| Profil / Akademik | IPK, SKS (big numbers) first showing | your standing | `CountUp` once (`Figure`) | keep | — | there |
| Profil / Akademik | IPK after a refresh changes | it moved | **jump cut** (CountUp counts only once) | `RollTo` | medium | in place |
| Nilai | Transcript semester folds / unfolds | detail | **jump cut** | `Appear shifts` | spatialDefault | at once |
| Nilai, Proyeksi | Segmented switched | which view | **jump cut** | mark slides, `CrossFade` | spatialFast + medium | swap |
| Rencana studi | Course added, moved, removed; grade picked | the plan changed | **jump cut**, confirm haptic, snackbar | the row `Appear`, its group `shifts`; totals `RollTo` | spatialDefault | at once |
| Rencana studi | Rules, hidden courses unfold | detail | **jump cut** | `Appear shifts` | spatialDefault | at once |
| Tenggat | Chips switched, "show more" | which / more | **jump cut** | chip fill fades; new rows `Appear` | effectsFast / medium | at once |
| Tenggat | A group unfolds | detail | **jump cut** | `Appear shifts` | spatialDefault | at once |
| IPK chart | A point tapped | that semester's figure | label **jump cut** | label `Appear` | short | there |
| Notifikasi | "Tandai semua dibaca" | read | dots **jump cut** | dots fade out (`moves.leave`) | short | gone |
| Lapor masalah | Details unfold; report sent | detail; sent | **jump cut**; sent page swaps in | `Appear shifts`; sent: `CrossFade` + `DrawnCheck` (earned: it's sent) | medium | at once |
| Pengaturan | A switch | on / off | native | keep | native | native |
| Pengaturan | A choice picked in a sheet | saved | the radio dot jumps, sheet closes | dot grows in (spatialFast) | spatialFast | jumps |
| Pengaturan | Error banner | couldn't save | **jump cut** | `Appear shifts` | short | at once |
| First run | Welcome steps | the app, step by step | FadeInDown stagger (60–70 ms), fade out | keep; on tokens | medium | fades |
| Sign-in | Web sign-in sheet | — | slides in (emphasized, long), fades out | keep | long | fades |

## 3. Haptics

`ui/haptics.ts` has three: **tick** (a small step), **confirm** (something done), **toggle** (a switch). Celebrations
use the phone's own **success** directly (`ui/celebrate.tsx`).

**Where one fires today:**

| Where | Haptic | Is it a commit? |
| --- | --- | --- |
| `SwipeRow`: passing the threshold | tick | yes (a swipe past its threshold) |
| `SwipeRow`: letting go past it | confirm | yes (done) |
| Hand-in `Celebration`, `DrawnCheck` | success | yes (sent) |
| Beranda's and Kuliah's now card: SIX no longer shows the check-in (`home/now.tsx`, `course/now.tsx` `useDone`) | confirm | yes (presence marked) |
| Kuliah's now card: tapping **Tandai hadir** (`course/now.tsx:306`) | confirm | **no**: it only opens SIX. Beranda's same button has none. Remove it (the commit is when presence is marked, which already buzzes) |
| Rencana studi: a change to the plan (`planner-kit.tsx` `commitHaptic`), a curriculum fix (`curriculum.tsx`) | confirm | yes (saved) |
| Curriculum toggle (`curriculum.tsx:98`), `SwitchRow` (`settings-list.tsx`), alerts switch (`settings/alerts.tsx`) | toggle | yes (a setting saved); note Android's own switch already plays one: check it doesn't buzz twice |
| A choice picked in a `ChoiceSheet` (`settings-list.tsx`) | tick | yes (saved) |
| Attendance target stepper, course colour pick (`settings/choices.tsx`) | tick | borderline: each step saves, but a fast run of taps is a run of buzzes. Keep the tick for the colour pick; the stepper: tick only at its ends |
| Reset course colours, wake all snoozed (`settings/choices.tsx`, `settings/alerts.tsx`) | confirm | yes |
| Sign out (`settings/about.tsx`), sign out of one (`settings/accounts.tsx`) | confirm | yes |
| Notifikasi: mark all read (`app/alerts.tsx`) | confirm | yes |
| Nilai: a grade picked (`grades-screen.tsx`) | confirm | yes (a planned grade saved) |

No haptic fires on a plain tap or a scroll today, except the Tandai hadir one above.

**Commits with none:**

| Commit | Should |
| --- | --- |
| A long press that opens a row's menu (26 `onLongPress` in the screens) | the phone's long-press (Android `Long_Press`; iOS medium impact). Proposed `haptic.hold()`, fired in one place: `PressScale`/`Tap` when `onLongPress` runs |
| A Task marked done from the long-press menu or TalkBack's action | confirm (the same commit as the swipe) |
| Ingatkan nanti: a time picked | confirm |
| Urungkan (undo) | tick (it's a commit, but a small one) |
| A comment sent (`tasks.comment`) | confirm |
| A report sent (`report.send`) | success, with `DrawnCheck` on the sent page |
| Save offline finished (`course.saveOffline`) | confirm |
| Signed in to Edunex or SIX (`auth.signIn`) | confirm |
| Exam added to the phone's calendar | confirm |

## The plan: ten changes, in order

1. Give every bare `Pressable` (the 19 **NOTHING** rows above) a press with `Tap` from `ui/moves.tsx`, so no touch in
   the app goes unanswered.
2. Swap `PressScale` for `Tap` on full-width rows (`TileRow`, `Panel`, `GroupRow`, `SettingRow`) as `feel="row"`, and on
   cards and tiles as `feel="card"`/`"tile"`, so every card ripples and no full-width row shrinks.
3. Turn every skeleton into content with `CrossFade` (`id={ready ? "data" : "wait"}`), so data arriving is seen arriving.
4. Slide the picked mark in `Segmented`, the course tabs, the day strip and the month with `useSlidingMark`, and
   cross-fade what they show with `CrossFade`, so a switch shows where you went.
5. Open and fold every foldable part (held back, steps, transcript, plan rules, deadlines, report details) with
   `Appear shifts`, so the page moves aside instead of jumping.
6. Make the now card's kinds ("next" → "now" → "window open" → "marked") arrive with `Appear` and slide Beranda under it
   with `Appear shifts`, keeping `CookieCheck` the one earned moment there.
7. Roll every number the Student sees change (minutes left, strip counts, section counts, absences, IPK after a
   refresh) with `RollTo`, keeping `CountUp` for a first showing only.
8. Bring banners, the offline line, the snackbar's leaving and a row done from the menu in and out with `Appear`
   (`moves.leave`), so nothing pops.
9. Add the missing commit haptics (long press via a proposed `haptic.hold()` in `Tap`/`PressScale`; done from the
   menu; sent; saved offline; signed in) and remove the Tandai hadir tap's, using `ui/haptics.ts`.
10. Arrive each list's first showing (Tugas, Notifikasi, search, Semua layanan's groups) once with `Arrive`, and move
    `Rise`, Jadwal's day slide and the welcome stagger onto the tokens, so the app arrives one way everywhere.

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
- `screens/course/now.tsx:306`: drop the confirm haptic on the Tandai hadir tap.

## How to check it on the phone (for the conductor)

- Press: record the screen at 90 Hz with "Show taps" on, press each kind above; the ripple, tint or give is in the
  frame after the touch dot (≤ 100 ms = 9 frames).
- Jump cuts: record each change in section 2 and step frame by frame; a jump cut is one frame old, the next new.
- Remove animations (Settings → Accessibility → Remove animations) and font size 1.3: walk every screen; nothing left
  invisible (the `Rise` bug), nothing clipped mid-fold.
- Frames: `qa/jank.sh` on each animation and list scroll; janky frames < 5%, no worse than `qa/BASELINE.md`.
