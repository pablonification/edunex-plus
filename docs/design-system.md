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
   (Beranda: what do I do now; Presensi: am I OK, and what do I do; Nilai:
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
   only mark identity, on a dot or a stripe, never a bar or a word.
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
   quick and quiet; nothing moves for decoration.

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

**Meters (fill on track).** A meter's fill reads 3:1 on its own track. Amber
and green have meter colors of their own: the tones' `-fg` colors are for
text, and amber text is brown. Red uses `--danger-fg`, blue `--accent`.

| Token | Light | Dark |
|---|---|---|
| `--meter-track` | `#ececef` | `#2c2c30` |
| `--meter-warning` | `#b26b00` | `#f2c862` |
| `--meter-success` | `#1e8f4f` | `#2fbf6c` (`--live`) |

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

**Sources.** Edunex and SIX show their own logos (`SourceLogo`), never a
letter in a colored square. The ITB calendar has no logo here: a calendar in
its own colors (background / text) stands for it, and tints exam periods.

| Token | Light | Dark |
|---|---|---|
| `--source-itb-bg` | `#f3ecfd` | `#271d3a` |
| `--source-itb-fg` | `#6338b8` | `#c4b0f5` |

**Course colors.** Each course has an identity color for its dot and stripe:
`#3366F0 #7C5CFC #0FA3B1 #D6409F #64748B #9D4EDD #0284C7 #8D6E63`. The
palette leaves out the hues status speaks in (red, amber, orange, green), so a
course never looks "in danger" because of its color. The color comes from the
course code (`src/core/course-colors.ts`), so it stays the same across
launches, and courses of one term don't share one. Course colors mark
identity only: never a bar's fill, a status, or text.

**Status colors.** Red (`danger`): lost, overdue, failed, can't reach the
target, destructive. Amber (`warning`): needs the Student soon (no absences
left, due within a day, a session ended). Green (`success`, `live`): done,
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

## Space, shape, depth

- **Spacing** on a 4 px grid. One page container for every screen
  (`Page`): 40 px side padding, 1040 px wide (Jadwal goes wider), the same
  left edge everywhere. Sections 40 px apart; inside a section 12 px.
  A grid that holds rows gives every column a size that can shrink
  (`grid-cols-1`, `minmax(0,…)`), at every width: a column that fits its
  content would grow to a long title with no spaces and push the page past
  the window.
- **Radius**: 5 px keys and tags (`rounded-tag`), 6–8 px buttons and inputs
  (`rounded-md`, `rounded-lg`), 12 px cards and lists (`rounded-xl`), 16 px
  raised cards and dialogs (`rounded-2xl`), full for chips and switches. No
  `rounded-[…]`.
- **Layers** for what floats over the window, lowest to highest:
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

**What moves.**

| What | How |
|---|---|
| Hover, press, color changes | Hover backgrounds: instant. Buttons press to 97% in 150 ms (not menu or popover triggers, not rows; a row's press is its darker background). Other color changes: 150 ms |
| Switching light and dark | At once: nothing fades its color (`.no-transitions` on `<html>` for two frames) |
| Screens and their rows | Nothing: switching screens or going further in is instant, and rows don't rise in |
| Dialogs (`animate-pop-in`, `animate-pop-out`; the scrim `animate-fade-in`, `animate-fade-out`) | In 200 ms from 98%, out 150 ms |
| Popovers and tooltips (`animate-popover-in`, `animate-popover-out`) | 150 ms, growing from their control (`origin-(--radix-popover-content-transform-origin)`), so the side they open on shows. A tooltip grows in only after the wait; moving on to the next control shows its tooltip at once, and a tooltip goes at once |
| Banners (`animate-slide-down`) | 200 ms from 6 px above |
| Toasts (`animate-toast-in`; leaving with the kit's `leave`) | Rise in 200 ms from 8 px below and 98%; leave by fading 150 ms, then the gap closes in 200 ms (starting 90 ms in) so the others slide into place; a leaving toast takes no clicks |
| A row the Student removes (`PresenceList`) | Fades 150 ms, then the gap closes in 200 ms (starting 90 ms in); focus moves on to the same control in the next row. Rows that join, and a change of the whole list, appear at once |
| A panel under its button (`DisclosurePanel`, a native `<details>`) | Height and opacity, 200 ms open (ease-out), 150 ms closed (ease-standard); clipped only while it moves |
| A tab's content | Swaps at once; only the tab's highlight moves |
| A segmented control's or tab list's highlight (`SlidingHighlight`) | Sits on the new pick at once and glides there from the old one as a transform (translate and scale), 150 ms ease-out |
| A figure the Student just changed (`AnimatedNumber`) | Counts 400 ms ease-out with no overshoot, while the page's text is already the true value. A figure that changes on its own just changes |
| Bars filling | 500 ms, when new data arrives. A window's time left (`CountdownBar`), which shrinks every minute, slides as a transform in 400 ms ease-out |
| Loading placeholders | 1.4 s pulse in four held steps, not every frame |

**Rules.**
- Only transform and opacity move, except a few small, isolated heights (a
  disclosure, a leaving row, a toast's gap), as T3 Code's `AnimatedHeight`:
  one element each, clipped only while it moves.
- Things leave the way they came, a little quicker, and never grow from
  nothing: 98%, not 0.
- Screens and rows never animate in; a row moves only when the Student's own
  action removes it.
- No decoration: no glow, spotlight, tilt or parallax, and nothing loops except
  loading placeholders, spinners and live dots. A loop (`data-loop`, with
  `ref={pauseUnseen}` from `ui/motion/visible.ts`) rests while it is
  off-screen or the window is hidden.
- No animation library. JS animation only through the kit's
  `src/app/ui/motion/` pieces and the toasts, with `element.animate` (via
  `animate()` and `leave()` in `ui/motion/animate.ts`); a number counting is
  the one thing drawn frame by frame. Everything else is CSS. A piece stops
  what it started when it goes, so nothing keeps running on a removed
  element.
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
- The window opens only once the page has drawn the saved data, on a
  background matching the theme, so there is no white flash.
- Closing the window on macOS keeps the app running (Dock); elsewhere it
  quits, until the tray arrives with alerts.

## Layout parts and components

Screens are composed, not styled one by one:

| Part | Use |
|---|---|
| `Page` | Every screen's frame: width and padding. |
| `PageHeader` | Eyebrow (the date, a course code), title, one description line, actions on the right. |
| `Section` | A titled part of a screen with an optional count, description and a link-like action. |
| `List` + `Row` | Rows on one card divided by hairlines. `Row`: leading indicator, title, one meta line, trailing state or action. A clickable row is one button: the whole row is the target, a chevron appears on hover. `actions` (such as "Ingatkan nanti") sit beside that button where the chevron would be, never inside it: always shown, a faint icon until the row is hovered or focused, so nobody has to hunt for it. |
| `Meta` | Facts on one line, quietly separated ("11:00–12:59 · TVST C"); empty parts drop out and text holding " · " splits into facts. The only place a "·" between facts is drawn: no line ever starts or ends with one (`align="end"` for a right-aligned column, `truncate` for one line). Labels and tooltips join facts with `factsLabel()`; a test fails on a "·" written by hand. |
| `NowCard`, `NowZone`, `NowLine` (`ui/now-card.tsx`) | What's on now or next, the same on Beranda and a course page: a time block on the left (never a colored stripe; the course's color is its dot), what it is, one line of facts, the one thing to do, and zones under it split by hairlines. Raised while it matters now (a class on, a Presence window open), plain otherwise; a course page says what's next in one quiet line instead, and a Presence window still open from an earlier class in one of its own under the card. |
| `Notice` | Something to know right here (info, warning, danger, success, neutral) with the one thing to do, and optionally a quiet "Ingatkan nanti" (`snooze`) after it. |
| `StatRow` + `Stat` | Figures read at a glance (SKS, an IP, absences left), side by side with no box, split by hairlines; labels, figures and hints each line up across the row, stacking only in a container under 320 px. Figures in `text-figure`, or `size="heading"` for a few small counts beside other content. Never a figure the page's answer just said. |
| `Card` | `plain`, `raised` (what matters most now), `sunken` (quiet areas). |
| `EmptyState` | What would be here, why it is empty, and the way forward. Small and kind; hide empty groups instead where nothing is lost. |
| `Button` | `primary` (one per view: the main action), `secondary`, `ghost`, `danger` (destructive only, never for a final but safe action like handing in). Shows a spinner while working. |
| `IconButton` | Square, always with a name and a tooltip. |
| `Popover` | A panel from a control (alerts, data status); Escape and a click outside close it. |
| `Dialog`, `ConfirmDialog` | Focus stays inside; Escape closes; both leave the way they came, taking no second click while they go (other dialog shells reuse `SCRIM_CLASS`, `PANEL_MOTION_CLASS` and `onClickCapture={ignoreClosingClick}`). Confirm only before what can't be undone: it is an alert dialog, so a click beside it isn't an answer and Cancel has focus first. A page one level down (Settings' open-source licences) swaps in at once with a back button naming where it goes (`back`), keeps the dialog at its full height (so a search on it stays put while its results change), starts at its own top, and going back puts focus on the button that opened it. |
| `toast(text, tone, action?)` | Neutral, success or danger; with an action ("Urungkan", "Lihat") it stays 8 s. It waits while the pointer is on it or focus is in it, then goes on with the time it had left. When it goes (Urungkan pressed from the keyboard), focus goes back where it came from, never to the page. Never the only place an error is said. |
| `StatusChip` | A Task's true status: each its own color, glyph and word. Shown only where the status says something (not "Belum dikerjakan" on every to-do row). |
| `Tag` | A word marking one row as the exception ("Baru", "Hadir", "UTS"): `sm` 18 px or `md` 22 px, in a tone (neutral, info, warning, success, danger). Never on every row. |
| `SourceLogo`, `AppMark` (`ui/brand.tsx`) | The real Edunex and SIX logos where the app stands for one of them (connecting, the data status, the accounts in Settings); Edunex Plus's own icon (`assets/icon.png`) in the sidebar, on the welcome screen and in Settings. |
| `Badge` | Sidebar counts: neutral = how many; amber = something needs the Student today. |
| `Skeleton` | Placeholders in the shape of what's coming; never a blank area or a lone spinner. |
| `Menu` (`ui/menu.tsx`) | A "⋯" button for a screen's rare actions; an item that can't run stays, dimmed, with the reason under it. A `trigger` makes it quiet, for a row's or a notice's own small menu: a small "⋯", or another icon where the menu is one kind of action, with its words where there's room. |
| `SnoozeMenu` (`app/snooze-menu.tsx`) | "Ingatkan nanti" on a row or notice: the moments that fit the item, each with until when; then a toast saying when it's back, with Urungkan. A row or notice that leaves hands keyboard focus on (the next row, what follows the notice), never to the page. What's put off is listed quietly ("2 ditunda · Tampilkan") where it was (a deadline put off from Beranda's "Hari ini", with "Perlu perhatianmu"'s), and in Settings. |
| `LineChart` (`ui/chart.tsx`) | The one chart spec: a clean value range with hairline gridlines, estimates dashed, a labelled target line, a direct end label, a tooltip per column, a table for screen readers. |
| `ShareMeter`, `CountdownBar` (`ui/meter.tsx`) | Status-colored meters: attendance against the course's target, a tick (the best still reachable as an optional ghost), always under a label that says what it measures; time left in a window, shrinking, amber in its last 15 minutes. |
| `Stepper` (`ui/controls.tsx`) | A number stepped between bounds (an attendance target, 50–100% by 5): − and + with names, the value read out when it changes. |
| `Segmented`, `useRadioKeys` (`ui/controls.tsx`) | A few choices, one picked (the theme, Minggu/Bulan, the IPK target): a radio group whose highlight glides to the pick. Arrow keys move the choice; only the picked one is a Tab stop (the first while none is). An option takes a longer `name` where its label is too short to read alone ("Target IPK 3,50"). Other radio groups of the screen's own buttons (filter chips) get the same keys from `useRadioKeys`. |
| `TabBar` (`ui/tabs.tsx`) | The tabs of a screen or dialog, inside the screen's own `Tabs.Root` with its panels in `Tabs.Content`, so each tab names its panel: names, an optional quiet count, one underline that glides to the picked tab. The panel swaps at once. `sm` inside a dialog. |
| `TimeGrid`, `GridBlock` (`ui/time-grid.tsx`) | A week as a time grid: height is duration, shared time side by side, empty days narrow, periods tinted and named, a now line. |
| `RichEditor` (`ui/rich-editor.tsx`) | A box for writing formatted text (a Task's answer): bold, italic, lists, a link, a quote, undo and redo; pasting keeps only simple formatting. Loaded lazily with the screen that uses it (TipTap underneath); it holds only what Edunex's own editor writes, never pictures, tables or embeds. |
| `RichText`, `WebLink` (`ui/rich-text.tsx`) | What a lecturer wrote (notes, Task instructions), rebuilt safely from its HTML as Edunex shows it: formatting, lists, tables, figures; a link says where it goes on hover and focus and opens in the browser; pictures from Edunex's storage come in through the app (`LecturerHtml`, `RemoteImage`), with a placeholder while loading and the reason when one can't show. A long note folds with "Tampilkan semua". |
| `PdfViewer` (`ui/pdf-viewer.tsx`), `usePdfViewer()` (`pdf.tsx`) | A PDF read in the app, over the current screen: pages one under another, white in both themes, sharp at any zoom; "3 dari 12" with a box to jump; − / + and fit width or the whole page (slides open whole); the keyboard (arrows, PgUp/PgDn, Space, Home/End, ⌘+ ⌘− ⌘0, Esc); selectable text; Download in the toolbar; when it can't show, why, with Download, Open in Edunex and Try again. |
| `FileViewer` (`ui/file-viewer.tsx`), opened by `usePdfViewer()` too | Any other file the app can read, in the same panel: a Word document (.docx) as its pages, white in both themes; a workbook (.xlsx) or CSV as a table with column letters and row numbers, a tab per sheet; text and code as they are; a picture whole. Download in the toolbar; when it can't show, why, with Download, Open in Edunex and Try again. Old .doc/.xls, PowerPoint, archives and videos download and open in the computer's own app. |
| `AnimatedNumber` (`ui/motion/`) | A figure the Student just changed counts to its new value, in the app's number format; screen readers and copies only ever get the true value. |
| `SlidingHighlight` (`ui/motion/`) | The highlight of a segmented control or tab list, gliding to the new pick. The group keeps its own buttons; items carry `data-highlight`. A rounded fill stretches a little while it glides between items of different widths. |
| `DisclosurePanel`, `disclosureTrigger` (`ui/motion/`) | A panel opening smoothly under the screen's own button, which says what it controls. |
| `PresenceList`, `PresenceItem` (`ui/motion/`) | Rows the Student can remove (snoozed, handed in) without the list jumping or focus getting lost. A kit `Row` is a `PresenceItem` (a plain `<li>` outside a list that opts in), so a list opts in by wrapping its rows in `PresenceList`. Built on `Presence` (`ui/motion/presence.tsx`), which keeps a leaving child on screen until it has played its way out; the toasts use it too. |

The shell: a sidebar (the app's icon and name, ⌘1–⌘6, courses with their dot, the Student's name
opening Settings), a top bar (back button naming where it goes, ⌘K search,
the alerts bell, the data-status control) and the problem banner under it.
Every screen sits in its own crash guard.

## Copy

- **Action first, one fact per line.** "Kumpulkan Tugas 02 · Jum 16 Okt
  15:00–23:59", not a sentence that ends with the instruction.
- **Say what happened and what to do**, in that order: "Sesi SIX berakhir.
  Data terakhir tetap bisa dibaca." + **Masuk lagi**.
- **Positive and honest framing**: "Masih bisa absen 2× lagi", "IPK
  tertinggi yang masih mungkin: 3,45". Never three "tak tercapai" in a row.
- **No system words**: no "snapshot", "salinan materi", "kelas induk",
  "data source". The Student's words: kuliah, pertemuan, tugas, presensi.
- **Human times**: "Besok, 23:59 · dalam 6 jam", "Diperbarui 5 menit yang
  lalu", never a raw timestamp; one date format per context. Times are in
  the computer's time zone.
- **Voice**: Indonesian uses *kamu* and plain, friendly words; English is
  plain and short. Sentence case for titles and buttons. A button says what
  it does ("Keluar dari SIX", not "Keluar").
- **Every string comes from the catalog**, in both languages, with plural
  forms for English counts.

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

## Accessibility

- Text contrast meets WCAG AA in both themes, checked by a test.
- Keyboard: every control is reachable with Tab, shows a visible focus ring,
  and works with Enter or Space; segmented controls use the arrow keys;
  dialogs trap focus and close on Escape. ⌘, opens Settings and ⌘R refreshes
  (Ctrl on Windows and Linux).
- Reduced motion is respected everywhere.
- Status is never color alone; icons are hidden from screen readers and
  controls carry names.
