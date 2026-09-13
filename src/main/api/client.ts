/**
 * Direct API client for the vendor API (api-edunex.cognisia.id) — the app
 * talks to it with the bearer token captured from the webview, never with a
 * password (spec: auth & session, API stance). Read-mostly; v1 auth slice
 * only needs GETs to verify a session.
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

export function createEdunexApi(options: EdunexApiOptions): EdunexApi {
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

  return { get };
}
