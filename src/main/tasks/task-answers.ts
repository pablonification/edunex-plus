import type { ApiResult } from "../api/client";
import type { SaveDraftInput, SaveDraftResult } from "../../shared/submission";

export interface DraftApi {
  createDraftAnswer(taskId: string, answer: string): Promise<ApiResult>;
  updateDraftAnswer(answerId: string, taskId: string, answer: string): Promise<ApiResult>;
}

/**
 * Draft-save write path (issue #25, verified contract in #16).
 * Chooses create (POST /course/task/answers, 201) when no answer id is
 * known, else update (PATCH /course/task/answers/{answerId}, 200). Both
 * send `is_sent: 0`. Explicit-only: called solely from the Save-draft IPC
 * handler on a deliberate click — never from sync or background paths.
 */
export async function saveDraftAnswer(api: DraftApi, input: SaveDraftInput): Promise<SaveDraftResult> {
  const taskId = input.taskId.trim();
  const answerId = input.answerId?.trim() ? input.answerId.trim() : null;
  if (!taskId) return { ok: false, status: 400, created: false, answerId: null };

  const result = answerId
    ? await api.updateDraftAnswer(answerId, taskId, input.answer)
    : await api.createDraftAnswer(taskId, input.answer);
  const ok = isSuccessful(result);
  return {
    ok,
    status: result.status,
    created: answerId === null,
    answerId: ok ? (extractAnswerId(result.body) ?? answerId) : answerId,
  };
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
