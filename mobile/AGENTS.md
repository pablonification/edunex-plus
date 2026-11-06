# mobile/: Edunex Plus for Android

Expo SDK 58, React Native 0.88 (New Architecture, Hermes), Expo Router, a dev build (not Expo Go).
Read the repository's `CLAUDE.md` first, then `mobile/PROGRESS.md` (scope, decisions, who's on what).

Expo changes every SDK: before writing code that touches an Expo or React Native API, read the
versioned docs, `https://docs.expo.dev/versions/v58.0.0/`, or the package's own types in
`mobile/node_modules`. Install with `npx expo install <package>`.

## How the app is put together

- `app/`: routes only (Expo Router). `(tabs)/` is the bottom tabs: Beranda (`index`), Tugas
  (`tasks`), Jadwal (`schedule`), Presensi (`presence`), Lainnya (`more`). Everything else is a
  stack screen over them (`task/[taskId]`, `course/[code]`, `settings`, …).
- `src/host/`: the desktop's engine (`../src/engine`) on the phone (network, files, keystore,
  notifications, background sync) and the bridge the screens talk through, answered in-process
  (`handlers.ts` mirrors `src/desktop/handlers`).
- `src/shell/`: start-up (`boot.tsx`: the desktop's own `AppStore`, `I18nProvider`), sign-in
  (`sign-in.tsx`).
- `src/ui/`: the phone's versions of the desktop's parts **with the same names**: `Page`,
  `PageHeader`, `Section`, `List`, `Row`, `Meta`, `Notice`, `StatRow`, `Stat`, `factsLabel`
  (layout.tsx); `Card`, `EmptyState`, `Skeleton`, `LiveDot`, `Bar`, `Badge`, `Tag`, `StatusChip`,
  `StatusGlyph`, `CourseDot`, `CourseCode`, `ProgressBar` (display.tsx); `Button`, `IconButton`,
  `Switch`, `Segmented`, `Chip`, `ChipRow` (controls.tsx); `Icons` (the desktop's names);
  `Text` (size and tone, never a raw color); `Sheet`, `ActionSheet` (sheet.tsx); `SwipeRow`
  (swipe.tsx); `TopBar` (top-bar.tsx); `useTheme()` (theme.ts: the desktop's colors, light and
  dark, `theme.course(tone)` for a course color).
- `src/nav.ts`: `useNav().go(route)` / `replace` / `back` with the desktop's `Route`
  (`src/core/route.ts`); `hrefOf(route)`; `useParam(name)`.
- `src/swaps/`: phone versions Metro puts in place of the few desktop modules that touch the DOM
  (`metro.config.js` SWAPS). The desktop files stay as they are.
- `src/demo/`: the demo build's world (test/pretend), left out of the real app by Metro.

## Porting a desktop screen

1. Read the desktop screen (`src/app/screens/<name>.tsx` and what it imports) and its scope row in
   PROGRESS.md (keep / change / replace, and why).
2. Keep its data exactly: call the same hooks (`useDataset`, `useStatus`, `useSettings`,
   `useBridge` from `src/app/store`; `useT`, `useFormat`, `useNow` from `src/app/i18n`;
   `useTermCourses`, `useCourseColor`, `useTerm` from `src/app/courses`; `useHomeWorld`,
   `useSnoozes`, `useDone`, `useScheduleData`, … from the other DOM-free modules of `src/app`)
   and the same `src/core` functions. Never work a figure out another way. A desktop helper
   that's DOM-free but lives in a `.tsx` with DOM parts: copy only that helper into a
   `src/screens/<name>/` file, with a comment naming where it comes from.
3. Build the screen from `src/ui`, keeping the desktop's structure (sections, rows, meta lines,
   notices, their order) and making it right for a phone: one column, the main action within a
   thumb's reach (bottom of the screen or the row itself), sheets instead of popovers, swipe for
   a row's quick actions (always also in its long-press menu), pull to refresh on every page
   (`refreshNow` / "Perbarui sekarang"), FlashList for lists that can run long.
4. Every word comes from `src/core/strings` (`useT()`), the desktop's keys first. A phone-only
   string goes in `src/core/strings/mobile.ts` under a `// <screen>` comment, in Indonesian and
   English, written with the `copywriting` skill (`.claude/skills/copywriting`).
5. testIDs: `screen.<name>` on the page, `tab.<name>`, `row.<kind>.<id>` on rows, `action.<name>`
   on buttons a flow presses.
6. Put the screen's parts in `src/screens/<name>/`; the route file in `app/` stays small. A part
   two screens need goes in `src/parts/` (new file). Don't edit another piece's files; say what
   you'd change instead.
7. Check: `npx tsc --noEmit` in `mobile/`, `npx biome check mobile` at the root, and the root
   `npm run check` if you touched `src/`. Only the lead runs the app on a device.

## Running it (the lead's machine)

`. ~/tools/env.sh`, then Redroid (`adb connect localhost:5555`), the dev client APK from the
GitHub Actions run, and `npm run start` (or `npm run start:demo`) in `mobile/`. Switching
between demo and real needs `--clear`.
