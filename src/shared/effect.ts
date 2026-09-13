import type * as EffectModule from "effect" with { "resolution-mode": "import" };

/**
 * Build the shared Effect conventions for a host's Effect module. The shared
 * module contains no Node.js runtime imports, so the renderer can instantiate
 * it with its bundled ESM import while the main process uses its CommonJS
 * compatibility adapter.
 */
export function createEffectConventions(effectRuntime: typeof EffectModule) {
  const { Cause, Effect, Redacted, Schema } = effectRuntime;

  /**
   * Values that may contain credentials or other private material must cross
   * trusted boundaries in a redacted wrapper. The schema intentionally refuses
   * to encode the value so it cannot accidentally be put on IPC or JSON.
   */
  const SensitiveStringSchema = Schema.RedactedFromValue(Schema.String, {
    disallowEncode: true,
  });

  function sensitiveString(value: string): typeof SensitiveStringSchema.Type {
    return Redacted.make(value);
  }

  const BoundarySchema = Schema.Literals([
    "api",
    "ipc",
    "persistence",
    "lifecycle",
  ]);

  const SAFE_OPERATION_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
  const OperationSchema = Schema.String.check(
    Schema.isPattern(SAFE_OPERATION_PATTERN, {
      message: "expected a stable operation identifier",
    }),
  );

  function safeOperation(operation: string): typeof OperationSchema.Type {
    return SAFE_OPERATION_PATTERN.test(operation) ? operation : "unknown";
  }

  /**
   * Public errors carry only stable, non-sensitive context. Verbose parse
   * details are discarded at the public boundary; unexpected failures remain
   * available through Effect's Cause and the safe diagnostic helpers.
   */
  class BoundaryValidationError extends Schema.TaggedError<BoundaryValidationError>()(
    "BoundaryValidationError",
    {
      boundary: BoundarySchema,
      operation: OperationSchema,
    },
  ) {}

  const LifecyclePhaseSchema = Schema.Literals(["startup", "shutdown"]);

  class ApplicationLifecycleError extends Schema.TaggedError<ApplicationLifecycleError>()(
    "ApplicationLifecycleError",
    {
      phase: LifecyclePhaseSchema,
      operation: OperationSchema,
    },
  ) {}

  class RuntimeUnavailableError extends Schema.TaggedError<RuntimeUnavailableError>()(
    "RuntimeUnavailableError",
    {
      operation: OperationSchema,
    },
  ) {}

  const SafeCauseReasonSchema = Schema.Union([
    Schema.Struct({
      _tag: Schema.Literal("Failure"),
      errorTag: Schema.String,
    }),
    Schema.Struct({ _tag: Schema.Literal("Defect") }),
    Schema.Struct({ _tag: Schema.Literal("Interrupt") }),
  ]);
  const SafeCauseSchema = Schema.Array(SafeCauseReasonSchema);

  /**
   * Reduce an Effect Cause to diagnostics that cannot expose arbitrary error
   * messages, exception objects, request bodies, or credentials.
   */
  function safeCause(cause: EffectModule.Cause.Cause<unknown>): typeof SafeCauseSchema.Type {
    return cause.reasons.map((reason) => {
      if (Cause.isFailReason(reason)) {
        return { _tag: "Failure" as const, errorTag: safeErrorTag(reason.error) };
      }
      if (Cause.isDieReason(reason)) return { _tag: "Defect" as const };
      return { _tag: "Interrupt" as const };
    });
  }

  function formatSafeCause(cause: EffectModule.Cause.Cause<unknown>): string {
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
  function decodeBoundary<S extends EffectModule.Schema.Constraint>(
    schema: S,
    input: unknown,
    boundary: typeof BoundarySchema.Type,
    operation: string,
  ): EffectModule.Effect.Effect<
    S["Type"],
    InstanceType<typeof BoundaryValidationError>,
    S["DecodingServices"]
  > {
    return Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.mapError(
        () => new BoundaryValidationError({ boundary, operation: safeOperation(operation) }),
      ),
    );
  }

  function safeErrorTag(error: unknown): string {
    if (typeof error !== "object" || error === null) return "UnknownFailure";
    const tag = (error as { readonly _tag?: unknown })._tag;
    return typeof tag === "string" && /^[A-Z][A-Za-z0-9]*$/.test(tag)
      ? tag
      : "UnknownFailure";
  }

  return {
    SensitiveStringSchema,
    sensitiveString,
    BoundarySchema,
    OperationSchema,
    safeOperation,
    BoundaryValidationError,
    LifecyclePhaseSchema,
    ApplicationLifecycleError,
    RuntimeUnavailableError,
    SafeCauseReasonSchema,
    SafeCauseSchema,
    safeCause,
    formatSafeCause,
    decodeBoundary,
  };
}

export type EffectConventions = ReturnType<typeof createEffectConventions>;
