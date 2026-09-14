import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import {
  EDUNEX_API_BASE_URL,
  AuthService,
  edunexUserAgent,
} from "../auth/auth-service";
import {
  createEdunexApi,
  type ApiResponse,
  type ApiResult,
  type EdunexApi,
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
    get: (path) => safeApiCall(() => api.get(path), failedResult()),
    getTodo: () => safeApiCall(() => api.getTodo(), failedResult()),
    getCourses: () => safeApiCall(() => api.getCourses(), failedResult()),
    getCourseTasks: () => safeApiCall(() => api.getCourseTasks(), failedResult()),
    getExams: () => safeApiCall(() => api.getExams(), failedResult()),
    getAgenda: () => safeApiCall(() => api.getAgenda(), failedResult()),
    getMaterials: () => safeApiCall(() => api.getMaterials(), failedResult()),
    getPresences: () => safeApiCall(() => api.getPresences(), failedResult()),
  };
}

/** Options for the authenticated Cognisia read layer. */
export interface CognisiaLayerOptions {
  readonly baseUrl?: string;
  readonly appVersion?: string;
  readonly userAgent?: string;
  readonly onUnauthorized?: () => void;
}

/**
 * The auth service remains the sole token owner. This layer obtains the token
 * through its Effect accessor and builds a read-only API adapter on the
 * injected HTTP port, so sync never reaches a free-standing fetch or token.
 */
export function createCognisiaLayer(
  options: CognisiaLayerOptions = {},
): EffectModule.Layer.Layer<
  CognisiaService,
  never,
  AuthService | HttpTransport
> {
  return effectRuntime.Layer.effect(
    CognisiaService,
    effectRuntime.Effect.gen(function* () {
      const auth = yield* AuthService;
      const transport = yield* HttpTransport;
      const getToken = () => {
        try {
          return effectRuntime.Effect.runSync(auth.accessToken());
        } catch {
          return null;
        }
      };
      const onUnauthorized = options.onUnauthorized ?? (() => {
        try {
          effectRuntime.Effect.runSync(auth.handleUnauthorized());
        } catch {
          // Runtime shutdown or a destroyed auth service cannot surface through
          // the transport callback.
        }
      });
      return createCognisiaService(
        createEdunexApi({
          baseUrl: options.baseUrl ?? EDUNEX_API_BASE_URL,
          getToken,
          userAgent: options.userAgent ?? edunexUserAgent(options.appVersion ?? "unknown"),
          onUnauthorized,
          transport,
        }),
      );
    }),
  ) as EffectModule.Layer.Layer<CognisiaService, never, AuthService | HttpTransport>;
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
export function createApiLayer(
  options?: CognisiaLayerOptions,
): ReturnType<typeof createCognisiaLayer> {
  return createCognisiaLayer(options);
}

export const createDataLayer = createApiLayer;

/**
 * Adapt an Effect service at the old promise seam. The sync scheduler remains
 * a compatibility adapter until its own fiber migration; production reads
 * still execute through the managed runtime and the service above.
 */
export function toPromiseCognisiaApi(
  service: CognisiaServiceShape,
  runPromise: <A>(effect: ApiEffect<A>) => Promise<A>,
): Pick<EdunexApi, "get"> &
  Partial<
    Pick<
      EdunexDataApi,
      "getTodo" | "getCourses" | "getCourseTasks" | "getExams" | "getAgenda" |
        "getMaterials" | "getPresences"
    >
  > {
  return {
    get: (path) => runPromise(service.get(path)),
    getTodo: () => runPromise(service.getTodo()),
    getCourses: () => runPromise(service.getCourses()),
    getCourseTasks: () => runPromise(service.getCourseTasks()),
    getExams: () => runPromise(service.getExams()),
    getAgenda: () => runPromise(service.getAgenda()),
    getMaterials: () => runPromise(service.getMaterials()),
    getPresences: () => runPromise(service.getPresences()),
  };
}

function safeApiCall<A extends ApiResult>(
  operation: () => Promise<A>,
  fallback: A,
): ApiEffect<A> {
  return effectRuntime.Effect.tryPromise(() => operation()).pipe(
    effectRuntime.Effect.catch(() => effectRuntime.Effect.succeed(fallback)),
  ) as ApiEffect<A>;
}

function failedResult<A extends ApiResult>(): A {
  return { status: 0, ok: false, body: null } as A;
}

// Keep these imports/exports available to callers that use this module as the
// API composition boundary without reaching into the legacy client module.
export { edunexUserAgent };
