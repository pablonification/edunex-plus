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

## The look (the same app as Beranda)

Two shapes, and every widget is one of them:

- **One course is one block in its colour**, saturated, the same in light and dark, white on it, with a white
  button when there's something to press: Sekarang, Ujian, Kelas berikutnya, Satu mata kuliah. The colour is the
  course tile's light ink (`courseBlock` in `src/widget/view.tsx`): white reads on every one at 4.5:1 or more.
- **Many things are a short list on the widget's own surface** (white, one dark surface in dark), the time first and
  a bar in each course's colour: Hari ini, Tenggat, Kehadiran. Pintasan is Beranda's solid service tiles.

Rules they all follow:

- A course is called by its **name, whole**, wrapped to two lines (three in a 2-cell widget) before anything is cut.
  Where the name can't fit whole, its **code** stands in (`courseLabel`): a name is never cut mid-word. Only a
  Task's title, which can run to a sentence, ends in "…", after two lines.
- Each fact once. The widget's name isn't written inside it, but the list headings "Tenggat" and "Jatah absen",
  which say what the rows are, and the date on Hari ini.
- Times of day and days only ("Tutup 09:30", "7 hari lagi"): nothing counts down, and no bar shows a fraction that
  would be stale by the next redraw.
- Red and amber only for danger: a deadline within a day, absences gone or past the limit, and what's wrong at the
  foot. On a course's colour, where neither reads, the danger is a white pill with the word in its colour.
- The foot, "Diperbarui pukul 08:12", shows from two rows high where there's room, and always (in amber, over two
  lines when narrow) when something is wrong.

What the library can't draw, and what's done instead: no blur, shadow or wallpaper colour (flat hex fills); no
opacity (a "soft white" is mixed into the course's colour as hex, `mix`); no text measuring (a line count is
estimated on the safe side, `linesOf`); a child isn't clipped to its parent's corners (a block inside the surface has
its own corners and a 6 dp inset); `adjustsFontSizeToFit` only on the big figures.

## The eight, size by size

Sizes are this phone's (Samsung One UI, 4 across: a 4×2 measured 325×227 dp). Pictures of all of it:
`node mobile/scripts/render-widgets.mjs <folder>` (below).

### 1. Sekarang (`Now`): "What class am I in or going to, and do I need to press?"

| Size | Shows |
| --- | --- |
| 2×1 (min) | The block: the time, the course (its code when the name needs three lines), the white button "Isi Presensi" |
| 4×1 | The block as a row: time and room, the name over two lines, the button at its right with "Tutup 09:30" under it |
| 4×2 (first) | The block (time · room, name whole, the white button with "Tutup 09:30" at its end), then the first thing that needs you, then the foot |
| 4×3 and up | The same, then every need that fits and "Lihat semua 3 di Beranda", then today's classes still to come (time, colour bar, name, room) |

- Later class: the block starts with its day ("Besok · 08:00–10:00"), never a bare time that reads as today.
- Taps: the block opens the class (its course's Pertemuan tab; Presensi without Edunex). "Isi Presensi" opens
  Edunex's Presence page, or the Task when submitting counts. "Tandai Hadir" opens SIX's check-in on that class. Each
  need opens its own place, a later class its sheet on Jadwal. The surface and "Lihat semua" open Beranda.
- States: no class in the week ahead: a calm line on the white surface, what's open as a blue button, the needs.
  Signed out: "Edunex Plus" and what to do. Offline: the block stays, the foot says since when.
- Model: `widgetModel()` (`now`, `actions` with `short` "Isi Presensi", `needs`, `today`, `status`, `changesAt`).

### 2. Hari ini (`Today`): "What does my day look like?"

| Size | Shows |
| --- | --- |
| 2×2 (min) | The date, each class one row: start time, colour bar, code (a name doesn't fit two cells). Then the next deadline |
| 3×2 (first) | The same with names whole, over two lines where needed. The deadline gives way to the names |
| 4×3 | Names with the room under each, the deadline, the foot |
| 4×4 and up | The same; a day has no more to say (the space under it is the day's end) |

- The class on now is a row filled in its course's colour; classes over are grey and drop first.
- Taps: a class opens its sheet on Jadwal (`schedule?class=`). The deadline opens the Task.
- States: no class today ("Tidak ada kuliah hari ini.", opens Jadwal), signed out, offline.
- Model: `widgetModel().today` (each class now has its `name`).

### 3. Tenggat (`Due`): "What's due, soonest first?"

| Size | Shows |
| --- | --- |
| 2×2 (min) | Two deadlines: "Jum, 16 Okt, 23:59" first, the Task under it, the course's bar. "+3 lagi" |
| 3×2 (first) | The same with the course's code after the time |
| 4×3 | Five, one line each |
| 4×5 (max) | All of them, a long title over two lines |

- Within a day: the time in amber.
- Taps: a row opens its Task. "Tenggat" and "+3 lagi" open Tugas.
- States: nothing due ("Tidak ada yang perlu dikerjakan"), signed out of Edunex ("Masuk ke Edunex"), first read not
  done ("Memperbarui…"), offline.
- Model: `dueWidget(facts)`.

### 4. Kehadiran (`Attendance`): "Is any course close to running out of absences?"

Each course's absences as **marks**: one dot per absence the term allows, in the course's colour while it's still
left, pale once used, red for each one past the limit. Two full dots is two left. The marks sit in one column, so
they read down the list like a chart.

| Size | Shows |
| --- | --- |
| 2×2 (min) | The course over its marks, the word beside them only for a danger ("Lewat 1×", "Habis") |
| 3×2 (first) | Name, then marks |
| 4×2 and up | Name (two lines), marks, and the word at the end: "Lewat 1×" red, "Habis" amber, "Sisa 2×" green |

- The nearest its limit first; what doesn't fit: "+2 lagi". More than six absences allowed: the word alone.
- Taps: a row opens its course. "Jatah absen" and "+N lagi" open Kuliah. TalkBack hears "Sisa jatah absen 2×".
- States: no courses yet, signed out of SIX ("Masuk ke SIX"), offline. No holiday state.
- Model: `attendanceWidget(facts)` (rows now carry `allowed`, `used`, `over`).

### 5. Ujian (`Exam`): "How many days until my next exam?"

| Size | Shows |
| --- | --- |
| 2×1 (min) | On the course's colour: "7" over "hari lagi", beside "UTS DK4073" and its sitting |
| 2×2 (first) | The figure big on top, "UTS Komunikasi Pemasaran", "Kam, 15 Okt, 11:00 · TVST C", the foot |
| 4×1 | The figure beside the exam's name and sitting on one line each |
| 4×2 (max) | The figure at 72, the name, the sitting, the foot |

- Tomorrow and today: "Besok" / "Hari ini" as the figure, no number.
- Taps: the whole widget opens the exam's page.
- States: no exam dated ("Belum ada ujian terjadwal", opens Tugas), never opened, offline (in the block).
- Model: `examWidget(facts)` (now with `kind` "UTS" and the course's `name`).

### 6. Kelas berikutnya (`Next`): one cell, "When and where is my next class?"

| Size | Shows |
| --- | --- |
| 1×1 (min, first) | A time and a colour: "11:00" white on the course's colour, its code, its room; its day above when it isn't today |
| 2×1 | The same, the time bigger |
| 2×2 (max) | The time on top; the course's name whole and its room at the foot |

- While SIX shows Tandai Hadir for the class on now: the cell is SIX's green and says "Tandai Hadir".
- Taps: the class's sheet on Jadwal (a meeting: its course's Pertemuan). Green: SIX's check-in page.
- States: holiday ("Tidak ada kuliah", the two words a cell holds), signed out ("Masuk ke SIX"), offline (the cell
  keeps its class: a cell has no room to say more, and the time is still true).
- Model: `nextWidget(facts)` (now with the course's `name`, and `empty.short`).

### 7. Pintasan (`Services`): "Take me straight to Jadwal, Tugas, Kuliah or Nilai"

| Size | Shows |
| --- | --- |
| 2×1 (min) | Two solid tiles (Jadwal, Tugas), a white filled glyph, the word under each |
| 4×1 (first) | All four: blue, orange, purple, green |
| 2×2, 4×2 and up | All four as blocks that fill the widget, two by two, the glyph and the word inside each |

- Taps: each opens its tab or screen. One state: it says nothing that changes.
- Model: `servicesWidget(facts)`.

### 8. Satu mata kuliah (`Course`): "How is this one course going?"

The whole widget in the course's colour.

| Size | Shows |
| --- | --- |
| 2×2 (min) | The name (three lines), its next class ("08:00", "Besok 08:00"), its absences as marks with "Sisa 1×", its next Task |
| 3×2 (first) | The name, the code under it, the class with its day, time and room, the marks and "Sisa jatah absen 1×", the Task, the foot |
| 4×2, 4×3 (max) | The same with the Task's title over two lines |

- A danger (absences gone or past the limit): a white pill, the word in red or amber.
- Which course: as before (`src/widget/configure.tsx`, `choice.ts`).
- Taps: the block opens the course, the class its sheet on Jadwal, the Task the Task.
- States: never opened / no courses, offline (in the block). A course with no class ahead or no Task leaves that
  line out.
- Model: `courseWidget(facts, code)` (now with `marks`).

## The pictures, without a phone

`node mobile/scripts/render-widgets.mjs <folder>` draws every widget at its smallest, a step between, its first and
its largest size, light and dark, in its normal state and in each of empty, signed out, offline and holiday, from
the pretend Student's Thursday, on a wallpaper-like background: one PNG per picture (`<widget>/<widget>-<state>-<size>-<look>.png`),
one contact sheet per widget (`<widget>-sheet.png`), and `report.txt`, which lists every line the browser cut and
every widget whose parts ran past its edge. It runs `test/mobile/widget-drawings.test.tsx` with `WIDGET_RENDER`
(the real trees walked into web pages) and photographs them with the root's Playwright. An approximation of
Android's drawing (CSS flexbox for the library's Yoga, the Mac's font for Roboto): the phone is still the real check.

The picker's preview pictures (`assets/widget-preview-*.png`, made by `scripts/make-widget-previews.mjs`) are native
assets and still show the first layouts: a white card of text lines for Sekarang, Ujian, Kelas berikutnya and Satu
mata kuliah (now colour blocks), pale tiles for Pintasan (now solid), words for Kehadiran (now marks). They want
remaking from these drawings in the next build.

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

## How it was checked

`test/mobile/widget-drawings.test.tsx` walks the real trees for all eight widgets, at 4–5 sizes each, light and
dark, at text size 1 and 1.3. It checks every tap (a deep link into the app, or an https page), the exact target of
each row, that Sekarang says each thing once and names its course whole, and that Kehadiran draws one mark per
absence. Text size 1.3 is planned for (line heights grow with it, so fewer rows fit).

## iPhone

Every model function returns plain data (no functions, colours as the course's tone name), so a WidgetKit
extension can be fed the same JSON: `Due`, `Attendance`, `Exam`, `Next`, `Course` map to small, medium and large
families. The iPhone side needs Swift and an app group, so nothing of it is built tonight (`IOS.md`).

The model's shape is unchanged for `src/widget-ios/**`: the redesign only added fields. What the iPhone side should
mirror from it: the presence button's word (`actions[].short`, "Isi Presensi", with the close time as `detail`); a
class's `name` on Hari ini's rows, on Ujian (`kind` + `name`) and on Kelas berikutnya; Kehadiran's marks (`allowed`,
`used`, `over` per row, `marks` on Satu mata kuliah); `empty.short` for a one-cell holiday. And the look: one course
as one block in its colour with white on it, lists on the widget's surface with a colour bar and the time first, a
name whole before its code.
