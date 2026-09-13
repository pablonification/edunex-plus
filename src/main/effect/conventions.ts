import { createEffectConventions } from "../../shared/effect";
import { effectRuntime } from "./effect-runtime";

const conventions = createEffectConventions(effectRuntime);

export const {
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
} = conventions;

export type SensitiveString = typeof SensitiveStringSchema.Type;
export type Boundary = typeof BoundarySchema.Type;
export type Operation = typeof OperationSchema.Type;
export type LifecyclePhase = typeof LifecyclePhaseSchema.Type;
export type SafeCauseReason = typeof SafeCauseReasonSchema.Type;
export type SafeCause = typeof SafeCauseSchema.Type;
