// SIX as a source (#76): the `khongguan` cookie as the session; a redirect to
// /login ends it. Pages are read at human pace, one at a time, through one
// client (SixPages) that every SIX reader shares, "Tandai Hadir" during class too.
import { z } from "zod";
import { EngineError } from "../../errors";
import type { Source } from "../source";
import { checkInPressed, registerSixCheckInFeed } from "./check-in";
import { SIX_ORIGIN, SixClient } from "./client";
import { registerSixFeeds } from "./feeds";
import { registerSixRecordFeeds } from "./records";

/** The Cookie header that carries the session: "khongguan=…". */
export const SixSession = z.object({ cookie: z.string().min(1) });
export type SixSession = z.infer<typeof SixSession>;

export const six: Source<SixSession> = {
  id: "six",
  session: SixSession,
  liveness: "six.status",
  start(context, session, resumed) {
    // Opened again with this session's data: the Student's NIM is known, so the first page read is their status,
    // not SIX's home page to find it (a page, 2 s at SIX's pace). After a sign-in it may be another Student's.
    const saved = resumed ? context.get("six.student") : undefined;
    const known = { identity: saved ? { nim: saved.nim, studentId: saved.studentId, term: saved.term } : null, reading: null };
    const client = new SixClient(context.transport, context.clock, session.cookie, context.userAgent, context.pace(new URL(SIX_ORIGIN).host), known);
    // One client, so every SIX page (status, timetable, records) waits in the same line.
    registerSixFeeds(context, client);
    registerSixRecordFeeds(context, client);
    registerSixCheckInFeed(context, client);
  },
  actions: {
    /** The app's SIX window saw the Student press something in a class's popup ({ meetingId }). */
    async checkInPressed(context, _session, input) {
      const parsed = z.object({ meetingId: z.string().regex(/^\d{1,20}$/) }).safeParse(input);
      if (!parsed.success) throw new EngineError("Rejected", "Not a SIX meeting");
      await checkInPressed(context, parsed.data.meetingId);
      return {};
    },
  },
};
