# v4: v3's calm layout, with the life put back

Arqila found v3 "still very plain". Mostly that was the design, not the fact that it was a still. v3 kept the
reference apps' skeleton (a blue header, white rows) and dropped what makes them look alive even in a screenshot.
v4 puts those back, each from a real app. No gradients, glass, emoji or blobs.

- **Course colour you can see.** Each course gets a tinted tile and a filled two-tone icon, like Grab's and GoPay's
  service tiles. v3 had thin outline icons on white.
- **Numbers first.** "Perlu kamu urus" is two tinted cards, each led by a big countdown ("7 hari"). GoPay leads with
  the balance the same way.
- **A brand typeface.** Plus Jakarta Sans (made in Jakarta) for headings and numbers. Roboto for body text.
- **Android's own expressive parts.** Material 3 Expressive's wavy progress shows how far the class has gone. After
  Tandai Hadir, a cookie shape appears and its check draws itself.
- **Motion you can try.** `v4-live.html` (built by `build.mjs`) has it. Presses give and spring back, cards rise in a
  stagger and numbers count up. The wave moves. Tandai Hadir turns into the check. A class row opens the sheet over
  a scrim that fades in, and the sheet rises on a spring.

Words above the tab bar: Beranda 48, Jadwal 40, class sheet 14. Every colour pair passes contrast.py (AA).
