// SIX as a source (#76): the `khongguan` cookie as the session; a redirect to
// /login ends it. Pages are read at human pace, one at a time, through one
// client (SixPages) that every SIX reader shares.
import { z } from "zod";
import type { Source } from "../source";
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
  start(context, session) {
    const client = new SixClient(context.transport, context.clock, session.cookie, context.userAgent, context.pace(new URL(SIX_ORIGIN).host));
    // One client, so every SIX page (status, timetable, records) waits in the same line.
    registerSixFeeds(context, client);
    registerSixRecordFeeds(context, client);
  },
};
