// The phone's routes as plain types, with no import of the router: the widget's model and the tests that read phone
// code outside the phone's own type program take them from here (nav.ts, which moves between them, re-exports them).
import type { Route as WindowRoute } from "../../src/core/route";

/**
 * A place the phone has and the window doesn't: Materi (every course's material in one list) and Ujian (every exam).
 * Kept here, not in src/core/route.ts, which the desktop, alerts and links share.
 */
export type PhoneRoute = { screen: "material" } | { screen: "exams" };

/** Where the Student can go on the phone: the window's routes and the phone's own. */
export type Route = WindowRoute | PhoneRoute;
