// What every source gives the engine: how its saved session looks, which feed
// proves the session is alive, its feeds, and its explicit actions (writes
// the Student asks for). Edunex and SIX need a session; ITB's public pages
// (academic calendar, course catalog) don't.
import type { z } from "zod";
import type { DatasetName, DatasetValue, Settings, SkippedRow, SourceId } from "../../core/models";
import type { Clock } from "../clock";
import type { Pace } from "../http/pace";
import type { Transport } from "../http/transport";

export interface FeedSpec {
  /** "<source>.<what>", e.g. "edunex.tasks". */
  name: string;
  /** Normal time between runs (ms). */
  every: number;
  /** Up to this much is added or removed at random each time (ms). */
  jitter: number;
  /**
   * Runs only on its own schedule, never on "Perbarui sekarang": public
   * reference data that changes a few times a year and takes minutes to read
   * (ITB's catalog), which a refresh would otherwise wait on, or a feed another
   * one starts when it has read what this one needs (the threads under the
   * Student's answers, once the Tasks are read). Getting no answer doesn't mark
   * the source offline: it just tries again later.
   */
  background?: boolean;
  /**
   * The datasets this feed fills from one page of the source. When that page's layout changes, the
   * screens showing them say so and keep the last data, and the source isn't "changed" as a whole.
   * Without it (the page the whole session rests on), a change is the whole source's.
   */
  shows?: readonly DatasetName[];
  /**
   * The datasets a part of this feed's page fills when that part can change alone (SIX's course
   * table, on the page the session rests on). The feed stores what the rest of the page says and
   * throws PartChanged: those datasets keep their last data and their screens say so, as for
   * `shows`. Any other change is still the whole source's.
   */
  part?: readonly DatasetName[];
  /** `current()` turns false once the session this run started under has ended; store nothing then. */
  run(current: () => boolean): Promise<void>;
}

/** What a source can reach while its session is on. */
export interface SourceContext {
  transport: Transport;
  clock: Clock;
  /** "EdunexPlus/<version> (+repo)": every request says who it is. */
  userAgent: string;
  settings(): Settings;
  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined;
  /**
   * Stores a fresh value; the screens hear about it only when it changed. `skipped`: the rows of the
   * page it came from that the reader left out (./skipped.ts), kept in "<source>.skipped" for the
   * screens to say so; none clears what an earlier read left out.
   */
  set<N extends DatasetName>(name: N, value: DatasetValue<N>, skipped?: readonly SkippedRow[]): Promise<boolean>;
  /** Forgets every dataset whose name starts with `prefix`. */
  remove(prefix: string): Promise<void>;
  feed(spec: FeedSpec): void;
  /** Runs matching feeds now (a new-Task signal, a fresh session). */
  runNow(match: (feed: string) => boolean): Promise<void>;
  /** The line every source shares for one website ("six.itb.ac.id"), so together they stay at human pace. */
  pace(site: string): Pace;
}

/** A write the Student asked for, run with the source's current session. */
export type SourceAction<S> = (context: SourceContext, session: S, input: unknown) => Promise<unknown>;

export interface Source<S = unknown> {
  id: SourceId;
  /** The saved session's shape; null for sources that need no sign-in. */
  session: z.ZodType<S> | null;
  /** The feed whose refusal (Unauthorized) means the session has ended. */
  liveness: string | null;
  /** Registers the source's feeds for this session. */
  start(context: SourceContext, session: S): void;
  actions?: Record<string, SourceAction<S>>;
}
