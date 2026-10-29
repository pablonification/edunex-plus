import type { ErrorKind } from "../core/contract";
import type { AnswerCheck } from "./http/transport";

/** A failure the engine understands; its kind decides the source status and what the screens say. */
export class EngineError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    /**
     * Offline only: no answer came at all (no connection, it broke, none in
     * time), so any later answer from the same source ends it; a refusal
     * (a 5xx or 429 answer) lasts until that call works again.
     */
    readonly unreachable = false,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export const isEngineError = (error: unknown, kind?: ErrorKind): error is EngineError =>
  error instanceof EngineError && (kind === undefined || error.kind === kind);

/**
 * SIX changed one part of a page whose rest still read (the course table on the status page, which
 * also says who the Student is): the feed stored what it could read. Only the datasets that part
 * fills (FeedSpec.part) keep their last data and say so on their screens; the source stays live.
 */
export class PartChanged extends EngineError {
  constructor(message: string) {
    super("VendorChanged", message);
  }
}

/**
 * An answer that didn't pass its caller's check (an Edunex answer against its schema), carrying that answer as it came.
 * A read can go on past it (the Tasks feed reads every course's list before it says one failed), so a report keeps this
 * answer, not the last one the read got (src/engine/report/kept-pages.ts).
 */
export class AnswerError extends EngineError {
  constructor(
    error: EngineError,
    readonly answer: { url: string; status: number; body: string; check: AnswerCheck },
  ) {
    super(error.kind, error.message, error.unreachable);
  }
}
