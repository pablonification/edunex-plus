// SIX as a source (#76): the `khongguan` cookie as the session; a redirect to
// /login ends it. Pages are read at human pace, one at a time.
import { z } from "zod";
import type { Source } from "../source";

export const SixSession = z.object({ cookie: z.string().min(1) });
export type SixSession = z.infer<typeof SixSession>;

export const six: Source<SixSession> = {
  id: "six",
  session: SixSession,
  liveness: "six.status",
  start() {},
};
