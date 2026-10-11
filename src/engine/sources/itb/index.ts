// ITB's public pages as a source (#84): the academic calendar and SIX's
// public course catalog. No sign-in; fetched politely and cached for days.
import type { Source } from "../source";

export const itb: Source<null> = {
  id: "itb",
  session: null,
  liveness: null,
  start() {},
};
