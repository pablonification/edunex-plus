import type {
  MaterialDownloadRequest,
  MaterialDownloadResult,
} from "../../shared/materials";
import { fetchTransport } from "../platform/node";
import type { HttpTransportService } from "../platform/services";

export interface MaterialDownloadDeps {
  baseUrl: string;
  getToken: () => string | null;
  userAgent: string;
  onUnauthorized?: () => void;
  transport?: HttpTransportService;
  fetchImpl?: typeof fetch;
  showSaveDialog: (options: { defaultPath: string }) => Promise<{
    canceled: boolean;
    filePath?: string;
  }>;
  writeFile: (filePath: string, data: Uint8Array) => Promise<void> | void;
}

/**
 * Downloads one material's file bytes in the main process (#30).
 * Explicit user action only — the sync tick never calls this. The renderer
 * supplies the cached file URL + name; the bearer token never leaves main.
 */
export async function downloadMaterialFile(
  request: MaterialDownloadRequest,
  deps: MaterialDownloadDeps,
): Promise<MaterialDownloadResult> {
  const fileUrl = request.fileUrl?.trim() ?? "";
  if (!fileUrl) {
    return { ok: false, error: "This material has no downloadable file." };
  }
  const fileName = sanitizeFileName(request.fileName);
  const target = resolveUrl(deps.baseUrl, fileUrl);
  if (!target) {
    return { ok: false, error: "This material has no downloadable file." };
  }

  const token = deps.getToken();
  if (!token) {
    deps.onUnauthorized?.();
    return { ok: false, error: "Session expired — please sign in again." };
  }

  let saveChoice: { canceled: boolean; filePath?: string };
  try {
    saveChoice = await deps.showSaveDialog({ defaultPath: fileName });
  } catch {
    return { ok: false, error: "Could not open the save dialog — please try again." };
  }
  if (saveChoice.canceled || !saveChoice.filePath) {
    return { ok: false, error: "Download cancelled.", cancelled: true };
  }

  const transport: HttpTransportService =
    deps.transport ??
    (deps.fetchImpl
      ? {
          request: (requestUrl, init) => deps.fetchImpl!(requestUrl, init),
        }
      : fetchTransport);
  let response;
  try {
    const headers = new Headers({ "User-Agent": deps.userAgent });
    if (target.sendAuthorization) headers.set("Authorization", `Bearer ${token}`);
    response = await transport.request(target.url, {
      headers,
    });
  } catch {
    return { ok: false, error: "Download failed — check your connection and try again." };
  }

  if (response.status === 401) {
    deps.onUnauthorized?.();
    return { ok: false, error: "Session expired — please sign in again." };
  }
  if (!response.ok) {
    return { ok: false, error: `Download failed (server returned ${response.status}).` };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { ok: false, error: "Download failed — check your connection and try again." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, error: "The downloaded file is empty — please try again." };
  }

  try {
    await deps.writeFile(saveChoice.filePath, bytes);
  } catch {
    return { ok: false, error: "Could not save the file — check the destination and try again." };
  }

  return { ok: true, filePath: saveChoice.filePath };
}

export function sanitizeFileName(value: unknown): string {
  if (typeof value !== "string") return "material";
  const base = value.split(/[\\/]/).pop()?.replace(/\0/g, "").trim() ?? "";
  if (!base || base === "." || base === "..") return "material";
  return base.slice(0, 255);
}

function resolveUrl(
  baseUrl: string,
  fileUrl: string,
): { url: string; sendAuthorization: boolean } | null {
  try {
    const base = new URL(baseUrl);
    const target = new URL(fileUrl, base);
    if (!/^https?:$/.test(target.protocol) || target.username || target.password) return null;
    return {
      url: target.toString(),
      sendAuthorization: target.origin === base.origin,
    };
  } catch {
    return null;
  }
}
