// SIX's "Tandai Hadir" (mark present): during a class, the class's popup on
// SIX's timetable can show a button the Student presses to be counted
// present. The app never presses it. While a class is on (from a few minutes
// before it starts to a few after it ends), it reads that popup every two
// minutes, the way the timetable loads it, so the Student hears the moment the
// button shows and can press it in SIX themselves. A popup is one small page:
// one class means about one SIX request every two minutes, at human pace in
// SIX's shared line, and nothing at all outside class.
import { CHECK_IN_EVERY, checkingIn } from "../../../core/check-in";
import { sixMeetingPath } from "../../../core/links";
import type { SixCheckIn } from "../../../core/models";
import { isEngineError } from "../../errors";
import type { SourceContext } from "../source";
import { clean, parse } from "./html";
import type { SixPages } from "./pages";

/** What was seen is kept this long, so Beranda still knows after the class. */
const KEEP = 2 * 24 * 3_600_000;

/**
 * The button's words, as SIX writes them, and as its English pages might
 * (never recorded). The popup itself was never recorded either, so the button
 * is found by its words, the one thing known about it: anything else on the
 * popup, or a button SIX shows but disables, isn't it.
 */
const BUTTON = /^(tandai hadir|mark (as )?(present|attendance))$/i;

/** Whether a class's popup shows the "Tandai Hadir" button, ready to press. */
export function showsCheckIn(html: string): boolean {
  const $ = parse(html);
  return $("button, a, input[type=submit], input[type=button]")
    .toArray()
    .some((element) => {
      const button = $(element);
      if (button.is("[disabled], .disabled, [aria-disabled=true]")) return false;
      return BUTTON.test(clean(button.is("input") ? (button.attr("value") ?? "") : button.text()));
    });
}

/** What reading the popup again says, from what was known before. */
export function nextCheckIn(before: SixCheckIn | undefined, shows: boolean, now: number): SixCheckIn {
  const state = shows ? "open" : before?.state === "open" || before?.state === "gone" ? "gone" : "waiting";
  return before?.state === state ? before : { state, since: now };
}

export function registerSixCheckInFeed(context: SourceContext, pages: SixPages): void {
  context.feed({
    name: "six.checkIn",
    every: CHECK_IN_EVERY,
    jitter: 20_000,
    async run(current) {
      const now = context.clock.now();
      const saved = context.get("six.checkIn");
      const kept = Object.fromEntries(Object.entries(saved ?? {}).filter(([, check]) => now - check.since < KEEP));
      // A class whose button came and went is done: it isn't read again.
      const due = (context.get("six.schedule") ?? []).filter((session) => checkingIn(session, now) && kept[session.id]?.state !== "gone");
      if (!due.length) {
        if (saved && Object.keys(kept).length !== Object.keys(saved).length) await context.set("six.checkIn", kept);
        return;
      }
      // The first value after sign-in is silent for alerts: an empty one first, so a button already showing isn't.
      if (saved === undefined) await context.set("six.checkIn", {});
      const who = await pages.who();
      const next = { ...kept };
      let failed: unknown = null;
      for (const session of due) {
        let html: string;
        try {
          html = await pages.page(sixMeetingPath(who, session.id), { popup: true });
        } catch (error) {
          // Offline or signed out is all of SIX: no use reading on. Anything else is this class's popup; the next class is still read.
          if (isEngineError(error, "Offline") || isEngineError(error, "Unauthorized")) throw error;
          failed ??= error;
          continue;
        }
        if (!current()) return;
        next[session.id] = nextCheckIn(next[session.id], showsCheckIn(html), context.clock.now());
      }
      await context.set("six.checkIn", next);
      if (failed) throw failed;
    },
  });
}
