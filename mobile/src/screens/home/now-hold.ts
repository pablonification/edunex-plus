// The now card while the first read runs (or the demo's first sync): picked from half the data, it changed under the
// Student's eyes. Edunex's English name became SIX's Indonesian one, a "Catat di Edunex" came and went, and "Presensi
// sedang dibuka · 08:00–09:30 · 80 mnt lagi" became "Sekarang · R.SG PWK LT.6 · 110 mnt lagi". So it shows what won't
// change (the course's colour, its official name once known) and holds the rest in its place until the read is in.
export interface NowHold {
  /** The course's name, and the glyph its name picks: until the official one is known. */
  name: boolean;
  /** The line over the name, the wave and the minutes left, and the card's button: until SIX (and Edunex) have spoken. */
  line: boolean;
  /** No card yet, but SIX is coming with the timetable: the card's shape stands in its place. */
  shape: boolean;
}

/**
 * What the now card holds back. `reading`: the first read (or the demo's first sync) runs. `official`: the card's
 * course is named as SIX or ITB's catalog names it (TermCourseBase.official). `hasCard`: there's a class or window to show. `sixComing`: SIX is
 * signed in or signing in, so a timetable (and with it a card, or the free week's line) is on its way.
 */
export function nowHold({ reading, official, hasCard, sixComing }: { reading: boolean; official: boolean; hasCard: boolean; sixComing: boolean }): NowHold {
  return {
    name: reading && hasCard && !official,
    line: reading && hasCard,
    shape: reading && !hasCard && sixComing,
  };
}
