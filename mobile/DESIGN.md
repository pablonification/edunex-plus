# Edunex Plus for Android: design system

How the app looks, moves and behaves, so every screen feels built for Android (round 2's goal: next to
Gojek, GoPay, Todoist, Grab and myBCA, never amateur). The tokens live in `src/ui/theme.ts`, the parts in
`src/ui/`. Build screens from those parts; a screen that styles its own button, row or sheet is a bug.
Words come from `src/core/strings` (`.agents/skills/copywriting`). The desktop is a reference for data,
never for layout.

Sources: Material 3 (incl. Expressive) and Android's quality guidelines, through the design skill
(`npx skills add pablonification/mobile-app-design-skill@mobile-app-design -g -y`: `references/android.md`,
`visual-design.md`, `accessibility.md`, `review-checklist.md`). Android only.

## The frame

| Piece | What | Where |
| --- | --- | --- |
| Bottom tabs | Android's own navigation bar (expo-router `NativeTabs`, a Material `BottomNavigationView`): Beranda, Jadwal, Tugas, Kuliah, Akademik. Labels always shown; icons are the app's Phosphor glyphs as drawables, outlined at rest, filled when picked; the native badge (error colour) only for what needs the Student today. All tabs mounted ahead: a switch is instant, each keeps its scroll, a second tap scrolls to the top. Each tab's route wraps its page in `TabClock` (a hidden tab ignores the minute's tick until shown) and calls `usePerfFocused(name)`. | `app/(tabs)/_layout.tsx`, `plugins/tab-icons.js`, `scripts/make-tab-icons.mjs` |
| Tab top bar | `TabHeader title=…`: the tab's name (Title L) with the data's status as one quiet line under it (tap: the sources sheet), then Search, the bell (Beranda only), the avatar (account and Settings). A problem banner follows under it. | `src/shell/source-status.tsx` |
| Stack top bar | `TopBar title=… actions=…`: Android's back arrow, the title at the start (Title L), one or two actions at the end, more in ⋮ (`OverflowMenu`). | `src/ui/top-bar.tsx`, `src/ui/menu.tsx` |
| Screens | Every drill-down is its own route on the native stack (`app/_layout.tsx`, `animation: "default"`: Android's own open/close, drawn natively), so Back and the back gesture work everywhere with no code. A course, a module (`/course/<code>/module/<id>`), a Task, an exam, Nilai, each part of Rencana studi (`/plan/<part>`), Settings, Search, Notifikasi, the in-app web page. | `app/` |
| Sheets | `Sheet` / `ActionSheet`: Android's Material bottom sheet (react-native-screens' `FormSheet`, a `BottomSheetDialog`): the scrim fades in while the sheet slides up, drag down or Back closes it, fits its content up to the screen less a strip. | `src/ui/sheet.tsx` |
| Menus | ⋮ opens `OverflowMenu`, Material's menu hung from its button. A row's long-press menu is an `ActionSheet` (nothing to hang from). | `src/ui/menu.tsx` |
| Snackbar | The toasts (`toast(...)`) as Material's snackbar: inverse surface, one at a time, just above the tabs' bar (or the phone's bar), Undo as its one action. | `src/ui/toasts.tsx` |
| Insets | Edge to edge. Inside a tab the tabs keep pages clear of the phone's bar; over the tabs `Page` and `BottomBar` add the bar's height (`useBottomInset()`). Never a hard-coded bar height. | `src/ui/insets.ts` |

**BackHandler** only while a sheet or an unsaved edit is open (a sheet's Back is the native sheet's own).
Anything else that wants Back is a screen: make it a route.

## Colour: Material 3 roles

`theme.color.<role>`. Pair each fill with its `on…` role; never a raw hex in a screen.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| primary / onPrimary | #245bcc / #ffffff | #8fb0ff / #0b2a6b | the one main action (filled button), links, selection |
| primaryContainer / onPrimaryContainer | #dbe6fe / #0d3a91 | #1f3f86 / #dbe6ff | the avatar, a highlighted card |
| secondaryContainer / onSecondaryContainer | #dce3f4 / #16264a | #2d3851 / #dce3f7 | the tabs' indicator, picked chips and segments, tonal buttons, the empty state's icon |
| tertiaryContainer / onTertiaryContainer | #efe6fd / #3a1580 | #3c2768 / #efe6fd | ITB's own (the source's purple) |
| error / onError, errorContainer / onErrorContainer | #b42318 / #fff, #fde7e4 / #7a1710 | #ff9c8f / #5c0f08, #3a1c19 / #ffdad5 | what went wrong, badges |
| surface | #ffffff | #161618 | the page |
| surfaceContainerLowest … Highest | #fff, #f6f7fb, #f0f2f7, #eaecf2, #e3e5ec | #111113, #1c1c1f, #212125, #2a2a2f, #35353b | cards and list tiles (Low), bars and sheets' parent (Container), wells (High), tracks (Highest) |
| onSurface / onSurfaceVariant | #1d1d1f / #55565e | #ececef / #b4b4bd | text: main / secondary (never lighter than onSurfaceVariant) |
| outline / outlineVariant | #7f8088 / #dfe1e8 | #8b8b94 / #3a3a41 | outlined buttons and fields (3:1) / decorative dividers only |
| inverseSurface / inverseOnSurface / inversePrimary | #2e3036 / #f1f1f6 / #aec6ff | #e4e4ea / #2a2a2f / #245bcc | the snackbar |

Meaning colours stay as the desktop names them (`warningBg/Fg`, `successBg/Fg`, `status…`, `meter…`,
the ten course colours via `theme.course(tone)`). The old names (`fg`, `muted`, `faint`, `canvas`, `edge`,
`line`, `fill`, `accent`, `accentFg`, `raised`, `sunken`, …) still work and point at their roles; new code
uses the roles. Every text/icon pair above passes 4.5:1 (text) / 3:1 (icons, outlines) in both themes,
measured with the skill's `scripts/contrast.py` (`mobile/qa/shell-notes.md`, "Contrast"). A new pair gets
checked the same way before it ships.

**Tonal surfaces, not boxes.** Cards and list groups are separated from the page by tone (surfaceContainerLow
on surface), never by a hairline border or a shadow. Shadows only on what floats over content: the
snackbar, a menu.

## Type: Material 3's scale (sp)

`<Text size="titleMedium">`; Android scales sp with the font size setting (up to 200%: never fix a text
container's height, let rows grow).

| Style | Size/line | Weight | Use |
| --- | --- | --- | --- |
| displaySmall … Large | 36/44 … 57/64 | 400 | rare: one big figure |
| headlineMedium | 28/36 | 400 | a page's own title (PageHeader), big figures (IPK) |
| headlineSmall | 24/32 | 400 | a detail screen's subject (a module's title) |
| titleLarge | 22/28 | 400 | top bars, sheet titles |
| titleMedium | 16/24 | 500 | section headers (semibold), card titles |
| titleSmall | 14/20 | 500 | small headers |
| bodyLarge | 16/24 | 400 | list titles, reading text |
| bodyMedium | 14/20 | 400 | meta lines, descriptions |
| bodySmall | 12/16 | 400 | captions, the status line (never smaller for words) |
| labelLarge | 14/20 | 500 | buttons, chips, tabs |
| labelMedium / labelSmall | 12/16, 11/16 | 500 | badges, tiny labels |

At most four sizes and two or three weights on a screen. `weight="semibold"` is the emphasis (M3
Expressive's emphasized styles), used for the one thing per row or section that leads. The old sizes map
onto the scale: micro/caption → bodySmall, small → bodyMedium, body/lead → bodyLarge, title → titleMedium,
heading → headlineSmall, figure/display → headlineMedium.

## Space, shape, targets

- **Spacing** on the 4/8 grid: `space[1]`=4, `[2]`=8, `[3]`=12, `[4]`=16, `[6]`=24, `[8]`=32, `[10]`=40,
  `[12]`=48; page sides 16. Tighter inside a group than between groups. (`space[0.5]`, `[1.5]`, `[2.5]`,
  `[3.5]` are left for old screens; don't use them in new work.)
- **Shape**: `shape.xs` 4 (snackbar, inner list tiles), `sm` 8 (chips, skeletons), `md` 12, `lg` 16 (cards),
  `lgPlus` 20 (a list group's ends, a leading card), `xl` 28 (sheets), `full` (buttons, segments, avatars).
  Nested corners: inner = outer − padding.
- **Touch targets**: 48 dp (`TOUCH`) for everything that takes a tap, whatever it looks like (`hitSlop`
  makes up the difference: a 32 dp chip, a 40 dp button). `IconButton` is 48.

## Components (`src/ui/`)

| Part | Material 3 | Notes |
| --- | --- | --- |
| `Button variant=` | primary = Filled, tonal = Filled tonal, secondary = Outlined, ghost = Text, danger = Outlined in error | pill, 40 (md) / 32 (sm) / 56 (lg) high, 48 to touch; label in labelLarge; `busy` keeps its colours with a spinner. **One filled button per screen.** |
| `IconButton` | Standard icon button | 48 dp, a name is required; `selected` for a toggle |
| `Chip` / `ChipRow` | Filter chip | 32 high, outlined; picked: secondaryContainer and a check |
| `Segmented` | Segmented buttons | 40 high, outlined, picked with a check |
| `Switch` | M3 switch | 52×32, thumb grows when on |
| `List` + `Row` | List items in a group | tonal tiles 2 dp apart, round group ends; 56 dp min; no chevrons; one row, one target, one outcome; `quick` names a row's swipe actions for TalkBack |
| `SwipeRow` | Swipe to act (Gmail) | see Patterns; on the UI thread (gesture handler 3 + Reanimated) |
| `Card` | Filled card | plain (Low), raised (Container, the one card that leads), sunken (High) |
| `Section`, `PageHeader`, `Notice`, `StatRow`, `Meta` | | as before, on the scale |
| `EmptyState` | | icon in a secondaryContainer circle, Title M, a line why, the next step as a button |
| `Skeleton` | | the shape of what's coming, breathing slowly (still with Remove animations) |
| `Sheet`, `ActionSheet` | Modal bottom sheet | native; `footer` for the sheet's main action |
| `OverflowMenu`, `Menu` | Menu | anchored, 48 dp items |
| `TopBar`, `TabHeader` | Small top app bar | surface at rest, surfaceContainer once the page scrolls under it (on the UI thread) |
| `Toasts` | Snackbar | |

## Motion

- **Screens**: Android's own transition (native stack `animation: "default"`) and Back; nothing drawn in JS.
- **Sheets**: the native Material sheet's slide and scrim fade, its drag and Back.
- **Tabs**: no animation (Material's bar switches at once).
- **Small things the app moves itself** use M3's springs (`motion.spatialFast/Default/Slow` for position,
  `motion.effects…` for opacity and colour, which never overshoot), on the UI thread (Reanimated, or RN
  Animated with `useNativeDriver`). Durations otherwise: `motion.duration.short` 150, `medium` 250, `long` 400.
- **Joy in a few earned moments only** (`motion.expressive`, a slight overshoot): Kumpulkan, a swipe that
  commits, Tandai Hadir done. Not on every tap.
- **Remove animations** (`useReduceMotion()`): moving things only fade; the skeleton stops breathing.

## Patterns

- **One tap target per card or row, one outcome.** A card with an arrow that goes elsewhere is a bug (W12).
- **States, every screen**: saved data at once; else a skeleton in the screen's own shape (never a spinner
  on a blank page); empty says why and the next step; an error is a banner under the top bar with what's
  wrong and "Coba lagi" (`ProblemBanner`); offline keeps the saved data with "Terakhir diperbarui …" in the
  top bar's status line, never greyed out.
- **Errors never in a snackbar** (it's gone before it's read): inline for a field, a banner for the page, a
  dialog only when it blocks. The snackbar says what happened, with Undo.
- **Undo over confirm** for routine actions; confirm only what can't be undone, naming it.
- **Every gesture has a visible way too** (a swipe also in the long-press menu, the menu also in ⋮ or a button).
- **Swipe on a row = Android's commit swipe** (`SwipeRow`, Gmail's): the row follows the finger over the action's
  colour; past 35% of its width (or a flick past 25%) a haptic tick and the icon growing say letting go will do it.
  A "done" (success tone) swipes toward the end, anything else toward the start, the same on every screen. An action
  that puts the row away (`leaves`, the default) slides it out, folds it, then runs, and its snackbar offers Urungkan
  (a row still there 1.5 s later comes back); one that opens a choice (`leaves: false`, Ingatkan nanti) springs back
  and opens it. Every swipe is also in the long-press `ActionSheet` and in TalkBack's actions (`Row quick=`).
- **A card is one target**: the whole card opens one thing (Beranda's now card: its class's sheet); a labelled
  button inside it is the card's one action, never an arrow to somewhere else.
- **Speed**: every screen calls `usePerfDrawn(ready)` (a tab: `usePerfFocused(name)`); targets on the lab's
  release builds: tab switch < 300 ms, screen open < 500 ms, no JS block > 50 ms while moving. Draw the
  first screenful first: defer what's below it a frame, FlashList for long lists.
- **testIDs**: `screen.<name>`, `tab.<name>`, `row.<kind>.<id>`, `action.<name>`, `sheet.<name>`.

## Review checklist (before a screen is done)

Light and dark screenshots on `mid`; largest font size; TalkBack names on every control; every pair through
contrast.py; 48 dp targets; one filled button; no hairline boxes; Back and the gesture from every pushed
screen; the empty, loading, error and offline states seen once each.
