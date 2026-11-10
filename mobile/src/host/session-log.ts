// A QA build's "[session]" lines (EXPO_PUBLIC_R3_GUARD=1): whether Edunex's and SIX's sessions are live, ended or
// absent, once at start and again whenever either changes, read from the statuses the engine publishes (what the
// screens show as "Terhubung" or a session ended). States only, never a session.
import type { SourceState, SourceStatus } from "../../../src/core/models";

export type SessionWord = "live" | "ended" | "none";

/** Signed out (or never signed in): none; its session ran out: ended; any other state holds a session: live. */
export function sessionWord(state: SourceState | undefined): SessionWord {
  if (!state || state === "signed-out") return "none";
  return state === "expired" ? "ended" : "live";
}

export function sessionLog(log: (line: string) => void = console.info) {
  const states = new Map<string, SourceState>();
  let ready = false;
  let last: string | null = null;
  const say = () => {
    const line = `[session] edunex=${sessionWord(states.get("edunex"))} six=${sessionWord(states.get("six"))}`;
    if (line === last) return;
    last = line;
    log(line);
  };
  return {
    /** The statuses once the engine has loaded: the first line. */
    begin(statuses: readonly Pick<SourceStatus, "source" | "state">[]): void {
      for (const status of statuses) states.set(status.source, status.state);
      ready = true;
      say();
    },
    /** A status the engine published: a line when Edunex's or SIX's word changed. */
    saw(status: Pick<SourceStatus, "source" | "state">): void {
      states.set(status.source, status.state);
      if (ready) say();
    },
  };
}
