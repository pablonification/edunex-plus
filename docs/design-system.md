# Design system

The look and behaviour every Edunex Plus screen follows. It comes from the
approved prototype, direction D "Kuliah" (branch `prototype/v2-design`,
ticket #83): EduNex and SIX the way students already know them (course →
modules, meetings, Jadwal, KRS), merged into one calm app. It is not a
calendar app or a to-do app; productivity ideas appear only as accents.

The code is the source of truth: tokens live in `src/app/styles.css`, the
components in `src/app/ui/`, and every word in `src/core/strings.ts`. This
page explains them.

## Principles

1. **Nothing to relearn.** Same names and places as EduNex and SIX: Beranda,
   Tugas & Ujian, Jadwal, Presensi, Nilai, Rencana studi, and the term's
   courses in the sidebar.
2. **What matters now comes first.** A screen opens with what needs the
   Student, not with equal-weight lists.
3. **Every merged fact shows its source.** A small tag says EduNex, SIX or
   Kalender ITB, so the Student knows where to act.
4. **Honest states.** A source is live, offline, checking, signed out, ended,
   or "changed something", with when it last updated. Old data is never shown
   as fresh, and a failure is never an empty screen.
5. **Calm.** No explanatory filler, no decoration that isn't information.

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

**Sources (background / text)**

| Token | Light | Dark |
|---|---|---|
| `--source-six-bg` | `#e3f4f1` | `#11302c` |
| `--source-six-fg` | `#0f6b63` | `#6fd6c6` |
| `--source-edunex-bg` | `#e6eefe` | `#1b2742` |
| `--source-edunex-fg` | `#2a58b8` | `#9ab8ff` |
| `--source-itb-bg` | `#f3ecfd` | `#271d3a` |
| `--source-itb-fg` | `#6338b8` | `#c4b0f5` |

**Course colors.** Each course has an identity color for dots, bars and the
sidebar: `#2F7CF6 #7C5CFC #1FA971 #F2884B #E0559A #14A3B8 #D7A20F #E5484D`.
The color comes from the course code (`src/core/course-colors.ts`), so it
stays the same across launches, and courses of one term don't share one.
Course colors mark identity only; they never carry text.

**Color is never the only signal.** Task statuses have their own glyph and
word, source states their own mark and word.

## Type

The system font (SF Pro on macOS, Segoe UI on Windows, the desktop's own on
Linux); no web fonts to download. Numbers that line up use tabular figures.

| Token | Size / line | Use |
|---|---|---|
| `text-micro` | 11 / 14 | Tags, badges, keyboard keys |
| `text-caption` | 11.5 / 16 | Meta lines, section labels (uppercase, +0.04em) |
| `text-small` | 12.5 / 18 | Secondary text, buttons |
| `text-body` | 13.5 / 20 | Default UI text |
| `text-lead` | 14.5 / 21 | List and card titles |
| `text-title` | 15 / 20 | Section and dialog titles (semibold, −0.01em) |
| `text-heading` | 20 / 26 | Page sub-titles |
| `text-display` | 26 / 32 | Page titles (semibold, −0.02em) |

## Space, shape, depth

- **Spacing** uses Tailwind's 4 px steps. Pages: 40 px side padding, content
  up to 1080 px wide. Cards: 16 px padding. Rows: 14 to 16 px across, 10 to
  14 px high. Sections: 36 to 44 px apart.
- **Radius**: 5 px keys and tags, 6 px small buttons, 8 px buttons, inputs and
  nav items, 12 px cards, 16 px dialogs, full for chips and switches.
- **Elevation**: cards use a 1 px edge, no shadow. Only floating things cast
  shadows: `shadow-button` (primary buttons), `shadow-thumb` (switch knob,
  selected segment), `shadow-lift` (a card on hover), `shadow-pop`
  (tooltips, toasts, popovers), `shadow-dialog` with a dimmed, lightly blurred
  backdrop.

## Motion

Restrained and quick. It confirms an action; it never performs.

| What | Duration | Easing |
|---|---|---|
| Hover, press, color changes | 150 ms | ease |
| Popovers, tooltips, toasts in | 160 to 180 ms | `ease-standard` cubic-bezier(0.2, 0, 0, 1) |
| Closing a dialog or popover | instant | — |
| Progress bars filling | 500 ms | ease |
| Loading placeholders | 1.4 s pulse | ease-in-out |

With reduced motion turned on in the OS, every animation and transition is
cut to an instant. Live dots stop pulsing.

## Icons

Inline SVG in the Lucide style (`src/app/ui/icons.tsx`): 24 px grid, round
caps, 1.75 stroke (2 when active or inside chips). Sizes: 12 to 14 px in
chips and meta lines, 16 px in rows and buttons, 18 px in the top bar.
Icons are decorative; the control around them carries the name.

## Window chrome

- **macOS**: hidden title bar; the traffic lights sit in the sidebar at
  16, 18. The top 52 px of the sidebar and the top bar drag the window;
  controls inside them don't.
- **Windows and Linux**: the standard system frame and title bar; the app's
  menu bar shows on Alt.
- The window opens only once the page has drawn the saved data, on a
  background matching the theme, so there is no white flash.
- Closing the window on macOS keeps the app running (Dock); elsewhere it
  quits, until the tray arrives with alerts.

## Components

Every component has a keyboard focus ring (2 px `--focus` outline, 2 px out)
and an accessible name.

| Component | States |
|---|---|
| **Sidebar item** (nav, course) | default, hover (`--hover`), current (`--selected`, semibold, `aria-current`), focus. Course items show the course dot, code and name, truncated. |
| **Top bar** | title area; source status chip; refresh (spinning while busy, disabled when signed out). |
| **Button** | `primary` (one per view, the main action), `secondary`, `ghost`, `danger`; sizes 28 / 32 / 40 px; hover, pressed, focus, disabled (50%), busy (spinner, no clicks). |
| **Icon button** | 28 / 32 px square, name required, tooltip with the same name. |
| **Switch** | off, on, focus, disabled; the knob slides the track's width. |
| **Segmented control** | one choice selected; arrow keys move the choice (radio group). |
| **Card** | static; clickable cards lift slightly on hover. |
| **Row list** | rows inside a card, 1 px dividers; hover background on clickable rows. |
| **Task status chip** | not started, draft, submitted, overdue, closed, in review: each its own color, glyph and word. |
| **Source tag** | EduNex, SIX, Kalender ITB. |
| **Source status chip** | checking (spinner), live (green dot), offline (no-signal mark), session ended (amber, asks to sign in again), changed something (red, the call that failed in its tooltip), signed out. Click: refresh, or sign in again. Tooltip: what it means and when it last updated. |
| **Source notice** | on Home when a session ended or the source changed something: one line of what happened and the one action. |
| **Badge** | counts in the sidebar; neutral or amber. |
| **Dialog** | title, close button, scrolling body; Escape and the backdrop close it; focus stays inside. |
| **Confirm dialog** | before anything that can't be undone from inside the app (sign out of everything): title, what will happen, Cancel and the action in danger style. |
| **Tooltip** | after 450 ms hover or on focus; short. |
| **Toast** | bottom center, five seconds, at most three; neutral or danger. Never the only place an error is said. |
| **Loading** | placeholders in the shape of what's coming, never a blank area or a lone spinner for a whole page. |
| **Empty** | dashed outline, an icon and one plain sentence; an action when there is one. |
| **Error (crash guard)** | every panel (sidebar, top bar, each screen, each dialog) has its own: a broken panel says "This part couldn't be shown", with Try again and Copy details; the rest of the window keeps working. |
| **Offline** | shown by the source status chip and the saved data staying on screen; no separate page. |
| **Tabs**, **menus**, **file drop** | Radix Tabs and Dropdown Menu, and a drop zone with a browse button and the attached files listed, built with the course page and the hand-in tickets in the same style. |

## Copy

- **No filler.** No sentences that explain the interface ("Files listed per
  course from the latest snapshot…"). If a screen needs explaining, the
  screen is wrong.
- **Say what happened and what to do**, in that order: "EduNex ended your
  session. Your last data stays readable." + **Sign in again**.
- **Human times**: "Besok, 23:59 · dalam 6 jam", "Diperbarui 5 menit yang
  lalu", never a raw timestamp. Times are in the computer's time zone.
- **Voice**: Indonesian uses *kamu* and plain, friendly words; English is
  plain and short. Sentence case for titles and buttons.
- **Names** are shown as people write them (EduNex can send all capitals).
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
| Modul | Module | EduNex's course outline |
| Materi | Material | |
| Tugas | Task | EduNex's assignments |
| Ujian | Exam | UTS (midterm) and UAS (final) stay as they are |
| Presensi | Presence | EduNex's attendance session |
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
