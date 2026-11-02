# Design system

The look and behaviour every Edunex Plus screen follows. The app is Edunex and
SIX the way students already know them (course → modules, meetings, Jadwal,
KRS), merged into one calm app that tells the Student what matters. It is not
a calendar app or a to-do app; productivity ideas appear only as accents.

Every decision starts from the Student: a tired ITB student between classes,
on a laptop, reading Indonesian, who needs one answer quickly and must never be
misled about attendance, deadlines or grades. Every screen is checked against
Nielsen's ten usability heuristics
(https://www.nngroup.com/articles/ten-usability-heuristics/).

The code is the source of truth: tokens live in `src/app/styles.css`, the
components in `src/app/ui/` (screens are built from `src/app/ui/layout.tsx`),
and every word in `src/core/strings/`. This page explains them.
`test/app/ui-rules.test.ts` reads the window's classes and fails on a
hand-typed size, corner or layer (`text-[…px]`, `rounded-[…]`, `z-[…]`), a
blur, a glow, spaced-out capitals, `h-screen` or a dropped arrival animation;
a real exception goes on its allowed list with the reason.

Agents doing polish work have ibelick's ui-skills installed (`baseline-ui`,
`fixing-accessibility`, `fixing-motion-performance`, `improve-ui`). Where one
of their rules disagrees with this page, this page wins: Radix (not Base UI),
`cx()` (not `cn`/clsx), the app's own easings, shadows and title tracking,
`element.animate` (not `motion/react`) for JS animation, and motion wherever
the Motion section below allows it.

## Principles

1. **Answer first.** Each screen answers one question before anything else
   (Beranda: what do I do now; Presensi: am I OK, and what do I do, said for
   the next class day; Nilai:
   where is my IPK). The answer is the first thing at the top left, in a
   sentence; the detail follows.
2. **Nothing to relearn.** Same names and places as Edunex and SIX: Beranda,
   Tugas & Ujian, Jadwal, Presensi, Nilai, Rencana studi, and the term's
   courses in the sidebar.
3. **One idea per row.** A row says what it is (title), when or where (one
   meta line), and ends with its state or its one action. No run-on lines of
   five facts; the rest belongs on the detail screen.
4. **Color means something.** Neutral by default. Blue is for actions and
   links; red for what is lost, overdue, failing or destructive; amber for
   what needs the Student soon; green for done, safe and live. Course colors
   only mark identity, on a dot or a stripe, never a bar or a word, and
   always beside the course's code.
5. **The source only where it changes what to do.** Where to act ("Catat di
   Edunex"), which date to trust when SIX and Edunex disagree, what is missing
   ("Tidak ada di SIX"). Never a tag on every row.
6. **Honest, quiet status.** Data status is one quiet line while everything
   is fresh, and a banner on every screen the moment it isn't (no connection,
   a session ended, a source changed something), with the time of the last
   data and the one fix. Old data is never shown as live.
7. **Every action answers back, and can be taken back.** Buttons show they
   are working; success is confirmed where the Student is looking; anything
   destructive can be undone (an undo toast) or asks first. Final actions
   (handing in) say plainly what they will and won't count for.
8. **Motion explains change.** Panels grow from where they open and leave the
   way they came, a row the Student removes fades out of its list, a highlight
   glides to the new pick, and a figure the Student just changed counts to its
   new value. Screens and rows don't animate in: switching is instant. It is
   quick and quiet; nothing moves for decoration. The first run is the one
   exception: seen once, it is where the app's delight goes.

## Foundation

- React 19 and Tailwind CSS v4. Tokens are CSS variables; Tailwind utilities
  read them (`bg-surface`, `text-muted`, `bg-(--status-draft-bg)`).
- Accessible headless primitives from Radix (dialog, switch, tooltip; tabs and
  menus as screens need them), styled in a small shadcn-style kit in
  `src/app/ui/`. Class names merge with `cx()` so a later class wins; every
  token the app adds is registered there.
- **Motion** needs no library, as in T3 Code: CSS transitions and keyframes
  (tokens in `styles.css`) for everything that can be CSS, and the browser's
  Web Animations API (`element.animate`) for the rest, only inside the kit
  (the `src/app/ui/motion/` pieces and the toasts in `overlays.tsx`), all
  through `ui/motion/animate.ts`.
- **Theme** follows the system, with a manual override in Settings. The main
  process applies the choice to the whole window (`nativeTheme`), so CSS only
  ever asks `prefers-color-scheme`, and native parts (scrollbars, title bar,
  the window's own background before the page draws) always match.
- **Language**: Bahasa Indonesia (default) and English, switchable at any
  time, also from the welcome screen. All text comes from the catalog
  (`src/core/strings.ts`), shared by the window and the menus.

## Color

Each token has a light and a dark value; the theme switches them all at
once. Text colors are tested against every background they sit on
(`test/app/contrast.test.ts`), including a hovered, picked (`--selected`,
blended over what it tints) and sunken row: 4.5:1 or more for text, 3:1 for
the focus ring.

**Surfaces**

| Token | Light | Dark |
|---|---|---|
| `--canvas` | `#ffffff` | `#161618` |
| `--sidebar` | `#f5f5f7` | `#1b1b1e` |
| `--surface` | `#ffffff` | `#1c1c1f` |
| `--raised` | `#ffffff` | `#1f1f23` |
| `--welcome` | `#f5f5f7` | `#121214` |
| `--edge` | `#e4e4e9` | `#2a2a2f` |
| `--line` | `#ededf0` | `#26262b` |
| `--fill` | `#f4f4f6` | `#232327` |
| `--hover` | `#f1f1f4` | `#222226` |
| `--selected` | `rgb(0 0 0 / 0.055)` | `rgb(255 255 255 / 0.07)` |
| `--sunken` | `#f7f7f9` | `#19191c` |
| `--scrim` | `rgb(0 0 0 / 0.25)` | `rgb(0 0 0 / 0.45)` |
| `--track` | `#d4d4da` | `#3a3a40` |
| `--field-edge` | `#8d8d92` | `#6c6c72` |
| `--segment` | `#ffffff` | `#34343a` |

**Text and accent**

| Token | Light | Dark |
|---|---|---|
| `--fg` | `#1d1d1f` | `#ececef` |
| `--muted` | `#5b5b61` | `#a8a8b0` |
| `--faint` | `#68686e` | `#97979d` |
| `--accent` | `#2f6feb` | `#2f6feb` |
| `--accent-hover` | `#2763d8` | `#2a66df` |
| `--accent-active` | `#2258c4` | `#2763d8` |
| `--accent-fg` | `#2862d6` | `#7aa2ff` |
| `--on-accent` | `#ffffff` | `#ffffff` |
| `--focus` | `#2f6feb` | `#6f9bff` |
| `--tooltip-bg` | `#1d1d1f` | `#ececef` |
| `--tooltip-fg` | `#ffffff` | `#1d1d1f` |

**Tones (background / text)**

| Token | Light | Dark |
|---|---|---|
| `--danger-bg` | `#fde7e4` | `#3a1c19` |
| `--danger-fg` | `#b42318` | `#ff9c8f` |
| `--warning-bg` | `#fdf2d6` | `#382d10` |
| `--warning-fg` | `#855000` | `#f2c862` |
| `--success-bg` | `#dcf4e5` | `#12301f` |
| `--success-fg` | `#166240` | `#80e0a9` |
| `--info-bg` | `#e6eefe` | `#1b2742` |
| `--info-fg` | `#2a58b8` | `#9ab8ff` |
| `--neutral-bg` | `#f0f0f2` | `#27272b` |
| `--neutral-fg` | `#4f4f56` | `#bdbdc5` |
| `--live` | `#22a35a` | `#2fbf6c` |

**Field edges.** A field's edge (a grade, a score, the answer box, a link
box) and a switch that's off use `--field-edge`, 3:1 on every surface, so the
control shows where it is; cards and lists keep the quieter `--edge`.

**Meters (fill on track).** A meter's fill reads 3:1 on its own track. Amber
and green have meter colors of their own: the tones' `-fg` colors are for
text, and amber text is brown. Red uses `--danger-fg`, blue `--accent`.

| Token | Light | Dark |
|---|---|---|
| `--meter-track` | `#ececef` | `#2c2c30` |
| `--meter-warning` | `#b26b00` | `#f2c862` |
| `--meter-success` | `#1e8f4f` | `#2fbf6c` (`--live`) |
| `--pip-ring` | `#7a7a80` | `#77777d` |
| `--hatch` | `rgb(0 0 0 / 0.07)` | `rgb(255 255 255 / 0.08)` |

**The absence bar** (`AbsenceBar`) sits on rows and cards rather than a
track, so its marks read 3:1 on `--surface`, `--hover`, `--raised` and
`--canvas`: a used absence fills in `--muted`, all of them `--meter-warning`
once the bar is full (past its limit too); a miss past the limit is a
`--danger-fg` segment after the limit line; one still left is a ring in
`--pip-ring` (`--field-edge` falls under 3:1 on a hovered row); an estimate is
that ring with `--hatch` stripes; the limit line is `--fg`.

**Task statuses (background / text)**

| Token | Light | Dark |
|---|---|---|
| `--status-not-started-bg` | `#f0f0f2` | `#27272b` |
| `--status-not-started-fg` | `#4f4f56` | `#bdbdc5` |
| `--status-draft-bg` | `#fdf2d6` | `#382d10` |
| `--status-draft-fg` | `#855000` | `#f2c862` |
| `--status-submitted-bg` | `#dcf4e5` | `#12301f` |
| `--status-submitted-fg` | `#166240` | `#80e0a9` |
| `--status-overdue-bg` | `#fde4e2` | `#3a1817` |
| `--status-overdue-fg` | `#b42318` | `#ff9c94` |
| `--status-closed-bg` | `#e8e8eb` | `#2a2a2f` |
| `--status-closed-fg` | `#3f3f46` | `#c6c6ce` |
| `--status-review-bg` | `#ebe7fd` | `#272042` |
| `--status-review-fg` | `#5a33c8` | `#c4b5ff` |
| `--status-returned-bg` | `--status-draft-bg` | `--status-draft-bg` |
| `--status-returned-fg` | `--status-draft-fg` | `--status-draft-fg` |

**Sources.** Edunex and SIX show their own logos (`SourceLogo`), never a
letter in a colored square. The ITB calendar has no logo here: a calendar in
its own colors (background / text) stands for it, and tints exam periods.

| Token | Light | Dark |
|---|---|---|
| `--source-itb-bg` | `#f3ecfd` | `#271d3a` |
| `--source-itb-fg` | `#6338b8` | `#c4b0f5` |

**The first run's stage** (the welcome screen only, Motion below) is near-black
in either theme, lit by its own light (`ui/motion/ascii-light.ts`): soft glows
in the app's blues, from `#0b1a6b` to `#cfe0ff`, drawn in ASCII characters,
coming from the app's mark. Inside it the tokens take their dark values
(`.stage-dark`); its preview of the app takes the app's own theme back
(`.welcome-app`).

| Token | Light | Dark |
|---|---|---|
| `--stage` | `#04050a` | `#04050a` |

**Course colors.** Each course has an identity color for its dot and stripe,
one of ten named colors (`src/core/course-colors.ts`), each a pair of tones,
`--course-<id>` for light and for dark: cyan, indigo, berry, blue, orchid,
magenta, purple, pink, plum, lavender (the automatic order, most distinct
first). Saved data holds the name, never a hex, so a tone can be tuned
without touching it. The palette keeps to OKLCH hues 208°–354°. It has no
red, rose, orange, amber, yellow or brown (status), no green or teal (teal
reads as green), and no grey (an unknown course, "not yet"), so a course never
looks in danger, done or switched off because of its color. Every tone reaches 3:1
on every surface it sits on in its theme, hovered and picked rows included
(`test/app/contrast.test.ts`), and stays clear of the accent and focus blues.
A course's automatic color is remembered the first time it shows (the first
free one in the order), so it never moves by itself, not when SIX connects
and not when a course is added or dropped. A course the app doesn't know is an
outlined square (1 px `--faint`), never a grey one. The code is always beside
the mark. A week block too short for two lines reads "08:00 PL3002", and the
rail shows the code under the dot. A meeting only Edunex announced gets a
dashed stripe. In high contrast the marks stay, edged in the system's text
color. Course colors mark identity only: never a bar's fill, a status, or
text.

The Student picks a course's color where they see it, with a right-click (or
Shift+F10, or the context-menu key) on its sidebar row, its dot and code above
the course page's title, or "Ganti warna" in that page's "Lainnya". Settings →
Warna mata kuliah lists the term at once, previews it in light and dark (a band
for each theme on top of the list, each course by its dot and code, the two in
the same columns), and puts every course back to automatic. The sidebar's
palette button beside "Mata kuliah" opens that list. They all open one picker
(`src/app/course-color-picker.tsx`): "Otomatis (Biru muda)" first, then the ten
colors by hue in two rows of five, each with the code of a course that has it.
Moving through them redraws the course everywhere, unsaved. The picker saves
once when it closes and says so with Undo, and Escape puts everything back. A
pick that takes an automatic course's color moves only that course, and the
picker and the toast name it. Two courses may share a color. The picker says
so once, in a neutral note (never amber), and Settings says "sama dengan …".

**Highlighter ink.** What the Student highlights in a file they read
(`ui/highlights.tsx`) is one of four highlighter colors: yellow (first, as a
highlighter is), green, blue and pink, `--highlight-<id>`, the same in both
themes because it's drawn on paper (PDF and Word pages stay white). It's
multiplied into the page, so the print stays as dark as it was; under a text
file's own text on the dark surface it's dimmed to 30%. Saved data holds the
name, never a hex. It's the Student's own mark, never a status, and its color
is never the only signal: a highlight is named by its color and its words.

**Status colors.** Red (`danger`): lost, overdue, failed, can't reach the
target, destructive. Amber (`warning`): needs the Student soon (no absences
left, due within a day, a session ended). A full absence bar is amber; what's
past its limit is red. Green (`success`, `live`): done,
safe, connected, happening now. Blue (`accent`, `info`): actions, links,
neutral information. Grey (`neutral`): not yet, not applicable. Bars and
meters take their color from status (the meter colors above), never from the
course.

**Color is never the only signal.** Task statuses have their own glyph and
word, source states their own mark and word.

## Type

The system font (SF Pro on macOS, Segoe UI on Windows, the desktop's own on
Linux); no web fonts. Numbers that line up use tabular figures. A row uses at
most three styles: its title, one supporting line, one meta line.

| Token | Size / line | Use |
|---|---|---|
| `text-micro` | 11 / 14 | Badges, keyboard keys |
| `text-caption` | 12 / 16 | Section labels in panels, tiny meta |
| `text-small` | 13 / 18 | Meta lines, secondary text, buttons |
| `text-body` | 14 / 20 | Default text, row titles (medium) |
| `text-lead` | 15 / 22 | A page's description line, card leads |
| `text-title` | 16 / 22 | Section and dialog titles (semibold, −0.01em) |
| `text-heading` | 20 / 26 | Big answers inside a card; a few small counts (`Stat size="heading"`) |
| `text-figure` | 26 / 32 | A figure read at a glance (`Stat`: IPK, SKS, absences left) |
| `text-display` | 28 / 34 | Page titles (semibold, −0.02em) |

The first run alone (the welcome screen) goes bigger, and has a serif:
`text-hero` 50 / 54 for its promise and `text-scene` 38 / 43 for each step's
title (bold, −0.02em), with `text-pitch` 17 / 26 for the line under them; its credit is `font-serif` (New York on macOS),
`text-credit` 15 / 28 in spaced capitals with `text-credit-word` 20 / 28 for
the little italic word.

## Space, shape, depth

- **Spacing** on a 4 px grid. One page container for every screen
  (`Page`): 40 px side padding (20 px once the window is under 52rem wide,
  zoomed in), 1040 px wide (Jadwal goes wider), the same left edge
  everywhere. Sections 40 px apart; inside a section 12 px.
  A grid that holds rows gives every column a size that can shrink
  (`grid-cols-1`, `minmax(0,…)`), at every width: a column that fits its
  content would grow to a long title with no spaces and push the page past
  the window. Where a row's secondary columns (a tag, SKS) would squeeze its
  name in a narrow list, they move to a line under the name (`@container`)
  and the row's controls stay on it.
- **Zoom.** Every screen still works zoomed to 200% (the window's zoom is
  real): text wraps, a row's action goes under its words rather than
  squeezing them to a word per line (a text block keeps a real `basis-64`),
  nothing runs past the window, and what can't reflow (the week's time grid,
  a tab list) scrolls sideways in its own frame.
- **Radius**: 5 px keys and tags (`rounded-tag`), 6–8 px buttons and inputs
  (`rounded-md`, `rounded-lg`), 12 px cards and lists (`rounded-xl`), 16 px
  raised cards and dialogs (`rounded-2xl`), full for chips and switches. No
  `rounded-[…]`.
- **Layers** for what floats over the window, lowest to highest:
  `z-(--z-float)` 40 (over the page, under any dialog: the report question in
  the window's corner, the guide's dimming and card),
  `z-(--z-dialog)` 50, `z-(--z-confirm)` 55 (a question asked over a dialog),
  `z-(--z-popover)` 60, `z-(--z-tooltip)` 70, `z-(--z-toast)` 80. Inside one
  panel, plain `z-10` and `z-20`. No `z-[…]`.
- **Depth**: one surface level per region; no card inside a card. Lists and
  cards sit on the page with a 1 px edge and a faint shadow (`shadow-card`);
  the one thing that matters most right now is raised (`shadow-raised`);
  quiet areas inside are sunken (`bg-sunken`). Floating things cast real
  shadows: `shadow-pop` (tooltips, toasts, popovers), `shadow-dialog`.

## Motion

Quick, quiet and purposeful: it shows where something came from or what
changed, then gets out of the way. The feel to match is T3 Code's: most motion
takes 150 to 200 ms, only transform and opacity move, and routine actions don't
replay entrances.

**Timings.** Tokens in `styles.css`; JS animation reads the same numbers from
`src/app/ui/motion/tokens.ts`, in milliseconds and CSS easing strings (a test
keeps them equal).

| Token | Value | For |
|---|---|---|
| `--duration-quick` | 150 ms | Press, color changes, tooltips, popovers, anything leaving, a highlight sliding |
| `--duration-base` | 200 ms | Dialogs, a panel opening, the gap closing after a row or toast leaves |
| `--duration-slow` | 400 ms | A number counting, a bar filling |
| `--ease-out` | (0.16, 1, 0.3, 1) | Arriving: a fast start, a soft landing |
| `--ease-standard` | (0.2, 0, 0, 1) | Leaving and moving |
| `--ease-scene` | (0.32, 0.72, 0, 1) | The first run's camera: off at once, a long soft landing, for something crossing the window |
| `--ease-island` | a sampled spring, 650 ms | The welcome's pills changing shape to fit new words, like the Dynamic Island: the only curve that overshoots (about 5%) |

**What moves.**

| What | How |
|---|---|
| Hover, press, color changes | Hover backgrounds: instant (rows, menu items, notifications). Buttons press to 97% in 150 ms (not menu or popover triggers, not rows; a row's press is its darker background). Other color changes: 150 ms. A transition that names no curve runs on `--ease-out` (`--default-transition-timing-function`), never Tailwind's own |
| Switching light and dark | At once: nothing fades its color (`.no-transitions` on `<html>` for two frames) |
| Screens and their rows | Nothing: switching screens or going further in is instant, and rows don't rise in |
| Search (⌘K) | Nothing: there and gone at once, scrim included. It's opened from the keyboard many times a day, and a command palette that animates makes every one of those wait |
| Dialogs (`animate-pop-in`, `animate-pop-out`; the scrim `animate-fade-in`, `animate-fade-out`) | In 200 ms from 98%, out 150 ms |
| Popovers and tooltips (`animate-popover-in`, `animate-popover-out`) | 150 ms, growing from their control (`origin-(--radix-popover-content-transform-origin)`), so the side they open on shows. A tooltip grows in only after the wait; moving on to the next control shows its tooltip at once, and a tooltip goes at once |
| Banners (`animate-slide-down`) | 200 ms from 6 px above |
| Toasts (`animate-toast-in`; leaving with the kit's `leave`) | Rise in 200 ms from 8 px below and 98%; leave by fading 150 ms, then the gap closes in 200 ms (starting 90 ms in) so the others slide into place; a leaving toast takes no clicks |
| A row the Student removes (`PresenceList`) | Fades 150 ms, then the gap closes in 200 ms (starting 90 ms in); focus moves on to the same control in the next row. Rows that join, and a change of the whole list, appear at once |
| A panel under its button (`DisclosurePanel`, a native `<details>`) | Height and opacity, 200 ms open (ease-out), 150 ms closed (ease-standard); clipped only while it moves |
| A tab's content | Swaps at once; only the tab's highlight moves |
| A segmented control's or tab list's highlight (`SlidingHighlight`) | Sits on the new pick at once and glides there from the old one as a transform (translate and scale), 150 ms ease-out |
| A figure the Student just changed (`AnimatedNumber`) | Counts 400 ms ease-out with no overshoot, while the page's text is already the true value. A figure that changes on its own just changes |
| Bars filling | 500 ms, when new data arrives. A window's time left (`CountdownBar`), which shrinks every minute, slides as a transform in 400 ms ease-out. Work under way (`ProgressBar`: a hand-in, a download) slides as a transform too, 400 ms linear (progress doesn't ease), picking up from wherever it is when the next share comes in |
| The first run (`ui/motion/arrival.ts`, `ui/motion/scene.ts`, `ui/motion/ascii-light.ts`, `shell/welcome-sound.ts`): the welcome screen, its reading step, the first-run scan | The app's first impression, seen once, after Dia, Arc and Droppy: a scene of its own on a dark stage, one bold line, one sentence and one button per step. **Light:** one light, from the app's mark: soft glows in the app's blues drawn in ASCII characters that scramble under the pointer (WebGL2, adapted from React Bits' GradientASCII, its notice kept). It scrambles in outward from the mark, eases to the mark's new place on each step (`lightAt`, `tween`), backlights the reading step's window, brightens once when Beranda is ready, and fades as the app opens. It rests while the window is hidden, and with Reduce motion it is drawn once and holds still. **Opening:** the credit, "*dari* MAHASISWA ITB" in serif, the little word turning to *untuk* in place (the old blurs away up as the new sharpens in, their shared slot narrowing so the line stays centred); any key or click moves on. **Promise:** the mark comes into focus as it grows from 80% (`ARRIVE_MARK`), the title a word at a time (`ARRIVE_WORD`, 70 ms apart, each rising and sharpening in 900 ms), then the sentence and "Mulai" (`ARRIVE_SCENE`). **Steps** change in a view transition (`changeScene`) that carries the mark (850 ms `--ease-scene`) while the step before drifts out of focus in 420 ms. **Connect:** Edunex and SIX either side of the app, their logos level with its mark (a slow sign-in's hint hangs below, never lifting a tile); a system that connects gets its check (growing in), its line rises in, and its dashed link to the app draws solid. One big button: "Hubungkan Edunex" first (SIX usually comes along on the same sign-in), then whichever system is still apart, with a quiet glass "Lanjut" beside it once one is in; before anything is in, SIX's own logo connects SIX first. **Reading:** the Student's own Beranda, the app itself scaled down in a window and out of reach (`inert`), coming into focus as the read comes in (`firstRead`: blur to sharp); the counts tick up in whole numbers (`AnimatedNumber`); a line names the part still coming (held at least 700 ms, for the eye only). "Buka Edunex Plus" (once Beranda is ready, or after 20 s) grows the window to the app's size (1050 ms) and the app is then just there; the first-run scan waits for it. **Sound:** calm, synthesised cues on the moments that matter (a swell as the light blooms, a tap on each button, a note per part read, a chord when Beranda is ready), sines through a lowpass and a little room, quiet; the speaker button turns it off. The scan's lines arrive one after another (`ARRIVE`, 400 ms, rising 8 px and into focus, 60 ms apart), 100 ms into the dialog's own opening. With Reduce motion the light holds still and everything is there at once: no credit, no scene change, and "Buka Edunex Plus" opens the app at once |
| Loading placeholders | 1.4 s pulse in four held steps, not every frame |

**Rules.**
- Only transform and opacity move, except a few small, isolated heights (a
  disclosure, a leaving row, a toast's gap), as T3 Code's `AnimatedHeight`:
  one element each, clipped only while it moves.
- Things leave the way they came, a little quicker, and never grow from
  nothing: 98%, not 0.
- Screens and rows never animate in; a row moves only when the Student's own
  action removes it. The first run is the exception (above):
  `test/app/ui-rules.test.ts` keeps its arrival classes in
  `ui/motion/arrival.ts` (and the welcome screen's answers, `animate-line-in`
  and `animate-grow-in`, in `welcome.tsx`), and `arrival.ts`, `scene.ts` and
  `ascii-light.ts` to the first run.
- No decoration: no glow, spotlight, tilt or parallax, and nothing loops except
  loading placeholders, spinners and live dots. The welcome screen is the one
  exception: its light (`ascii-light.ts`) glows and moves, there alone. The
  guide's dimming around the part it explains (`.guide-lit`) isn't decoration:
  it points, still, in the scrim's own color. A loop (`data-loop`, with
  `ref={pauseUnseen}` from `ui/motion/visible.ts`) rests while it is
  off-screen or the window is hidden.
- Scene changes (a view transition, `changeScene` in `ui/motion/scene.ts`) are
  the first run's alone: from its promise to connecting, and to reading.
- Sound is the first run's alone (`shell/welcome-sound.ts`), and can be
  turned off there.
- No animation library. JS animation only through the kit's
  `src/app/ui/motion/` pieces and the toasts, with `element.animate` (via
  `animate()` and `leave()` in `ui/motion/animate.ts`); a number counting is
  the one thing drawn frame by frame. Everything else is CSS. A piece stops
  what it started when it goes, so nothing keeps running on a removed
  element.
- Motion has the frames to itself: heavy work waits until it has stopped. The
  file viewers read their file while the panel opens, but lay it out and draw
  it once the panel has landed (`settled` in `ui/motion/animate.ts`), and the
  first PDF brings pdf.js in before its panel opens.
- **Reduced motion**, turned on in the OS: every CSS animation and transition
  is cut to an instant; the CSS rule doesn't reach `element.animate`, so the
  kit asks the same setting before each JS animation and jumps to the end
  instead (nothing fades or counts either); live dots stop pulsing, and
  spinners turn slowly instead of freezing mid-turn.
- **Tests**: the harness calls `skipAnimations(true)`, so whatever leaves is
  gone when the test looks (jsdom has no `element.animate` anyway). A test
  that watches an animation uses `test/app/fake-animations.ts` and ends it
  when it chooses, never by waiting.

## Icons

Phosphor (`src/app/ui/icons.tsx`; MIT), each icon imported on its own so only
the ones in use ship. Regular weight by default; bold where a small icon has
to read clearly or stand out (chips, notices, a moved class); fill for the
place the Student is in (the sidebar's current screen). Sizes: 12 to 14 px in
chips and meta lines, 16 px in rows and buttons, 18 px in the top bar. Icons
are decorative; the control around them carries the name.

## Window chrome

- **macOS**: hidden title bar; the traffic lights sit in the sidebar at
  16, 18, with the app's icon and name under them. The top of the sidebar
  and the top bar drag the window; controls inside them don't.
- **Windows and Linux**: no system title bar either; the system draws only
  its minimise, maximise and close buttons over the right end of the top bar,
  as tall as it (`--title-bar`), their symbols in the theme's text colour. The
  top bar keeps that corner free (`--window-controls`, from the Window
  Controls Overlay), and the sidebar's top the left corner, where some Linux
  desktops put them (`--window-controls-start`). The top of the sidebar and the top bar drag the window
  (double-click maximises); controls inside them don't. Dialog scrims and
  popovers never drag, so a click on them is theirs. Panels that reach the top
  of the window (the PDF viewer) start below the top bar. The sign-in windows
  keep the system's own title bar.
- **Tray**: macOS's menu bar takes a one-colour template glyph; Windows and
  Linux show the colour app icon, drawn at each size (`scripts/make-icons.mjs`).
  Its menu answers "what do I need to know now" without the window, the same
  on all three (`src/desktop/tray-menu.ts`): the data status (or what's wrong,
  opening the window on its fix), the class on now or next with "Tandai Hadir"
  and the Presence to fill in, the first four of Beranda's "Perlu perhatianmu"
  with "Hari ini"'s deadlines in, new notifications, then the actions and Quit.
  Beranda's own words and reasoning, never "in 5 minutes" (a menu left open
  doesn't tick), each line one short fact cut with "…", no emoji.
- The window opens only once the page has drawn the saved data, on a
  background matching the theme, so there is no white flash.
- Closing the window on macOS keeps the app running (Dock); elsewhere it
  quits, until the tray arrives with alerts.

## Layout parts and components

Screens are composed, not styled one by one:

| Part | Use |
|---|---|
| `Page` | Every screen's frame: width and padding (narrower sides under 52rem). |
| `PageHeader` | Eyebrow (the date, a course code), title, one description line, actions on the right; under the title when they don't fit beside it, where they wrap. |
| `Section` | A titled part of a screen with an optional count, description and a link-like action. |
| `List` + `Row` | Rows on one card divided by hairlines. `Row`: leading indicator, title, one meta line, trailing state or action. A clickable row is one button: the whole row is the target, a chevron appears on hover. `actions` (such as "Ingatkan nanti") sit beside that button where the chevron would be, never inside it: always shown, a faint icon until the row is hovered or focused, so nobody has to hunt for it. |
| `Meta` | Facts on one line, quietly separated ("11:00–12:59 · TVST C"); empty parts drop out and text holding " · " splits into facts. The only place a "·" between facts is drawn: no line ever starts or ends with one (`align="end"` for a right-aligned column, `truncate` for one line, whole on hover). Labels and tooltips join facts with `factsLabel()`; a test fails on a "·" written by hand. |
| `NowCard`, `NowZone`, `NowLine` (`ui/now-card.tsx`) | What's on now or next, the same on Beranda and a course page: a time block on the left (never a colored stripe; the course's color is its dot), what it is, one line of facts, the one thing to do (under them when they'd be narrower than 18rem beside it), and zones under it split by hairlines. Raised while it matters now (a class on, a Presence window open), plain otherwise; a course page says what's next in one quiet line instead, and a Presence window still open from an earlier class in one of its own under the card. |
| `Notice` | Something to know right here (info, warning, danger, success, neutral) with the one thing to do, and optionally a quiet "Ingatkan nanti" (`snooze`) after it; the action goes under the words when they'd be narrower than 16rem beside it. |
| `StatRow` + `Stat` | Figures read at a glance (SKS, an IP, absences left), side by side with no box, split by hairlines; labels, figures and hints each line up across the row, stacking only in a container under 320 px. Figures in `text-figure`, or `size="heading"` for a few small counts beside other content. Never a figure the page's answer just said. |
| `Card` | `plain`, `raised` (what matters most now), `sunken` (quiet areas). |
| `EmptyState` | What would be here, why it is empty, and the way forward. Small and kind; hide empty groups instead where nothing is lost. |
| `Button` | `primary` (one per view: the main action), `secondary`, `ghost`, `danger` (destructive only, never for a final but safe action like handing in). Blue means it can be pressed now: a primary that can't run yet goes grey (`--edge`, its words `--faint`), never a faded blue, which reads as either. A sign-in button is blue wherever it shows, the welcome screen's "Hubungkan" for both systems included (an outlined one there read as switched off); busy it dims behind its spinner, and done, "Terhubung" takes its place. Shows a spinner while working, and takes no second press then; it stays focused (`aria-disabled`, not `disabled`, which would drop a keyboard user's focus on the page). So does a stepper's − or + at its limit. |
| `IconButton` | Square, always with a name and a tooltip. |
| `Popover` | A panel from a control (alerts, data status); Escape and a click outside close it. Never bigger than the room the window leaves it: it scrolls inside instead. Opened from state (a sidebar row whose click opens its course), it hangs from `anchor` on any `side`. |
| `Dialog`, `ConfirmDialog` | Focus stays inside; Escape closes; only the body scrolls, never the box, so the title bar stays put whatever is scrolled into view; both leave the way they came, taking no second click while they go (other dialog shells reuse `SCRIM_CLASS`, `PANEL_MOTION_CLASS` and `onClickCapture={ignoreClosingClick}`). Confirm only before what can't be undone: it is an alert dialog, so a click beside it isn't an answer and Cancel has focus first. A page one level down (Settings' open-source licences) swaps in at once with a back button naming where it goes (`back`), keeps the dialog at its full height (so a search on it stays put while its results change), starts at its own top, and going back puts focus on the button that opened it. |
| `toast(text, tone, action?)` | Neutral, success or danger; with an action ("Urungkan", "Lihat") it stays 8 s; an error (`danger`) stays until the Student closes it, with its own close button. It waits while the pointer is on it or focus is in it, then goes on with the time it had left. When it goes (Urungkan pressed from the keyboard), focus goes back where it came from, never to the page. Never the only place an error is said. |
| The guide (`Guide`, `shell/guide.tsx`) | "Panduan": after a new Student's first sign-in, once the app has opened, a tour of the window page by page and part by part. It offers itself from the app's mark ("Kenalan dulu dengan Edunex Plus", "Mulai panduan" or "Lewati panduan"). Then, in the sidebar's order, it opens each place (Beranda, Tugas & Ujian, Jadwal, Presensi, Nilai, Rencana studi, and the term's first course with a PDF or file, at the module holding it) and lights its parts one at a time (Beranda's class now, Hari ini, Perlu perhatianmu, Yang berubah and courses; a Task group; the week's grid; a course's attendance row; Nilai's chart and this semester; the study plan; a course's tabs and modules), ending back on Beranda with the menus and tools (the sidebar's menu, search, the bell, the data status, Settings). Each step dims the window with the dialogs' scrim except its part, which is ringed in the focus color (`.guide-lit`), and its card hangs beside the part over the dimmed window (just inside the part's bottom corner when the part is too tall for it above or below). A card has the tour's progress, the place's name and "2 dari 5", a title, what the part is for and how to use it in one or two sentences, then "Lewati panduan" on the left and Kembali and Lanjut (Selesai on the last) on the right. A part its page doesn't show right now (no class today, Nilai without SIX) is passed over, and the counts leave it out. While it runs the window waits: clicks on it, ⌘1–6, ⌘[ and the mouse's back button do nothing, focus stays in the card (each card grows in from its part with focus on its main button), and Escape leaves. A dialog opened over it (⌘K, ⌘,) puts it aside until it closes. Going elsewhere anyway (a search result or a notification opened over it, even for the same page) ends it there, and so does a place that never opens: the window is never left dimmed with no card, and Escape works before a card is up too. Started from Settings, a PDF open over the window closes first (asking about filling not saved). A part redrawn as data comes in is lit again; one gone from its page is passed over. Back stops at the first part shown. The ring stays whole inside the window and under the top bar, and follows its part as the page around it changes. Skipped from the offer, a toast says where it lives (Settings › Tentang, which starts it at its first part). Ended, it's remembered, focus goes to the screen's title, and the first-run scan, which waits for it, can open. A Student who used the app before it isn't offered it. |
| The report question (`ReportAskCard`, `shell/report-ask.tsx`) | The one card that asks rather than tells, in the window's corner over the page and under any dialog (`--z-float`), only while the app has the maintainer's report relay: once, the first time a page can't be read, whether reports like it go by themselves (three plain choices and a way to see what goes; closed, that's "ask each time"); then, in that mode, each new problem with a way to see its report. A report that went by itself says so there, with a box for the Student's story. It never sends anything itself and never comes back for the same problem within a week. |
| `StatusChip` | A Task's true status: each its own color, glyph and word. Shown only where the status says something (not "Belum dikerjakan" on every to-do row). |
| The date column (`DueWhen`, `TaskDate`; `SittingWhen` in `screens/exam.tsx`) | Tugas & Ujian's one edge for "when", 136 px on the right of every row. A countdown means a deadline ("Sab, 24 Okt, 23:59" over "dalam 2 hari"): amber within a day, red only once late. A time range means a sitting, be there ("Min, 25 Okt" over "19:00–20:30"): amber within a day, green "Sekarang" over "sampai 20:30" while it's on. The second line goes when it only says the day again ("Besok"). |
| The period line (`PeriodRow`) | An exam period whose exams have no day yet: one quiet disclosure row where the period falls in the list, its mark the ITB calendar's own tint (`--source-itb-bg` / `--source-itb-fg`), never counted. Closed while it's far off, open within two weeks, on top of the list while it's on. Each exam under it opens its page. |
| `Tag` | A word marking one row as the exception ("Baru", "Hadir", "UTS"): `sm` 18 px or `md` 22 px, in a tone (neutral, info, warning, success, danger). Never on every row. |
| `SourceLogo`, `AppMark` (`ui/brand.tsx`) | The real Edunex and SIX logos where the app stands for one of them (connecting, the data status, the accounts in Settings); Edunex Plus's own icon (`assets/icon.png`) in the sidebar, on the welcome screen and in Settings. |
| `Badge` | Sidebar counts: neutral = how many; amber = something needs the Student today, with a small warning mark and "Perlu perhatianmu" in the place's name, so color isn't the only signal. |
| `Skeleton` | Placeholders in the shape of what's coming; never a blank area or a lone spinner. |
| `Menu` (`ui/menu.tsx`) | A "⋯" button for a screen's rare actions; an item that can't run stays, dimmed, with the reason under it. A `trigger` makes it quiet, for a row's or a notice's own small menu: a small "⋯", or another icon where the menu is one kind of action, with its words where there's room. |
| `SnoozeMenu` (`app/snooze-menu.tsx`) | "Ingatkan nanti" on a row or notice: the moments that fit the item, each with until when; then a toast saying when it's back, with Urungkan. A row or notice that leaves hands keyboard focus on (the next row, what follows the notice), never to the page. What's put off is listed quietly ("2 ditunda · Tampilkan") where it was (a deadline put off from Beranda's "Hari ini", with "Perlu perhatianmu"'s; a late Task in Tugas & Ujian under Terlambat, which stays as a heading while all its rows are put off), and in Settings. In Tugas & Ujian only the late rows have it, and a Task put off there is put off on Beranda too: one snooze per Task. |
| `DoneButton`, `rowControls` (`app/snooze-menu.tsx`) | The ✓ beside the alarm, only on a row whose "done" only the Student can know (a change checked, a class's warning seen, a group hand-in, a payment SIX hasn't shown): named for its item ("Sudah kucek: Tugas 01 Bab I · II4091"), one click puts it away for good, then a toast saying what brings it back, with Urungkan. On a notice it carries its words. The ✓ and the alarm keep fixed columns: a row with one of them leaves the other's 28px empty, so a list scans straight; a row with neither keeps its chevron. Where a row has the ✓, its alarm doesn't offer "Sampai ada perubahan": the ✓ says it better. What's handled is listed beside what's put off ("1 ditunda · 2 sudah beres · Tampilkan"), each with "Tampilkan lagi". With only handled things left, "Perlu perhatianmu" says so in green ("Semua sudah beres untuk sekarang"), never "nothing due": a group Task marked done may still be due. |
| A lecturer's edit (`EditNotice`, `History` in `screens/tasks.tsx`) | Said quietly where it first reaches the Student: the notification, the bell and Beranda's row say the lecturer changed the Task and how many things changed, or name the one date that moved ("Tenggat diundur ke Sen, 12 Okt, 23:59"). The Task page's notice is one line with "Lihat perubahannya" and "Sudah kucek"; the instructions on the page stay clean, with no marks in them. History tells the story: each edit is its own step ("Diubah dosen", its date) that opens to list its changes in plain words, one per line ("Tenggat: Jum, 9 Okt, 23:59 → Sen, 12 Okt, 23:59", the arrow read out as "dari … menjadi …"). "Lihat perubahannya" opens the newest step and moves focus there, scrolling to it where History sits under the page (no smooth scroll with Reduce motion). The instructions open from their step in a panel, now and before, each whole, side by side where there's room: no marks inside sentences, only a quiet edge on a paragraph that's new or changed (`border-info-fg/60`), said to screen readers. |
| `LineChart` (`ui/chart.tsx`) | The one chart spec: a clean value range with hairline gridlines, estimates dashed, a labelled target line, a direct end label, a tooltip per column, a table for screen readers. |
| `AbsenceBar`, `CountdownBar` (`ui/meter.tsx`) | Status-colored meters. `AbsenceBar`: "Jatah absen", one short segment per absence the course's target allows this term, filled from the start as they're used (neutral, amber once full), ringed while left; past the limit it stays amber up to a short limit line, and each miss after the line is a red segment. It keeps its width (from 12 segments, one fill); it never stands alone: `AbsenceBudget` (`app/attendance-parts.tsx`) draws it with its label and its words ("Terpakai 1× · sisa 1×", "Terpakai 4× · lewat batas 1×", the last part bold in the bar's tone), on a Presensi row, the course page's header and Beranda's course cards. SIX's count says its percent once beside it, labeled, "so far": on a Presensi row and the course page's header ("Kehadiran 73% sejauh ini (11 dari 15)"), and short in Beranda's next class ("Kehadiran 85% · Sisa jatah absen 1×"). A Presensi row: the course and its next class on the left; on the right, in one width so it lines up down the list, two labeled lines, "Kehadiran" and its share over "Jatah absen" with the bar and its words; its one exception on a line of its own under both, on one line where it fits, its actions blue links at the row's end. Red there is only for what's lost (the miss past the limit, its words); the way back is calm. `CountdownBar`: time left in a window, shrinking, amber in its last 15 minutes, its words under the bar when there's no room beside it. |
| `Stepper` (`ui/controls.tsx`) | A number stepped between bounds (an attendance target, 50–100% by 5): − and + with names, the value read out when it changes. |
| `Segmented`, `useRadioKeys` (`ui/controls.tsx`) | A few choices, one picked (the theme, Minggu/Bulan, the IPK target): a radio group whose highlight glides to the pick. Arrow keys move the choice; only the picked one is a Tab stop (the first while none is). An option takes a longer `name` where its label is too short to read alone ("Target IPK 3,50"). Other radio groups of the screen's own buttons (filter chips) get the same keys from `useRadioKeys`. |
| `TabBar` (`ui/tabs.tsx`) | The tabs of a screen or dialog, inside the screen's own `Tabs.Root` with its panels in `Tabs.Content`, so each tab names its panel: names, an optional quiet count, one underline that glides to the picked tab. The panel swaps at once. A screen's tabs (a course, Rencana studi) each sit in their own crash guard, and the tab picked is in the screen's route, so Back comes back to it. `sm` inside a dialog. Tabs that don't fit scroll sideways in their own frame, each name on one line, the picked one kept in sight. |
| `TimeGrid`, `GridBlock` (`ui/time-grid.tsx`) | A week as a time grid: height is duration, shared time side by side, empty days narrow, periods tinted and named, a now line (blue, as today's date). A busy day keeps room for its blocks' time and code (6.25rem, 7rem a block in a clash); where the window can't fit them, the grid scrolls sideways in its own frame. A block that has ended is quieter in token greys on `bg-sunken`, never faded with opacity. |
| `RichEditor` (`ui/rich-editor.tsx`) | A box for writing formatted text (a Task's answer): bold, italic, lists, a link, a quote, undo and redo; pasting keeps only simple formatting. Loaded lazily with the screen that uses it (TipTap underneath); it holds only what Edunex's own editor writes, never pictures, tables or embeds. |
| `RichText`, `WebLink` (`ui/rich-text.tsx`) | What a lecturer wrote (notes, Task instructions), rebuilt safely from its HTML as Edunex shows it: formatting, lists, tables, figures; a link says where it goes on hover and focus and opens in the browser; pictures from Edunex's storage come in through the app (`LecturerHtml`, `RemoteImage`), with a placeholder while loading and the reason when one can't show. A long note folds with "Tampilkan semua". |
| `PdfViewer` (`ui/pdf-viewer.tsx`), `usePdfViewer()` (`pdf.tsx`) | A PDF read in the app, over the current screen: pages one under another, white in both themes, sharp at any zoom; "3 dari 12" with a box to jump; − / + and fit width or the whole page (slides open whole); the keyboard (arrows, PgUp/PgDn, Space, Home/End, ⌘+ ⌘− ⌘0, Esc); selectable text, which can be highlighted; Download in the toolbar; when it can't show, why, with Download, Open in Edunex and Try again. |
| `FileViewer` (`ui/file-viewer.tsx`), opened by `usePdfViewer()` too | Any other file the app can read, in the same panel: a Word document (.docx) as its pages, white in both themes; a workbook (.xlsx) or CSV as a table with column letters and row numbers, a tab per sheet; PowerPoint slides (.pptx, .ppsx) as pages at the slide's shape, white in both themes; text and code as they are (a Word document's text and a text file's can be highlighted); a picture whole. Download in the toolbar; when it can't show, why, with Download, Open in Edunex and Try again. Old .doc/.xls/.ppt, archives and videos download and open in the computer's own app. |
| Highlights (`ui/highlights.tsx`, `app/highlights.ts`) | Text selected in a PDF, a Word document or a text file gets a small bar over it (under it at the top of the view): the highlighter icon, then a color each, yellow first. ⌘⇧H (Ctrl+Shift+H) highlights the selection in the color picked last, and the tooltip of that color says so. The selection goes and the highlight shows where it was. The pointer is a hand over a highlight, and a click opens its bar: its colors, the one it is checked, then "Hapus" beside its bin. The bar never takes the selection or the keyboard from the page. Each highlight is a stop for the keyboard, named by its color and words: Enter opens its bar on its color, Delete (⌫) removes it. An eraser in the viewer's toolbar ("Hapus semua sorotan") removes them all. It's always there, so the Student finds it, dimmed while the file has none, and its tooltip then says why. Removing one or all says so in a toast with Urungkan, and ⌘Z anywhere in the viewer (its toolbar too) puts them back, since a toast over the viewer can't be reached with Tab. Escape closes the bar before the viewer. What happened is said to screen readers in the viewer's own live region. Kept on this computer by the file's content, each where its text is (a PDF's page and the characters on it), so it comes back at any zoom. |
| Page notes (`ui/page-notes.tsx`, `app/highlights.ts`) | "Catatanku" in a viewer's toolbar (pressed while open) opens a panel beside the file, titled "Catatan halaman 3", with a box for the note on the page being read. It follows the pages as they scroll. A Word document or text file has one note for the whole file ("Catatan berkas ini"). The note saves itself a moment after typing stops and when the box is left, and a quiet "Tersimpan" with a check shows for two seconds, then fades. It also saves, without a word, when the page changes. That notes stay on this computer is said once, in the empty note's placeholder, never as a standing caption. Screen readers get both facts in the box's description. Emptied, the note goes. "Hapus" with its bin sits at the right under the box, in a row that keeps its height so nothing below it moves, and removes the note with Urungkan in the toast. Below, "Catatan di halaman lain" lists the file's other notes by their first line, lined up with the box, each a way to its page. A PDF page with a note has a small sticky note on its top edge, in highlighter yellow, with its first line in the tooltip, and it opens the panel there. Opening the panel puts the keyboard in the note. Escape gives it back to the pages, and the next one closes the viewer. ⌘Z in the note undoes typing. The panel stays open or shut from one file to the next while the app runs. Kept with the file's highlights but apart from them. The eraser leaves the notes, and a note's Hapus leaves the highlights. |
| `AnimatedNumber` (`ui/motion/`) | A figure the Student just changed counts to its new value, in the app's number format; screen readers and copies only ever get the true value. |
| `SlidingHighlight` (`ui/motion/`) | The highlight of a segmented control or tab list, gliding to the new pick. The group keeps its own buttons; items carry `data-highlight`. A rounded fill stretches a little while it glides between items of different widths. |
| `DisclosurePanel`, `disclosureTrigger` (`ui/motion/`) | A panel opening smoothly under the screen's own button, which says what it controls. |
| `ARRIVE`, `ARRIVE_WORD`, `ARRIVE_SCENE`, `arriveAt` (`ui/motion/arrival.ts`) | The first run's parts arriving one after another, a title a word at a time. The first run only. |
| `changeScene` (`ui/motion/scene.ts`) | The first run's scene changes, as view transitions that carry the app's mark (`CARRIED`, by `view-transition-name`) from one step to the next. The first run only. |
| `createAsciiLight`, `lightAt` (`ui/motion/ascii-light.ts`) | The welcome screen's light: one canvas, from a point, eased between places. The first run only. |
| `PresenceList`, `PresenceItem` (`ui/motion/`) | Rows the Student can remove (snoozed, handed in) without the list jumping or focus getting lost. A kit `Row` is a `PresenceItem` (a plain `<li>` outside a list that opts in), so a list opts in by wrapping its rows in `PresenceList`. Built on `Presence` (`ui/motion/presence.tsx`), which keeps a leaving child on screen until it has played its way out; the toasts use it too. |

The shell: a sidebar (the app's icon and name, ⌘1–⌘6, courses with their dot, the Student's name
opening Settings), a top bar (back button naming where it goes, ⌘K search,
the alerts bell, the data-status control) and the problem banner under it.
After a new Student's first sign-in, the guide offers a tour of all of it, page by page.
Zoomed in until the window is under 52rem wide (from 120% on the smallest
window; never at 100%), the sidebar folds to a rail of icons, course dots
(each with its code under it, in micro type) and counts that scrolls: the
words stay as the controls' names and in their tooltips. The data status gives up its words, down to its mark, before
anything runs past the window. Every screen sits in its own crash guard.

## Copy

- **Action first, one fact per line.** "Kumpulkan Tugas 02 · Jum 16 Okt
  15:00–23:59", not a sentence that ends with the instruction.
- **Say what happened and what to do**, in that order: "Sesi SIX berakhir.
  Data terakhir tetap bisa dibaca." + **Masuk lagi**.
- **An error says how to recover**, picked by what went wrong (no
  connection, session ended, Edunex answered oddly; `errorKey` in
  `src/app/bridge.ts`), never the engine's own message: "Kalender tidak bisa
  disimpan. Coba lagi, atau simpan ke folder lain." A confirm before what
  can't be undone names what's lost and says so; its button is a verb and
  its object ("Putuskan semua HP", "Atur ulang rencana"), never a bare "Buang".
- **Positive and honest framing**: "Sisa jatah absen 2×", "IPK
  tertinggi yang masih mungkin: 3,45". Never three "tak tercapai" in a row.
- **One percent at a time, labeled.** Never two shares side by side without
  words ("At best 73%" over "33%"): "Kehadiran 85% sejauh ini (6 dari 7)",
  "Kalaupun hadir di semua sisa pertemuan, kehadiranmu berakhir di 73%".
- **No system words**: no "snapshot", "salinan materi", "kelas induk",
  "data source". The Student's words: kuliah, pertemuan, tugas, presensi.
- **Human times**: "Besok, 23:59 · dalam 6 jam", "Diperbarui 5 menit yang
  lalu", never a raw timestamp; one date format per context. Times are in
  the computer's time zone.
- **Voice**: Indonesian uses *kamu* and plain, friendly words; English is
  plain and short. Sentence case for titles and buttons. A button says what
  it does ("Keluar dari SIX", not "Keluar").
- **Plain punctuation.** Full stops, not semicolons. A colon only for a label,
  a time or a list, never to set up a point. No em dash, and "-" for an empty
  value. ` · ` between the facts of a meta line. `npm run lint` fails on an em
  dash under `src/` or a semicolon in the catalog.
- **Every string comes from the catalog**, in both languages, with plural
  forms for English counts.

Writing or reviewing a string: the `copywriting` skill
([.agents/skills/copywriting/SKILL.md](../.agents/skills/copywriting/SKILL.md))
has the length budget per element, the AI tells to cut and before/after examples.

### Glossary

Academic terms keep ITB's own words. SKS, IP, IPK, KRS, UKT, UTS, UAS, DRS and
URS stay as they are in both languages.

| Bahasa Indonesia | English | Notes |
|---|---|---|
| Beranda | Home | |
| Mata kuliah | Course | |
| Kelas | Class | A course's section, e.g. "Kelas 01" |
| Modul | Module | Edunex's course outline |
| Materi | Material | |
| Tugas | Task | Edunex's assignments |
| Ujian | Exam | UTS (midterm) and UAS (final) stay as they are |
| Presensi | Presence | Edunex's attendance session |
| Kehadiran | Attendance | The count, from SIX |
| Pertemuan | Meeting | One class session |
| Jadwal | Schedule | |
| Nilai | Grades | |
| Rencana studi | Study plan | |
| Pengumuman | Announcement | |
| Dosen / Dosen wali | Lecturer / Academic advisor | |
| Tenggat | Deadline | |
| Draf / Terkumpul | Draft / Submitted | |
| Semester pendek | Short semester | |
| Kalender ITB | ITB calendar | |
| Kuesioner | Questionnaire | |
| Sorotan | Highlight | Text the Student marked in a file read in the app |
| Catatanku, Catatan halaman | My notes, Note on page | The Student's own note on a page. A bare "Catatan" is a lecturer's on Edunex |

## Accessibility

- Text contrast meets WCAG AA in both themes, checked by a test.
- Keyboard: every control is reachable with Tab, shows a visible focus ring
  (drawn inside a row whose list clips its edges, `focus-visible:-outline-offset-2`),
  and works with Enter or Space; segmented controls use the arrow keys;
  dialogs trap focus and close on Escape. ⌘, opens Settings and ⌘R refreshes
  (Ctrl on Windows and Linux).
- A new screen opened from inside the last one (a row, Back) puts focus on
  its title, so the keyboard and a screen reader carry on from its top; a
  screen picked in the sidebar leaves focus there. A jump within a screen (a
  study-plan rule) moves focus with it.
- Back comes back to a screen as the Student left it: the same tab, module,
  "Selesai" or semester open, scrolled where it was (`nav.tsx`: `replace` for
  what the screen's route says, `usePlaceState` for the rest). Picking a tab or
  a module adds no step to Back and leaves the page where it is; a new visit
  starts from the screen's default, at its top. The sidebar and ⌘1–6, on the
  place already open, keep it as it is.
- Reduced motion is respected everywhere, a scroll the app starts included.
- The problem banner arrives in a live region that is always there, so it is
  read out; it wraps rather than cuts its text.
- Status is never color alone; icons are hidden from screen readers and
  controls carry names.
