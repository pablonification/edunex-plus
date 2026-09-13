/**
 * Direct API client for the vendor API (api-edunex.cognisia.id) — the app
 * talks to it with the bearer token captured from the webview, never with a
 * password (spec: auth & session, API stance). Read-mostly: the auth and sync
 * slices use GETs only; the only writes are the Task Answer draft-save and
 * final-submit actions below, which fire solely on explicit user clicks (API
 * guardrails).
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
  post(path: string, body: unknown): Promise<ApiResult>;
  patch(path: string, body: unknown): Promise<ApiResult>;
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
  getTodo(): Promise<ApiResult & { body: TodoFeed }>;
  getCourses(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getCourseTasks(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getExams(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getAgenda(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getMaterials(): Promise<ApiResult & { body: JsonApiResource[] }>;
  getPresences(): Promise<ApiResult & { body: JsonApiResource[] }>;
  /**
   * Draft-save pair, verified live on Tugas 01 (issue #16). Both send
   * `is_sent: 0` and `task_id` in a JSON-API `data.attributes` envelope.
   * Create omits `files`; update carries an explicit `files: []`.
   */
  createDraftAnswer(taskId: string, answer: string): Promise<ApiResult>;
  updateDraftAnswer(answerId: string, taskId: string, answer: string): Promise<ApiResult>;
  /** Final submit, verified live in issue #12: PATCH with only `is_sent: 1`. */
  submitAnswer(answerId: string): Promise<ApiResult>;
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

  async function request(method: string, path: string, body?: unknown): Promise<ApiResult> {
    const token = getToken();
    if (!token) {
      onUnauthorized?.();
      return { status: 401, ok: false, body: null };
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: new Headers({
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        }),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

  async function get(path: string): Promise<ApiResult> {
    return request("GET", path);
  }

  async function post(path: string, body: unknown): Promise<ApiResult> {
    return request("POST", path, body);
  }

  async function patch(path: string, body: unknown): Promise<ApiResult> {
    return request("PATCH", path, body);
  }

  return {
    get,
    post,
    patch,
    getTodo: () => get("/todo").then((result) => normalizeResult(result, normalizeTodo)),
    getCourses: () =>
      get(ACTIVE_COURSES_PATH).then((result) => normalizeResult(result, normalizeCourses)),
    getCourseTasks: () =>
      get("/course/tasks").then((result) => normalizeResult(result, normalizeCollection)),
    getExams: () =>
      get("/exam/exams").then((result) => normalizeResult(result, normalizeExams)),
    getAgenda: () =>
      get("/course/agenda").then((result) => normalizeResult(result, normalizeAgenda)),
    getMaterials: () =>
      get("/course/materials").then((result) => normalizeResult(result, normalizeMaterials)),
    getPresences: () =>
      get("/course/presences/list").then((result) =>
        normalizeResult(result, normalizePresences),
      ),
    createDraftAnswer: (taskId: string, answer: string) =>
      post("/course/task/answers", {
        data: { attributes: { task_id: taskId, answer, is_sent: 0 } },
      }),
    updateDraftAnswer: (answerId: string, taskId: string, answer: string) =>
      patch(`/course/task/answers/${answerId}`, {
        data: { attributes: { task_id: taskId, files: [], answer, is_sent: 0 } },
      }),
    submitAnswer: (answerId: string) =>
      patch(`/course/task/answers/${answerId}`, {
        data: { attributes: { is_sent: 1 } },
      }),
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

/**
 * Normalizes the `/course/materials` response at the API boundary.
 * The vendor shape is a plain collection (like `/course/agenda`), but
 * `materials`/`modules`/`data`-wrapped and JSON-API variants are accepted
 * so an envelope change never becomes an empty materials list.
 */
function normalizeMaterials(body: unknown): JsonApiResource[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  const root = asRecord(body);
  if (!root) return [];
  for (const key of ["data", "materials", "modules", "files"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).filter(isRecord);
  }
  return [];
}

/**
 * Normalizes the plain-array `/course/presences/list` response at the API
 * boundary. The endpoint returns per-course rows carrying a nested
 * `presences` array (unlike `/course/tasks`' JSON-API envelope), but nested
 * `data`/`presences` variants are accepted so a wrapped response never
 * becomes an empty presence history.
 */
function normalizePresences(body: unknown): JsonApiResource[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  const root = asRecord(body);
  if (!root) return [];
  for (const key of ["data", "presences", "courses"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).filter(isRecord);
  }
  return [];
}

function normalizeCourses(body: unknown): JsonApiResource[] {
  return normalizeCollection(body).filter((resource) => {
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

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}
