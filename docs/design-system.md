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
8. **Motion explains change.** Screens arrive softly, rows rise in, numbers
   that change get noticed, panels slide from where they open. Nothing moves
   for decoration.

## Foundation

- React 19 and Tailwind CSS v4. Tokens are CSS variables; Tailwind utilities
  read them (`bg-surface`, `text-muted`, `bg-(--status-draft-bg)`).
- Accessible headless primitives from Radix (dialog, switch, tooltip; tabs and
  menus as screens need them), styled in a small shadcn-style kit in
  `src/app/ui/`. Class names merge with `cx()` so a later class wins.
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
(`test/app/contrast.test.ts`): 4.5:1 or more for text, 3:1 for the focus ring.

**Surfaces**

| Token | Light | Dark |
|---|---|---|
| `--canvas` | `#ffffff` | `#161618` |
| `--sidebar` | `#f7f7f8` | `#1b1b1e` |
| `--surface` | `#ffffff` | `#1c1c1f` |
| `--raised` | `#ffffff` | `#1f1f23` |
| `--welcome` | `#f5f5f7` | `#121214` |
| `--edge` | `#e6e6ea` | `#2a2a2f` |
| `--line` | `#ececef` | `#26262b` |
| `--fill` | `#f4f4f6` | `#232327` |
| `--hover` | `#f1f1f4` | `#222226` |
| `--selected` | `rgb(0 0 0 / 0.06)` | `rgb(255 255 255 / 0.08)` |
| `--scrim` | `rgb(0 0 0 / 0.25)` | `rgb(0 0 0 / 0.45)` |
| `--track` | `#d4d4da` | `#3a3a40` |
| `--segment` | `#ffffff` | `#34343a` |

**Text and accent**

| Token | Light | Dark |
|---|---|---|
| `--fg` | `#1d1d1f` | `#ececef` |
| `--muted` | `#5b5b61` | `#a8a8b0` |
| `--faint` | `#6f6f75` | `#8c8c93` |
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
meters take their color from status, never from the course.

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
| `text-heading` | 20 / 26 | Big answers inside a card |
| `text-display` | 28 / 34 | Page titles (semibold, −0.02em) |

## Space, shape, depth

- **Spacing** on a 4 px grid. One page container for every screen
  (`Page`): 40 px side padding, 1040 px wide (Jadwal goes wider), the same
  left edge everywhere. Sections 40 px apart; inside a section 12 px.
- **Radius**: 5 px keys and tags, 6–8 px buttons and inputs, 12 px cards and
  lists, 16 px raised cards and dialogs, full for chips and switches.
- **Depth**: one surface level per region; no card inside a card. Lists and
  cards sit on the page with a 1 px edge and a faint shadow (`shadow-card`);
  the one thing that matters most right now is raised (`shadow-raised`);
  quiet areas inside are sunken (`bg-sunken`). Floating things cast real
  shadows: `shadow-pop` (tooltips, toasts, popovers), `shadow-dialog`.

## Motion

Quick and purposeful: it shows where something came from, or what changed.

| What | Duration | Easing |
|---|---|---|
| Hover, press, color changes | 150 ms | ease |
| A screen opening (`animate-enter`, done by the shell) | 280 ms | `ease-out` (0.16, 1, 0.3, 1) |
| List rows arriving (`stagger` with `--i`, first 10 rows) | 360 ms, 28 ms apart | `ease-out` |
| Popovers, banners (`animate-slide-down`), dialogs and toasts (`animate-pop-in`) | 180–220 ms | `ease-standard` / `ease-out` |
| Bars filling, numbers changing | 300–500 ms | ease |
| Loading placeholders | 1.4 s pulse | ease-in-out |

Rows stagger only when a list first appears, never on every update. With
reduced motion turned on in the OS, every animation and transition is cut to
an instant and live dots stop pulsing.

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
- **Windows and Linux**: the standard system frame and title bar; the app's
  menu bar shows on Alt.
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
| `List` + `Row` | Rows on one card divided by hairlines. `Row`: leading indicator, title, one meta line, trailing state or action. A clickable row is one button: the whole row is the target, a chevron appears on hover. `actions` (such as "Ingatkan nanti") sit beside that button where the chevron would be, never inside it: shown on hover and keyboard focus, always without hover (touch). |
| `Meta` | Facts on one line, quietly separated ("11:00–12:59 · TVST C"); empty parts drop out and text holding " · " splits into facts. The only place a "·" between facts is drawn: no line ever starts or ends with one (`align="end"` for a right-aligned column, `truncate` for one line). Labels and tooltips join facts with `factsLabel()`; a test fails on a "·" written by hand. |
| `Notice` | Something to know right here (info, warning, danger, success, neutral) with the one thing to do, and optionally a quiet "Ingatkan nanti" (`snooze`) after it. |
| `Stat` | A figure read at a glance (IPK, SKS, absences left). |
| `Card` | `plain`, `raised` (what matters most now), `sunken` (quiet areas). |
| `EmptyState` | What would be here, why it is empty, and the way forward. Small and kind; hide empty groups instead where nothing is lost. |
| `Button` | `primary` (one per view: the main action), `secondary`, `ghost`, `danger` (destructive only, never for a final but safe action like handing in). Shows a spinner while working. |
| `IconButton` | Square, always with a name and a tooltip. |
| `Popover` | A panel from a control (alerts, data status); Escape and a click outside close it. |
| `Dialog`, `ConfirmDialog` | Focus stays inside; Escape closes. Confirm only before what can't be undone. |
| `toast(text, tone, action?)` | Neutral, success or danger; with an action ("Urungkan", "Lihat") it stays 8 s. Never the only place an error is said. |
| `StatusChip` | A Task's true status: each its own color, glyph and word. Shown only where the status says something (not "Belum dikerjakan" on every to-do row). |
| `SourceTag` | Quiet outline tag, only where the source changes what to do. |
| `SourceLogo`, `AppMark` (`ui/brand.tsx`) | The real Edunex and SIX logos where the app stands for one of them (connecting, the data status, the accounts in Settings); Edunex Plus's own icon (`assets/icon.png`) in the sidebar, on the welcome screen and in Settings. |
| `Badge` | Sidebar counts: neutral = how many; amber = something needs the Student today. |
| `Skeleton` | Placeholders in the shape of what's coming; never a blank area or a lone spinner. |
| `Menu` (`ui/menu.tsx`) | A "⋯" button for a screen's rare actions; an item that can't run stays, dimmed, with the reason under it. A `trigger` makes it a quiet icon (with its words where there's room) for a row's or a notice's own small menu. |
| `SnoozeMenu` (`app/snooze-menu.tsx`) | "Ingatkan nanti" on a row or notice: the moments that fit the item, each with until when; then a toast saying when it's back, with Urungkan. A row or notice that leaves hands keyboard focus on (the next row, what follows the notice), never to the page. What's put off is listed quietly ("2 ditunda · Tampilkan") where it was, and in Settings. |
| `LineChart` (`ui/chart.tsx`) | The one chart spec: a clean value range with hairline gridlines, estimates dashed, a labelled target line, a direct end label, a tooltip per column, a table for screen readers. |
| `ShareMeter`, `CountdownBar` (`ui/meter.tsx`) | Status-colored meters: attendance against the course's target, a tick (the best still reachable as an optional ghost), always under a label that says what it measures; time left in a window, shrinking, amber in its last 15 minutes. |
| `Stepper` (`ui/controls.tsx`) | A number stepped between bounds (an attendance target, 50–100% by 5): − and + with names, the value read out when it changes. |
| `TimeGrid`, `GridBlock` (`ui/time-grid.tsx`) | A week as a time grid: height is duration, shared time side by side, empty days narrow, periods tinted and named, a now line. |
| `Flash` (`ui/motion.tsx`) | A figure the Student is watching glows briefly when it changes; the value itself changes at once. |

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
