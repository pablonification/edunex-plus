import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import {
  EDUNEX_API_BASE_URL,
  AuthService,
} from "../auth/auth-service";
import {
  createEdunexApi,
  type ApiResponse,
  type ApiResult,
  type EdunexDataApi,
  type JsonApiResource,
  type TodoFeed,
} from "./client";
import { HttpTransport } from "../platform/services";

/** The six read methods owned by background synchronization. */
export type CognisiaReadApi = Pick<
  EdunexDataApi,
  "get" | "getTodo" | "getCourses" | "getCourseTasks" | "getExams" | "getAgenda" |
    "getMaterials" | "getPresences"
>;

export type ApiEffect<A> = EffectModule.Effect.Effect<A, never, never>;

/**
 * Effect-facing Cognisia read contract. The result deliberately keeps the
 * existing status/body shape: callers can distinguish an HTTP failure from a
 * transport failure without receiving a vendor exception or raw cause.
 */
export interface CognisiaServiceShape {
  readonly get: (path: string) => ApiEffect<ApiResult>;
  readonly getTodo: () => ApiEffect<ApiResponse<TodoFeed>>;
  readonly getCourses: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
  readonly getCourseTasks: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
  readonly getExams: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
  readonly getAgenda: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
  readonly getMaterials: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
  readonly getPresences: () => ApiEffect<ApiResponse<JsonApiResource[]>>;
}

/** Explicit Context key for the authenticated Cognisia read service. */
export class CognisiaService extends effectRuntime.Context.Service<
  CognisiaService,
  CognisiaServiceShape
>()("EdunexPlus/CognisiaService") {}

// These aliases make the service discoverable from the vocabulary used by the
// older API and sync modules without creating a second Context key.
export const ApiService = CognisiaService;
export const EdunexApiService = CognisiaService;
export const CognisiaApiService = CognisiaService;
export const CognisiaReadService = CognisiaService;
export const DataService = CognisiaService;
export type ApiServiceShape = CognisiaServiceShape;
export type EdunexApiServiceShape = CognisiaServiceShape;
export type CognisiaApiServiceShape = CognisiaServiceShape;
export type CognisiaReadServiceShape = CognisiaServiceShape;
export type DataServiceShape = CognisiaServiceShape;

/** Wrap an existing API adapter without changing its request behavior. */
export function createCognisiaService(api: CognisiaReadApi): CognisiaServiceShape {
  return {
    // The operation's AbortSignal is supplied by Effect.tryPromise. Keeping
    // it inside the service means an interrupted sync fiber also interrupts
    // the underlying HTTP request instead of merely abandoning its result.
    get: (path) => safeApiCall((signal) => api.get(path, signal), failedResult()),
    getTodo: () => safeApiCall((signal) => api.getTodo(signal), failedResult()),
    getCourses: () => safeApiCall((signal) => api.getCourses(signal), failedResult()),
    getCourseTasks: () => safeApiCall((signal) => api.getCourseTasks(signal), failedResult()),
    getExams: () => safeApiCall((signal) => api.getExams(signal), failedResult()),
    getAgenda: () => safeApiCall((signal) => api.getAgenda(signal), failedResult()),
    getMaterials: () => safeApiCall((signal) => api.getMaterials(signal), failedResult()),
    getPresences: () => safeApiCall((signal) => api.getPresences(signal), failedResult()),
  };
}

/**
 * The auth service remains the sole token owner. This layer obtains the token
 * through its owned API adapter. This keeps the token, transport, and
 * unauthorized transition behind one authenticated service boundary; the
 * synchronization service only receives the read-only Cognisia port.
 */
export function createCognisiaLayer(): EffectModule.Layer.Layer<
  CognisiaService,
  never,
  AuthService
> {
  return effectRuntime.Layer.effect(
    CognisiaService,
    effectRuntime.Effect.gen(function* () {
      const auth = yield* AuthService;
      return createCognisiaService(auth.api);
    }),
  ) as EffectModule.Layer.Layer<CognisiaService, never, AuthService>;
}

/** Options for a standalone Cognisia service backed by the injected HTTP port. */
export interface CognisiaHttpLayerOptions {
  readonly baseUrl?: string;
  readonly getToken: () => string | null;
  readonly userAgent: string;
  readonly onUnauthorized?: () => void;
}

/**
 * Builds the same service directly from the platform HTTP port. This is useful
 * for isolated tests and for callers that do not use the session service; the
 * transport itself is still supplied by an Effect Layer.
 */
export function createCognisiaHttpLayer(
  options: CognisiaHttpLayerOptions,
): EffectModule.Layer.Layer<CognisiaService, never, HttpTransport> {
  return effectRuntime.Layer.effect(
    CognisiaService,
    effectRuntime.Effect.gen(function* () {
      const transport = yield* HttpTransport;
      return createCognisiaService(
        createEdunexApi({
          baseUrl: options.baseUrl ?? EDUNEX_API_BASE_URL,
          getToken: options.getToken,
          userAgent: options.userAgent,
          onUnauthorized: options.onUnauthorized,
          transport,
        }),
      );
    }),
  ) as EffectModule.Layer.Layer<CognisiaService, never, HttpTransport>;
}

/** Test and composition helper for an already constructed API adapter. */
export function createCognisiaLayerFromApi(
  api: CognisiaReadApi,
): EffectModule.Layer.Layer<CognisiaService, never, never> {
  return effectRuntime.Layer.succeed(CognisiaService, createCognisiaService(api));
}

export const CognisiaServiceLive = createCognisiaLayer;
export const ApiServiceLive = createCognisiaLayer;

/** Conventional aliases for callers that name the service after its port. */
export function createApiLayer(): ReturnType<typeof createCognisiaLayer> {
  return createCognisiaLayer();
}

export const createDataLayer = createApiLayer;

function safeApiCall<A extends ApiResult>(
  operation: (signal: AbortSignal) => Promise<A>,
  fallback: A,
): ApiEffect<A> {
  return effectRuntime.Effect.tryPromise((signal) => operation(signal)).pipe(
    effectRuntime.Effect.catch(() => effectRuntime.Effect.succeed(fallback)),
  ) as ApiEffect<A>;
}

function failedResult<A extends ApiResult>(): A {
  return { status: 0, ok: false, body: null } as A;
}
