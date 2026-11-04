# Changing what's on screen

How a change to a screen, its words or its icons is made and handed over. Two ideas run through it:
**user-centred design** (the Student in the real window is the judge, not the code or the diff) and
**show, don't tell** (a picture or an example before a sentence, on screen and when asking the
developer). The rules it is judged by
are in `docs/design-system.md` (Less to read, Icons, Layout parts); words go through the
`copywriting` skill. The developer audits the real window, never the code, so every step runs on the
demo's made-up data.

1. **Look at the real window first.** `npm run demo:build`, then
   `node scripts/demo/capture.mjs .scratch/ui/before` (37 states, light and dark, both languages).
   Done when you have read the picture of every screen the change touches.
2. **Make the change** by the design system. A shared part (an icon, a meter, a button) changes every
   screen that uses it: list them before editing, with `grep -rn "Icons.ArrowUpRight" src/app` and
   the like.
3. **Check it in pictures.** `npm run check`, rebuild the demo, capture `.scratch/ui/after`, and read
   the after picture of every screen from step 2's list beside its before. Done when each is right in
   the picture: alignment, buttons keeping their width, a filled icon keeping its meaning, nothing
   lost that had no other place.
4. **Measure, then say it.** A number told to the developer (words on a screen, a size, a cut) comes
   from the demo: words are `document.querySelector("main").innerText` split on whitespace, at
   1280×800.
5. **Hand it over for audit.** `node scripts/demo/audit-page.mjs .scratch/ui/before .scratch/ui/after
   --title "…" --note "…"` builds a page with each screen before and after, an OK box and a note;
   open it for the developer. They paste back "Audit notes:" lines. Work through every note, then
   hand over a page with only the screens that changed (`--only 02-beranda-hari-ini,04-tugas`).
   Done when every screen in the last round is OK.
6. **Ask with pictures.** A choice the developer makes (a label, a default, what to cut) comes with a
   real picture of each option, cropped from the demo, your pick marked and said why.
