/**
 * Direct API client for the vendor API (api-edunex.cognisia.id) — the app
 * talks to it with the bearer token captured from the webview, never with a
 * password (spec: auth & session, API stance). Read-mostly: the auth and sync
 * slices use GETs only; the only writes are the Task Answer draft-save and
 * final-submit actions below, which fire solely on explicit user clicks (API
 * guardrails).
 */

import type { HttpTransportService } from "../platform/services";

export interface ApiResult {
  /** HTTP status; 0 means the request never completed (offline, DNS, …).
   * A network failure is not an auth failure — only 401 is. */
  status: number;
  ok: boolean;
  body: unknown;
}

/** A normalized read result whose payload may be unavailable after failure. */
export type ApiResponse<T> = Omit<ApiResult, "body"> & { body: T | null };

export interface EdunexApi {
  get(path: string, signal?: AbortSignal): Promise<ApiResult>;
  post(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult>;
  patch(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult>;
}

/** EduNex's active course-list request captured from the My Courses page. */
export const ACTIVE_COURSES_PATH =
  "/course/courses?include=lecturer,lecturer.user,contents,faculty&filter[is_active][is]=1&filter[is_enrolled][is]=1&page[limit]=100&page[offset]=0";

export interface TodoFeed {
  tasks: unknown[];
  exams: unknown[];
  questions: unknown[];
  modules: unknown[];
  [key: string]: unknown;
}

export type JsonApiResource = Record<string, unknown>;

export interface EdunexDataApi extends EdunexApi {
  getTodo(signal?: AbortSignal): Promise<ApiResponse<TodoFeed>>;
  getCourses(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  getCourseTasks(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  getExams(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  getAgenda(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  getMaterials(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  getPresences(signal?: AbortSignal): Promise<ApiResponse<JsonApiResource[]>>;
  /**
   * Draft-save pair, verified live on Tugas 01 (issue #16). Both send
   * `is_sent: 0` and `task_id` in a JSON-API `data.attributes` envelope.
   * Create omits `files`; update carries an explicit `files: []`.
   */
  createDraftAnswer(taskId: string, answer: string, signal?: AbortSignal): Promise<ApiResult>;
  updateDraftAnswer(
    answerId: string,
    taskId: string,
    answer: string,
    signal?: AbortSignal,
  ): Promise<ApiResult>;
  /** Final submit, verified live in issue #12: PATCH with only `is_sent: 1`. */
  submitAnswer(answerId: string, signal?: AbortSignal): Promise<ApiResult>;
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
  /** Main supplies the process-wide HTTP transport service. */
  transport?: HttpTransportService;
  /** Test-only transport seam; production supplies `transport`. */
  fetchImpl?: typeof fetch;
}

export function createEdunexApi(options: EdunexApiOptions): EdunexDataApi {
  const { baseUrl, getToken, userAgent, onUnauthorized } = options;
  const transport: HttpTransportService | null =
    options.transport ??
    (options.fetchImpl
      ? {
          request: (url, init) => options.fetchImpl!(url, init),
        }
      : null);

  async function request(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<ApiResult> {
    const token = getToken();
    if (!token) {
      onUnauthorized?.();
      return { status: 401, ok: false, body: null };
    }

    if (!transport) return { status: 0, ok: false, body: null };

    let response;
    try {
      response = await transport.request(`${baseUrl}${path}`, {
        method,
        headers: new Headers({
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch {
      return { status: 0, ok: false, body: null };
    }

    if (response.status === 401) onUnauthorized?.();
    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      // Empty or non-JSON body — fine for a status-only check.
    }
    return { status: response.status, ok: response.ok, body: responseBody };
  }

  async function get(path: string, signal?: AbortSignal): Promise<ApiResult> {
    return request("GET", path, undefined, signal);
  }

  async function post(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult> {
    return request("POST", path, body, signal);
  }

  async function patch(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult> {
    return request("PATCH", path, body, signal);
  }

  return {
    get,
    post,
    patch,
    getTodo: (signal?: AbortSignal) =>
      get("/todo", signal).then((result) => normalizeResult(result, normalizeTodo)),
    getCourses: (signal?: AbortSignal) =>
      get(ACTIVE_COURSES_PATH, signal).then((result) => normalizeResult(result, normalizeCourses)),
    getCourseTasks: (signal?: AbortSignal) =>
      get("/course/tasks", signal).then((result) => normalizeResult(result, normalizeCollection)),
    getExams: (signal?: AbortSignal) =>
      get("/exam/exams", signal).then((result) => normalizeResult(result, normalizeExams)),
    getAgenda: (signal?: AbortSignal) =>
      get("/course/agenda", signal).then((result) => normalizeResult(result, normalizeAgenda)),
    getMaterials: (signal?: AbortSignal) =>
      get("/course/materials", signal).then((result) => normalizeResult(result, normalizeMaterials)),
    getPresences: (signal?: AbortSignal) =>
      get("/course/presences/list", signal).then((result) =>
        normalizeResult(result, normalizePresences),
      ),
    createDraftAnswer: (taskId: string, answer: string, signal?: AbortSignal) =>
      post("/course/task/answers", {
        data: { attributes: { task_id: taskId, answer, is_sent: 0 } },
      }, signal),
    updateDraftAnswer: (
      answerId: string,
      taskId: string,
      answer: string,
      signal?: AbortSignal,
    ) =>
      patch(`/course/task/answers/${answerId}`, {
        data: { attributes: { task_id: taskId, files: [], answer, is_sent: 0 } },
      }, signal),
    submitAnswer: (answerId: string, signal?: AbortSignal) =>
      patch(`/course/task/answers/${answerId}`, {
        data: { attributes: { is_sent: 1 } },
      }, signal),
  };
}

function normalizeResult<T>(
  result: ApiResult,
  normalize: (body: unknown) => T | null,
): ApiResponse<T> {
  if (!isSuccessful(result)) return result as ApiResponse<T>;
  const body = normalize(result.body);
  // A successful HTTP response with an unusable payload must not overwrite a
  // good snapshot with an empty list. Keep the established result shape, but
  // mark the body unavailable so sync treats this feed as failed and serves
  // its previous cache instead.
  if (body === null) {
    return { ...result, ok: false, body: null };
  }
  return { ...result, body };
}

function normalizeTodo(body: unknown): TodoFeed | null {
  const root = asRecord(body);
  if (!root) return null;

  // The two rendered categories must exist and be arrays. Optional categories
  // are filled for the existing renderer contract. Individual vendor records
  // remain unknown because the API is undocumented and the renderer already
  // tolerates optional fields.
  for (const key of ["tasks", "exams"] as const) {
    if (!(key in root) || !Array.isArray(root[key])) return null;
  }
  for (const key of ["questions", "modules"] as const) {
    if (key in root && !Array.isArray(root[key])) return null;
  }

  return {
    ...root,
    tasks: arrayOrEmpty(root.tasks),
    exams: arrayOrEmpty(root.exams),
    questions: arrayOrEmpty(root.questions),
    modules: arrayOrEmpty(root.modules),
  };
}

function normalizeCollection(body: unknown): JsonApiResource[] | null {
  if (Array.isArray(body)) return recordsOrNull(body);
  const root = asRecord(body);
  if (!root) return null;
  if ("data" in root) return Array.isArray(root.data) ? recordsOrNull(root.data) : null;
  if ("courses" in root) {
    return Array.isArray(root.courses) ? recordsOrNull(root.courses) : null;
  }
  return null;
}

/**
 * Normalizes the plain-JSON `/exam/exams` response at the API boundary.
 * The vendor returns a plain shape (unlike `/course/tasks`' JSON-API
 * envelope), but callers should not care whether it arrives as a bare
 * array or wrapped in `exams`/`data`.
 */
function normalizeExams(body: unknown): JsonApiResource[] | null {
  if (Array.isArray(body)) return recordsOrNull(body);
  const root = asRecord(body);
  if (!root) return null;
  if ("exams" in root) return Array.isArray(root.exams) ? recordsOrNull(root.exams) : null;
  if ("data" in root) return Array.isArray(root.data) ? recordsOrNull(root.data) : null;
  return null;
}

/**
 * Normalizes the plain-array `/course/agenda` response at the API boundary.
 * The endpoint returns a bare array (unlike `/course/tasks`' JSON-API
 * envelope), but nested `data`/`agenda` variants are accepted so a wrapped
 * response never becomes an empty agenda.
 */
function normalizeAgenda(body: unknown): JsonApiResource[] | null {
  if (Array.isArray(body)) return recordsOrNull(body);
  const root = asRecord(body);
  if (!root) return null;
  for (const key of ["data", "agenda", "meetings"]) {
    if (key in root) return Array.isArray(root[key]) ? recordsOrNull(root[key]) : null;
  }
  return null;
}

/**
 * Normalizes the `/course/materials` response at the API boundary.
 * The vendor shape is a plain collection (like `/course/agenda`), but
 * `materials`/`modules`/`data`-wrapped and JSON-API variants are accepted
 * so an envelope change never becomes an empty materials list.
 */
function normalizeMaterials(body: unknown): JsonApiResource[] | null {
  if (Array.isArray(body)) return recordsOrNull(body);
  const root = asRecord(body);
  if (!root) return null;
  for (const key of ["data", "materials", "modules", "files"]) {
    if (key in root) return Array.isArray(root[key]) ? recordsOrNull(root[key]) : null;
  }
  return null;
}

/**
 * Normalizes the plain-array `/course/presences/list` response at the API
 * boundary. The endpoint returns per-course rows carrying a nested
 * `presences` array (unlike `/course/tasks`' JSON-API envelope), but nested
 * `data`/`presences` variants are accepted so a wrapped response never
 * becomes an empty presence history.
 */
function normalizePresences(body: unknown): JsonApiResource[] | null {
  if (Array.isArray(body)) return recordsOrNull(body);
  const root = asRecord(body);
  if (!root) return null;
  for (const key of ["data", "presences", "courses"]) {
    if (key in root) return Array.isArray(root[key]) ? recordsOrNull(root[key]) : null;
  }
  return null;
}

function normalizeCourses(body: unknown): JsonApiResource[] | null {
  const resources = normalizeCollection(body);
  if (resources === null) return null;
  return resources.filter((resource) => {
    const attributes = asRecord(resource.attributes) ?? resource;
    return (
      "is_active" in attributes &&
      "is_enrolled" in attributes &&
      isEnabledCourseFlag(attributes.is_active) &&
      isEnabledCourseFlag(attributes.is_enrolled)
    );
  });
}

function isEnabledCourseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
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

/**
 * Keep the tolerant item policy of the old client: unknown extra records are
 * retained, while an all-malformed non-empty collection is rejected so it
 * cannot look like a legitimate empty feed.
 */
function recordsOrNull(value: unknown[]): JsonApiResource[] | null {
  const records = value.filter(isRecord);
  return value.length > 0 && records.length === 0 ? null : records;
}

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}
