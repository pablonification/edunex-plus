// SIX's "Tandai Hadir" (mark present): when the app reads a class's popup on
// SIX for the button (src/engine/sources/six/check-in.ts), shared with
// Beranda, which says what it saw.
import type { ClassSession } from "./models";

const MINUTE = 60_000;
/** The popup is read from this long before the class starts… */
export const CHECK_IN_EARLY = 5 * MINUTE;
/** …to this long after it ends: a lecturer may open it at the end. */
export const CHECK_IN_LATE = 10 * MINUTE;
/** How often, while a class is on. */
export const CHECK_IN_EVERY = 2 * MINUTE;

/** While the app reads the class's popup for its button. */
export const checkingIn = (session: Pick<ClassSession, "start" | "end">, now: number) =>
  session.start - CHECK_IN_EARLY <= now && now <= session.end + CHECK_IN_LATE;
