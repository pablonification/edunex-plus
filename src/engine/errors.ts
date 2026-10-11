import type { ErrorKind } from "../core/contract";

/** A failure the engine understands; its kind decides the source status and what the screens say. */
export class EngineError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export const isEngineError = (error: unknown, kind?: ErrorKind): error is EngineError =>
  error instanceof EngineError && (kind === undefined || error.kind === kind);
