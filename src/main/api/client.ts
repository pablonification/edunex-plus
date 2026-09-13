/**
 * Direct API client for the vendor API (api-edunex.cognisia.id) — the app
 * talks to it with the bearer token captured from the webview, never with a
 * password (spec: auth & session, API stance). Read-mostly: the auth and sync
 * slices use GETs only.
 */

export interface ApiResult {
  /** HTTP status; 0 means the request never completed (offline, DNS, …).
   * A network failure is not an auth failure — only 401 is. */
  status: number;
  ok: boolean;
  body: unknown;
}

export interface EdunexApi {
  get(path: string): Promise<ApiResult>;
}

export interface TodoFeed {
  tasks: unknown[];
  exams: unknown[];
  questions: unknown[];
  modules: unknown[];
  [key: string]: unknown;
}

export type JsonApiResource = Record<string, unknown>;

export interface EdunexDataApi extends EdunexApi {
  getTodo(): Promise<ApiResult & { body: TodoFeed }>;
  getCourses(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getCourseTasks(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getExams(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getAgenda(): Promise<ApiResult & { body: JsonApiResource[] }>;
}

export interface EdunexApiOptions {
  baseUrl: string;
  /** Current access token, or null when signed out. */
  getToken: () => string | null;
  /** Distinctive User-Agent so Cognisia can recognize (spec: API stance). */
  userAgent: string;
  /** Fired on 401 or missing token: the session is gone and the app must
   * pause into the re-login moment. Never fired for network errors. */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export function createEdunexApi(options: EdunexApiOptions): EdunexDataApi {
  const {
    baseUrl,
    getToken,
    userAgent,
    onUnauthorized,
    fetchImpl = fetch,
  } = options;

  async function get(path: string): Promise<ApiResult> {
    const token = getToken();
    if (!token) {
      onUnauthorized?.();
      return { status: 401, ok: false, body: null };
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        headers: new Headers({
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
        }),
      });
    } catch {
      return { status: 0, ok: false, body: null };
    }

    if (response.status === 401) onUnauthorized?.();
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Empty or non-JSON body — fine for a status-only check.
    }
    return { status: response.status, ok: response.ok, body };
  }

  return {
    get,
    getTodo: () => get("/todo").then((result) => normalizeResult(result, normalizeTodo)),
    getCourses: () =>
      get("/course/courses").then((result) => normalizeResult(result, normalizeCollection)),
    getCourseTasks: () =>
      get("/course/tasks").then((result) => normalizeResult(result, normalizeCollection)),
    getExams: () =>
      get("/exam/exams").then((result) => normalizeResult(result, normalizeExams)),
    getAgenda: () =>
      get("/course/agenda").then((result) => normalizeResult(result, normalizeAgenda)),
  };
}

function normalizeResult<T>(
  result: ApiResult,
  normalize: (body: unknown) => T,
): ApiResult & { body: T } {
  if (!isSuccessful(result)) return result as ApiResult & { body: T };
  return { ...result, body: normalize(result.body) };
}

function normalizeTodo(body: unknown): TodoFeed {
  const root = asRecord(body) ?? {};
  return {
    ...root,
    tasks: arrayOrEmpty(root.tasks),
    exams: arrayOrEmpty(root.exams),
    questions: arrayOrEmpty(root.questions),
    modules: arrayOrEmpty(root.modules),
  };
}

function normalizeCollection(body: unknown): JsonApiResource[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  const root = asRecord(body);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data.filter(isRecord);
  if (Array.isArray(root.courses)) return root.courses.filter(isRecord);
  return [];
}

/**
 * Normalizes the plain-JSON `/exam/exams` response at the API boundary.
 * The vendor returns a plain shape (unlike `/course/tasks`' JSON-API
 * envelope), but callers should not care whether it arrives as a bare
 * array or wrapped in `exams`/`data`.
 */
function normalizeExams(body: unknown): JsonApiResource[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  const root = asRecord(body);
  if (!root) return [];
  if (Array.isArray(root.exams)) return root.exams.filter(isRecord);
  if (Array.isArray(root.data)) return root.data.filter(isRecord);
  return [];
}

/**
 * Normalizes the plain-array `/course/agenda` response at the API boundary.
 * The endpoint returns a bare array (unlike `/course/tasks`' JSON-API
 * envelope), but nested `data`/`agenda` variants are accepted so a wrapped
 * response never becomes an empty agenda.
 */
function normalizeAgenda(body: unknown): JsonApiResource[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  const root = asRecord(body);
  if (!root) return [];
  for (const key of ["data", "agenda", "meetings"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).filter(isRecord);
  }
  return [];
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRecord(value: unknown): value is JsonApiResource {
  return asRecord(value) !== null;
}

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}
