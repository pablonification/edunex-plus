# Home-screen widgets: what a student would put there

Eight widgets, each answering one question at a glance, all drawn from what the app already saved (no new
requests, no new data). Declared natively in `mobile/app.config.ts`; drawn by `mobile/src/widget/`; picker pictures
made by `mobile/scripts/make-widget-previews.mjs` (`assets/widget-preview-<name>.png`).

Sizes are in launcher cells (w×h). "Min" is the smallest it can be made, "first" what it's placed at, "max" the
largest. All eight resize both ways. Every tap below is a deep link the app already handles
(`edunexplus://…`, `src/nav.ts`), except Tandai Hadir (SIX's own page, through `check-in/<id>`) and Presensi
(Edunex's page in the browser).

States every widget has:

- **Normal**: its data.
- **Empty**: nothing to show, said as good news or plainly, never a "0".
- **Signed out**: what it reads isn't signed in. It says which one to sign in to, and opens the app.
- **Offline**: the data stays, and the foot says "Tidak terhubung · data dari hari ini, 08:12" in amber (`status.problem`).
- **Holiday**: no class in the week ahead, said as such ("Tidak ada kuliah dalam seminggu ke depan.").
- **Never opened**: "Edunex Plus" and the one step to start, in the phone's language.

The foot line, "Diperbarui pukul 14:05", is shown where there's room (3 rows and up) and always when something is
wrong.

## The eight

### 1. Sekarang (`Now`, existing): "What class am I in or going to, and do I need to press Tandai Hadir?"

- Sizes: min 2×1, first 4×2, max 5×4.
- Shows the class on now or next (time, room, code, name, course colour). Under it, **Tandai Hadir** as the
  main button while SIX shows it, and the open Edunex Presence. Then "Perlu perhatianmu", as many items as fit, and
  "+N lagi". At 2×1 it shows the class only.
- Taps: the class opens its course's Pertemuan tab (Presensi without Edunex). Tandai Hadir opens SIX's check-in on
  that class. A Presence opens Edunex's page, or the Task when submitting counts. Each need opens its own place.
  "+N lagi" and the card open Beranda.
- States: normal; empty ("Tak ada yang perlu diurus" family, from Beranda); signed out (SIX: no class line);
  offline; holiday.
- Model: `widgetModel()` (`now`, `actions`, `needs`, `status`, `changesAt`).

### 2. Hari ini (`Today`, existing): "What does my day look like?"

- Sizes: min 2×2, first 3×2, max 5×4.
- Shows today's classes, one line each (time, code, room), the one on now in green, the ones over quiet. Then the
  next deadline. When the day is longer than the widget, classes already over drop first.
- Taps: a class opens Jadwal on that day with its sheet open (`schedule?class=`). The deadline opens the Task.
- States: normal; empty ("Tidak ada kuliah hari ini.", opens Jadwal); signed out of SIX; offline.
- Model: `widgetModel().today`.

### 3. Tenggat (`Due`, new): "What's due, soonest first?"

- Sizes: min 2×2, first 3×2, max 5×5 (a full page of deadlines).
- Shows every open Task with a deadline ahead, soonest first: title, course code and colour bar, "Hari ini, 23:59".
  Due within a day: the line in amber. What doesn't fit: "+3 lagi".
- Taps: each row opens its Task. The heading and "+3 lagi" open Tugas.
- States: normal; empty ("Tidak ada yang perlu dikerjakan", opens Tugas); signed out of Edunex ("Masuk ke Edunex");
  first read not done yet ("Memperbarui…"); offline.
- Model: `dueWidget(facts)`. Changes by itself when a deadline passes, when one comes within a day, and at midnight.

### 4. Kehadiran (`Attendance`, new): "Is any course close to running out of absences?"

- Sizes: min 2×2, first 3×2, max 5×4.
- Under "Jatah absen", every course of the term, the one nearest its limit first: colour dot, code (with its name
  when 4 cells wide), then "Habis" (amber), "Lewat 1×" (red) or "Sisa 2×" (green), the same colours as Kuliah.
  TalkBack hears the full "Sisa jatah absen 2×".
- Taps: each row opens its course. The heading and "+N lagi" open Kuliah.
- States: normal; empty ("Belum ada mata kuliah semester ini"); signed out of SIX ("Masuk ke SIX"); offline. No
  holiday state: the counts don't change on a holiday.
- Model: `attendanceWidget(facts)`. Never redrawn on a timer: it changes only when SIX's count does.

### 5. Ujian (`Exam`, new): "How many days until my next exam?"

- Sizes: min 2×1, first 2×2, max 4×2.
- The big number in the course's colour ("7 hari lagi"), or "Hari ini" / "Besok" alone. With it the exam ("UTS
  DK4073") and its sitting ("Kam, 15 Okt, 11:00 · R.9009"). At 2×1 it lays out in a row.
- Taps: the whole widget opens the exam's page.
- States: normal; empty ("Belum ada ujian terjadwal", opens Tugas & Ujian); never opened; offline (foot).
- Model: `examWidget(facts)`: the same exams as Beranda's (SIX's sittings and Edunex's), each at its next part.
  Changes at midnight and when the exam starts.

### 6. Kelas berikutnya (`Next`, new): one cell, "When and where is my next class?"

- Sizes: min 1×1, first 1×1, max 2×2.
- The next class's start time big, its code in its colour, its day above when it isn't today, its room when tall
  enough. While SIX shows Tandai Hadir for the class on now, the cell turns green and says "Hadir".
- Taps: opens that class's sheet on Jadwal. When green, it opens SIX's check-in page.
- States: normal; check-in (green); holiday (no class this week); signed out of SIX.
- Model: `nextWidget(facts)`. Changes when that class starts (the next one takes over) or its check-in ends.

### 7. Pintasan (`Services`, new): "Take me straight to Jadwal, Tugas, Kuliah or Nilai"

- Sizes: min 2×1, first 4×1, max 5×2. As many of the four as fit the width (each needs about 64 dp).
- Four filled Fluent icons, each in its own colour on its tint, with a one-word label when tall enough (the same
  grammar as Beranda's service grid).
- Taps: each opens its tab or screen.
- States: one state. It says nothing that changes, so it's drawn only when placed, resized, or the language or look
  changes.
- Model: `servicesWidget(facts)`.

### 8. Satu mata kuliah (`Course`, new): "How is this one course going?"

- Sizes: min 2×2, first 3×2, max 5×3.
- The course's code and name with its colour, its absences in the state's colour, its next class ("Besok,
  08:00–10:00 · R.9009"), its next open Task with the deadline. What doesn't fit drops from the bottom.
- Which course: on Android 12 and up, it's placed at once on the course with the next class. Holding it and choosing
  "Ubah widget" asks which course (`src/widget/configure.tsx`). Android 11 and older ask as it's placed.
- Taps: the name opens the course, the class its sheet on Jadwal, the Task the Task.
- States: normal; never opened / no courses yet; offline. A course with no class ahead or no Task leaves that line
  out.
- Model: `courseWidget(facts, code)`. The choice is kept per widget (`src/widget/choice.ts`) and forgotten when the
  widget is removed.

## What the platform allows, and what it doesn't (what I read)

- **Sizes** (Android, "App widgets: provide flexible layouts", developer.android.com/develop/ui/views/appwidgets/layouts):
  `targetCellWidth/Height` set the first size on Android 12+, `minWidth/Height` on 11 and older (70 × cells − 30 dp),
  `minResizeWidth/Height` how small it can be made, `maxResize*` how big. The library's config has no `minResize*`.
  Without them a widget can only grow from its first size, which is the "stretches only wider" in `HANDOFF.md`:
  "Now" started at 4×2 on a 4-wide grid. **Added** through a small plugin of ours (`plugins/widget-extras.js`).
- **Picker words in two languages**: the library writes one label and marks the description untranslatable
  (`node_modules/react-native-android-widget/app.plugin.js`, `withWidgetDescriptions`). **Added** in the same plugin:
  `values/widget_strings.xml` (English) and `values-in/` (Indonesian), with the receivers and descriptions pointing
  at them.
- **Preview**: the library supports `previewImage` only, not `previewLayout` (Android 12's live preview). Each widget
  now has **its own picture** at its first size. A `previewLayout` would need a native XML layout per widget, with
  data that can't come from the app. Not worth it.
- **How it draws**: the library renders the tree into a picture, light and dark, with tap areas laid over it
  (docs "Limitations", saleksovski.github.io/react-native-android-widget/docs/limitations; `RNWidget.java`). So:
  colours are hex only. **The wallpaper's colours (Material You) can't be had** without new native code that reads
  `android.R.color.system_accent*` and hands them to JavaScript. Light and dark both work: two pictures, Android
  picks.
- **A list that scrolls**: `ListWidget` exists (docs "ListWidget"; `RNWidgetCollectionService`, already in the
  library's manifest entry), at most 2 per widget, each row a picture with its own tap. Tenggat and Kehadiran fit
  rows to the size tonight, and can move to `ListWidget` later in JavaScript alone.
- **A tap per row**: `clickAction="OPEN_URI"` per area (docs "Handling clicks"). A custom action reaches the widget's
  task in JavaScript (`WIDGET_CLICK`), so a "refresh" could be added later without native work.
- **A choice when placed**: `widgetFeatures` makes the library add a configuration activity
  (`RNWidgetConfigurationActivity`, the screen registered with `registerWidgetConfigurationScreen`). Native, so it's
  in tonight: "Satu mata kuliah" uses it. `reconfigurable|configuration_optional` means Android 12+ doesn't ask on
  placing.
- **Update period**: 30 minutes at least (the library clamps it). Kehadiran and Pintasan are 0: the app and the
  background sync draw them when their data changes.
- **"Add to home screen" from inside the app**: `requestWidgetPin` is in the library already, JavaScript only, if a
  screen wants to offer a widget later.

## Left out, and why

- **IPK / Nilai**: changes twice a year, and a grade on a home screen is there for anyone holding the phone to see.
  Nilai is one tap away in Pintasan.
- **Lock-screen widgets** (`widgetCategory: keyguard`, Android 16 QPR2 phones and some tablets only): course names
  and deadlines on a locked phone. Easy to add later, but native.
- **UKT and KRS**: a few dates a term, which are better as reminders (the app already sends them).
- **Announcements and new materials**: a feed, not a glance. Beranda and the notifications have them.
- **A refresh button**: a refresh means a network read, more than today's wake-ups. Tapping the foot opens the
  app, which reads.
- **The wallpaper's colours**: see above, needs native code.

## Native pieces that went in tonight

All in `app.config.ts` and `plugins/widget-extras.js`. Everything after them is JavaScript:

- 8 widget receivers and their provider XML: names, sizes, previews, update periods.
- The configuration activity (from `widgetFeatures` on "Course").
- Picker words in Indonesian and English.
- The collection service for `ListWidget` (the library adds it already).
- Deep links: the app's scheme already covers every target. Nothing new.
- No new permission is needed.

## The reported freeze, and what changed

How an update runs: the app (8 s after start, then 1.5 s after each burst of engine events, then as it goes to the
background) or the background sync calls `updateWidgets`. That works out Beranda's reasoning again, then for every
placed widget asks Android for its size (`getWidgetInfo`, which lists every widget provider on the phone, twice per
widget). It builds the light and dark trees, and the library draws both into full-size pictures and saves them as
PNGs at full quality. With the app closed, Android's 30-minute update starts React Native without a screen, the whole
JavaScript bundle included, in the app's process.

What I think freezes a slow phone: the JavaScript thread held in one go by the reasoning plus every widget's trees,
right as the app starts or a sync settles, with the PNG work queued behind it. And opening the app while a headless
update is starting React Native, so the two starts compete.

What changed (`src/host/widget.ts`, `src/widget/draw.ts`):

- The facts are worked out once per round, and each widget's model only when that widget is placed.
- A widget whose model, size and look are what it showed last isn't drawn again. Most sync rounds change nothing a
  widget shows, so there are no trees and no pictures for those rounds.
- One frame's pause between two widgets, so the app keeps drawing.
- No widget redraws more often than before: Android's period is unchanged (30 min), and two are now 0.

Not changed (the library's, native): the headless start itself, and PNGs at full quality. If the conductor still sees
the freeze, the next suspects are those two. A trace would show `RNWidget.drawWidget` or `HeadlessJsTaskWorker`
around the stall.

## iPhone

Every model function returns plain data (no functions, colours as the course's tone name), so a WidgetKit
extension can be fed the same JSON: `Due`, `Attendance`, `Exam`, `Next`, `Course` map to small, medium and large
families. The iPhone side needs Swift and an app group, so nothing of it is built tonight (`IOS.md`).
