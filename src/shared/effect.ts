import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { createRequire } from "node:module";

const effectRuntime = createRequire(__filename)("effect") as typeof EffectModule;

/**
 * Values that may contain credentials or other private material must cross
 * trusted boundaries in a redacted wrapper. The schema intentionally refuses
 * to encode the value so it cannot accidentally be put on IPC or JSON.
 */
export const SensitiveStringSchema = effectRuntime.Schema.RedactedFromValue(effectRuntime.Schema.String, {
  disallowEncode: true,
});

export type SensitiveString = typeof SensitiveStringSchema.Type;

export function sensitiveString(value: string): SensitiveString {
  return effectRuntime.Redacted.make(value);
}

export const BoundarySchema = effectRuntime.Schema.Literals([
  "api",
  "ipc",
  "persistence",
  "lifecycle",
]);
export type Boundary = typeof BoundarySchema.Type;

/**
 * Public errors carry only stable, non-sensitive context. The original
 * failure remains in Effect's Cause at the boundary that handles it; it is
 * never copied into a renderer-facing error or a typed domain error field.
 */
export class BoundaryValidationError extends effectRuntime.Schema.TaggedError<BoundaryValidationError>()(
  "BoundaryValidationError",
  {
    boundary: BoundarySchema,
    operation: effectRuntime.Schema.String,
  },
) {}

export const LifecyclePhaseSchema = effectRuntime.Schema.Literals(["startup", "shutdown"]);
export type LifecyclePhase = typeof LifecyclePhaseSchema.Type;

export class ApplicationLifecycleError extends effectRuntime.Schema.TaggedError<ApplicationLifecycleError>()(
  "ApplicationLifecycleError",
  {
    phase: LifecyclePhaseSchema,
    operation: effectRuntime.Schema.String,
  },
) {}

export const SafeCauseReasonSchema = effectRuntime.Schema.Union([
  effectRuntime.Schema.Struct({
    _tag: effectRuntime.Schema.Literal("Failure"),
    errorTag: effectRuntime.Schema.String,
  }),
  effectRuntime.Schema.Struct({ _tag: effectRuntime.Schema.Literal("Defect") }),
  effectRuntime.Schema.Struct({ _tag: effectRuntime.Schema.Literal("Interrupt") }),
]);

export type SafeCauseReason = typeof SafeCauseReasonSchema.Type;
export const SafeCauseSchema = effectRuntime.Schema.Array(SafeCauseReasonSchema);
export type SafeCause = typeof SafeCauseSchema.Type;

/**
 * Reduce an Effect Cause to diagnostics that cannot expose arbitrary error
 * messages, exception objects, request bodies, or credentials.
 */
export function safeCause(cause: EffectModule.Cause.Cause<unknown>): SafeCause {
  return cause.reasons.map((reason): SafeCauseReason => {
    if (effectRuntime.Cause.isFailReason(reason)) {
      return { _tag: "Failure", errorTag: safeErrorTag(reason.error) };
    }
    if (effectRuntime.Cause.isDieReason(reason)) return { _tag: "Defect" };
    return { _tag: "Interrupt" };
  });
}

export function formatSafeCause(cause: EffectModule.Cause.Cause<unknown>): string {
  const reasons = safeCause(cause);
  if (reasons.length === 0) return "empty";
  return reasons
    .map((reason) =>
      reason._tag === "Failure" ? `Failure(${reason.errorTag})` : reason._tag,
    )
    .join(", ");
}

/**
 * Decode an unknown value at a named boundary without leaking the input or
 * Effect's verbose schema issue into a public typed error.
 */
export function decodeBoundary<S extends EffectModule.Schema.Constraint>(
  schema: S,
  input: unknown,
  boundary: Boundary,
  operation: string,
): EffectModule.Effect.Effect<S["Type"], BoundaryValidationError, S["DecodingServices"]> {
  return effectRuntime.Schema.decodeUnknownEffect(schema)(input).pipe(
    effectRuntime.Effect.mapError(() => new BoundaryValidationError({ boundary, operation })),
  );
}

function safeErrorTag(error: unknown): string {
  if (typeof error !== "object" || error === null) return "UnknownFailure";
  const tag = (error as { readonly _tag?: unknown })._tag;
  return typeof tag === "string" && /^[A-Z][A-Za-z0-9]*$/.test(tag)
    ? tag
    : "UnknownFailure";
}
