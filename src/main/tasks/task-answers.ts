import type { ApiResult } from "../api/client";
import type {
  SaveDraftInput,
  SaveDraftResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
} from "../../shared/submission";
import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import { AuthService, type AuthServiceShape } from "../auth/auth-service";

/** The task-answer command surface is an Effect service, not a background job. */
export type TaskAnswerEffect<A> = EffectModule.Effect.Effect<A, never, never>;

export interface TaskAnswerServiceShape {
  readonly saveDraft: (input: SaveDraftInput) => TaskAnswerEffect<SaveDraftResult>;
  readonly submit: (input: SubmitAnswerInput) => TaskAnswerEffect<SubmitAnswerResult>;
  /** Name-aligned alias for callers that use the API operation name. */
  readonly submitAnswer: (input: SubmitAnswerInput) => TaskAnswerEffect<SubmitAnswerResult>;
}

export class TaskAnswerService extends effectRuntime.Context.Service<
  TaskAnswerService,
  TaskAnswerServiceShape
>()("EdunexPlus/TaskAnswerService") {}

export type TaskAnswerLayer = EffectModule.Layer.Layer<TaskAnswerService, never, AuthService>;

export interface DraftApi {
  createDraftAnswer(taskId: string, answer: string, signal?: AbortSignal): Promise<ApiResult>;
  updateDraftAnswer(
    answerId: string,
    taskId: string,
    answer: string,
    signal?: AbortSignal,
  ): Promise<ApiResult>;
}

export interface SubmitApi {
  submitAnswer(answerId: string, signal?: AbortSignal): Promise<ApiResult>;
}

/**
 * Draft-save write path (issue #25, verified contract in #16).
 * Chooses create (POST /course/task/answers, 201) when no answer id is
 * known, else update (PATCH /course/task/answers/{answerId}, 200). Both
 * send `is_sent: 0`. Explicit-only: called solely from the Save-draft IPC
 * handler on a deliberate click — never from sync or background paths.
 */
export async function saveDraftAnswer(
  api: DraftApi,
  input: SaveDraftInput,
  signal?: AbortSignal,
): Promise<SaveDraftResult> {
  const invalid = invalidSaveDraftResult(input);
  if (invalid) return invalid;
  const taskId = input.taskId.trim();
  const answerId = input.answerId?.trim() ? input.answerId.trim() : null;
  if (!taskId) return { ok: false, status: 400, created: false, answerId: null };

  const result = answerId
    ? signal === undefined
      ? await api.updateDraftAnswer(answerId, taskId, input.answer)
      : await api.updateDraftAnswer(answerId, taskId, input.answer, signal)
    : signal === undefined
      ? await api.createDraftAnswer(taskId, input.answer)
      : await api.createDraftAnswer(taskId, input.answer, signal);
  if (!isApiResult(result)) {
    return { ok: false, status: 0, created: answerId === null, answerId };
  }
  const ok = isSuccessful(result);
  return {
    ok,
    status: result.status,
    created: answerId === null,
    answerId: ok ? (extractAnswerId(result.body) ?? answerId) : answerId,
  };
}

/**
 * Final-submit write path (issue #26, captured contract in #12). A saved
 * answer is submitted by flipping only `is_sent` through the existing answer
 * PATCH endpoint. Explicit-only: this is called solely from the Submit IPC
 * handler after a deliberate user click.
 */
export async function submitAnswer(
  api: SubmitApi,
  input: SubmitAnswerInput,
  signal?: AbortSignal,
): Promise<SubmitAnswerResult> {
  if (!isSubmitAnswerInput(input)) return { ok: false, status: 400 };
  const answerId = input.answerId.trim();
  if (!answerId) return { ok: false, status: 400 };

  const result = signal === undefined
    ? await api.submitAnswer(answerId)
    : await api.submitAnswer(answerId, signal);
  if (!isApiResult(result)) return { ok: false, status: 0 };
  return { ok: isSuccessful(result), status: result.status };
}

/**
 * Supplies the explicit Task Answer commands from the authenticated API. The
 * service deliberately has no retry, queue, timer, or sync dependency: one
 * invocation is one POST/PATCH attempt, and only the renderer's command IPC
 * can invoke it.
 */
export function createTaskAnswerLayer(): TaskAnswerLayer {
  return effectRuntime.Layer.effect(
    TaskAnswerService,
    effectRuntime.Effect.gen(function* () {
      const auth = yield* AuthService;
      return createTaskAnswerService(auth);
    }),
  ) as TaskAnswerLayer;
}

export const TaskAnswerServiceLive = createTaskAnswerLayer;
export const createTaskAnswerServiceLayer = createTaskAnswerLayer;

function createTaskAnswerService(auth: AuthServiceShape): TaskAnswerServiceShape {
  function saveDraft(input: SaveDraftInput): TaskAnswerEffect<SaveDraftResult> {
    const invalid = invalidSaveDraftResult(input);
    if (invalid) return effectRuntime.Effect.succeed(invalid);
    const fallback = saveDraftFailure(input);
    return effectRuntime.Effect.gen(function* () {
      const token = yield* auth.accessToken();
      if (!token) {
        yield* auth.handleUnauthorized();
        return { ...fallback, status: 401 };
      }
      return yield* effectRuntime.Effect.tryPromise({
        try: (signal) => saveDraftAnswer(auth.api, input, signal),
        catch: () => new TaskAnswerRequestError(),
      }).pipe(effectRuntime.Effect.flatMap((result) => handleUnauthorized(auth, result)));
    }).pipe(
      effectRuntime.Effect.catch(() => effectRuntime.Effect.succeed(fallback)),
    );
  }

  function submit(input: SubmitAnswerInput): TaskAnswerEffect<SubmitAnswerResult> {
    if (!isSubmitAnswerInput(input) || !input.answerId.trim()) {
      return effectRuntime.Effect.succeed({ ok: false, status: 400 });
    }
    return effectRuntime.Effect.gen(function* () {
      const token = yield* auth.accessToken();
      if (!token) {
        yield* auth.handleUnauthorized();
        return { ok: false, status: 401 };
      }
      return yield* effectRuntime.Effect.tryPromise({
        try: (signal) => submitAnswer(auth.api, input, signal),
        catch: () => new TaskAnswerRequestError(),
      }).pipe(effectRuntime.Effect.flatMap((result) => handleUnauthorized(auth, result)));
    }).pipe(
      effectRuntime.Effect.catch(() => effectRuntime.Effect.succeed({ ok: false, status: 0 })),
    );
  }

  return {
    saveDraft,
    submit,
    submitAnswer: submit,
  };
}

class TaskAnswerRequestError {
  readonly _tag = "TaskAnswerRequestError";
}

function handleUnauthorized<A extends { status: number }>(
  auth: AuthServiceShape,
  result: A,
): TaskAnswerEffect<A> {
  if (result.status !== 401) return effectRuntime.Effect.succeed(result);
  // The authenticated API adapter may already have published the 401
  // transition through its callback. Avoid asking the session service to
  // publish the same transition twice, while still handling injected API
  // doubles that only return the status.
  return auth.status().pipe(
    effectRuntime.Effect.flatMap((status) =>
      status === "session-expired"
        ? effectRuntime.Effect.succeed(result)
        : auth.handleUnauthorized().pipe(effectRuntime.Effect.as(result)),
    ),
  );
}

function saveDraftFailure(input: SaveDraftInput): SaveDraftResult {
  const answerId =
    typeof input?.answerId === "string" && input.answerId.trim()
      ? input.answerId.trim()
      : null;
  return {
    ok: false,
    status: 0,
    created: answerId === null,
    answerId,
  };
}

function invalidSaveDraftResult(input: unknown): SaveDraftResult | null {
  if (!isSaveDraftInput(input) || !input.taskId.trim()) {
    return { ok: false, status: 400, created: false, answerId: null };
  }
  return null;
}

function isApiResult(value: unknown): value is ApiResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.status === "number" && Number.isFinite(record.status) &&
    typeof record.ok === "boolean" && "body" in record;
}

function isSaveDraftInput(value: unknown): value is SaveDraftInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.taskId === "string" &&
    typeof record.answer === "string" &&
    (record.answerId === undefined || record.answerId === null || typeof record.answerId === "string");
}

function isSubmitAnswerInput(value: unknown): value is SubmitAnswerInput {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).answerId === "string";
}

/**
 * The create response body was not retrievable via CDP during the live
 * capture (#16) — the new id was observed via the follow-up comments call.
 * Parse defensively across the plain and JSON-API shapes so a future body
 * is picked up without another capture.
 */
export function extractAnswerId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;
  const direct = scalarString(root.id ?? root.answer_id ?? root.answerId);
  if (direct) return direct;
  const data = root.data;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const nested = scalarString(record.id ?? record.answer_id ?? record.answerId);
    if (nested) return nested;
    const attributes = record.attributes;
    if (typeof attributes === "object" && attributes !== null && !Array.isArray(attributes)) {
      const attrId = scalarString(
        (attributes as Record<string, unknown>).id ??
          (attributes as Record<string, unknown>).answer_id,
      );
      if (attrId) return attrId;
    }
  }
  return null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}
