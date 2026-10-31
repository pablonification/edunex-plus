# Round 2: three design directions

Static mockups for Arqila to choose from before any more screen code (PROGRESS.md, Decision 23). Beranda, Jadwal and
the class sheet, light and dark, 390 dp wide (PNGs at 2×), with the demo's data (Thursday 8 Oct 2026, 08:07). Open
`overview.html` for all three side by side, each key moment playing.

Word counts: the words a person sees above the tab bar with no scrolling (`words.json`); target in the 40s.

| Direction | Idea | Beranda | Jadwal | Class sheet |
| --- | --- | ---: | ---: | ---: |
| A · Tenang | Calm, like Todoist: a white page, one spotlight (the class now), flat rows without cards; blue only means "tap here" | 47 | 49 | 20 |
| B · Sorot | Playful, like GoPay and Gojek: a brand-blue band, the class now as a floating white card, colourful shortcuts, swipeable cards | 41 | 42 | 23 |
| C · Linimasa | Your day as a timeline: a big clock, the class now as the focused stop with a countdown ring, one accent colour | 38 | 42 | 25 |

Motion, per direction:

- **A:** press shrinks rows and buttons to 0.97 on a spring under Android's ripple; swiping a need past 40% gives a
  haptic tick, it slides out, the rest closes up, a snackbar offers Urungkan; Tandai Hadir gives a haptic, and back
  from SIX the button becomes a check that draws itself; first open staggers rows in 30 ms apart; numbers count up.
- **B:** the class card floats up on a slightly bouncy spring; shortcuts squish to 0.94 with a light haptic; Tandai
  Hadir morphs into a green circle, the check draws itself, a burst of colour dots; need cards snap sideways; numbers
  in the sheet count up.
- **C:** the stop on now breathes; its ring of time left shrinks each minute; the big clock shrinks into the top bar
  on scroll; Tandai Hadir fills the ring into a drawn check; the count pills count up and open their list on a spring.

Navigation stays Android's own in all three (native tabs, predictive back, native sheets).
