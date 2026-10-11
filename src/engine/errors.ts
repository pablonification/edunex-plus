import type { ErrorKind } from "../core/contract";

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
