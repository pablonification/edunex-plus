import type {
  MaterialDownloadRequest,
  MaterialDownloadResult,
} from "../../shared/materials";
import { isMaterialDownloadRequest } from "../../shared/materials";
import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import { AuthService, type AuthServiceShape } from "../auth/auth-service";
import {
  ElectronPlatform,
  FileSystem,
  HttpTransport,
  type ElectronPlatformService,
  type FileSystemService,
  type HttpTransportService,
} from "../platform/services";

export type MaterialDownloadEffect<A> = EffectModule.Effect.Effect<A, never, never>;

export interface MaterialDownloadServiceShape {
  readonly download: (
    request: MaterialDownloadRequest,
  ) => MaterialDownloadEffect<MaterialDownloadResult>;
}

export class MaterialDownloadService extends effectRuntime.Context.Service<
  MaterialDownloadService,
  MaterialDownloadServiceShape
>()("EdunexPlus/MaterialDownloadService") {}

export interface MaterialDownloadServiceOptions {
  readonly baseUrl: string;
  readonly userAgent: string;
}

export type MaterialDownloadLayer = EffectModule.Layer.Layer<
  MaterialDownloadService,
  never,
  AuthService | HttpTransport | FileSystem | ElectronPlatform
>;

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
  signal?: AbortSignal,
): Promise<MaterialDownloadResult> {
  const fileUrl = typeof request?.fileUrl === "string" ? request.fileUrl.trim() : "";
  if (!fileUrl) {
    return { ok: false, error: "This material has no downloadable file." };
  }
  const fileName = sanitizeFileName(request.fileName);
  const target = resolveUrl(deps.baseUrl, fileUrl);
  if (!target) {
    return { ok: false, error: "This material has no downloadable file." };
  }
  if (signal?.aborted) {
    return { ok: false, error: "Download cancelled.", cancelled: true };
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
  if (signal?.aborted) {
    return { ok: false, error: "Download cancelled.", cancelled: true };
  }

  const transport: HttpTransportService | null =
    deps.transport ??
    (deps.fetchImpl
      ? {
          request: (requestUrl, init) => deps.fetchImpl!(requestUrl, init),
        }
      : null);
  if (!transport) {
    return { ok: false, error: "Download failed — check your connection and try again." };
  }
  let response;
  try {
    const headers = new Headers({ "User-Agent": deps.userAgent });
    if (target.sendAuthorization) headers.set("Authorization", `Bearer ${token}`);
    response = await transport.request(target.url, {
      headers,
      ...(signal ? { signal } : {}),
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
  if (signal?.aborted) {
    return { ok: false, error: "Download cancelled.", cancelled: true };
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
    if (signal?.aborted) return { ok: false, error: "Download cancelled.", cancelled: true };
    await deps.writeFile(saveChoice.filePath, bytes);
  } catch {
    return { ok: false, error: "Could not save the file — check the destination and try again." };
  }

  return { ok: true, filePath: saveChoice.filePath };
}

/**
 * Builds the explicit material-download command from platform services. The
 * service owns no timer or retry policy; cancellation, dialog choice, HTTP,
 * and persistence all remain part of this one user-triggered Effect.
 */
export function createMaterialDownloadLayer(
  options: MaterialDownloadServiceOptions,
): MaterialDownloadLayer {
  return effectRuntime.Layer.effect(
    MaterialDownloadService,
    effectRuntime.Effect.gen(function* () {
      const auth = yield* AuthService;
      const transport = yield* HttpTransport;
      const fileSystem = yield* FileSystem;
      const electron = yield* ElectronPlatform;
      return createMaterialDownloadService({ auth, transport, fileSystem, electron, options });
    }),
  ) as MaterialDownloadLayer;
}

export const MaterialDownloadServiceLive = createMaterialDownloadLayer;
export const createMaterialDownloadServiceLayer = createMaterialDownloadLayer;

function createMaterialDownloadService(deps: {
  readonly auth: AuthServiceShape;
  readonly transport: HttpTransportService;
  readonly fileSystem: FileSystemService;
  readonly electron: ElectronPlatformService;
  readonly options: MaterialDownloadServiceOptions;
}): MaterialDownloadServiceShape {
  function download(
    request: MaterialDownloadRequest,
  ): MaterialDownloadEffect<MaterialDownloadResult> {
    if (!isMaterialDownloadRequest(request) || !request.fileUrl.trim()) {
      return effectRuntime.Effect.succeed({
        ok: false,
        error: "This material has no downloadable file.",
      });
    }

    return effectRuntime.Effect.gen(function* () {
      const token = yield* deps.auth.accessToken();
      if (!token) {
        yield* deps.auth.handleUnauthorized();
        return { ok: false, error: "Session expired — please sign in again." } as const;
      }

      let unauthorized = false;
      const result = yield* effectRuntime.Effect.tryPromise({
        try: (signal) =>
          downloadMaterialFile(
            request,
            {
              baseUrl: deps.options.baseUrl,
              getToken: () => token,
              userAgent: deps.options.userAgent,
              onUnauthorized: () => {
                unauthorized = true;
              },
              transport: deps.transport,
              showSaveDialog: ({ defaultPath }) =>
                deps.electron.showSaveDialog({
                  defaultPath,
                  createDirectory: true,
                  showOverwriteConfirmation: true,
                }),
              writeFile: (filePath, bytes) => deps.fileSystem.writeBytes(filePath, bytes),
            },
            signal,
          ),
        catch: () => new MaterialDownloadRequestError(),
      });

      if (unauthorized) yield* deps.auth.handleUnauthorized();
      return result;
    }).pipe(
      effectRuntime.Effect.catch(() =>
        effectRuntime.Effect.succeed({
          ok: false as const,
          error: "Download failed — check your connection and try again.",
        }),
      ),
    );
  }

  return { download };
}

class MaterialDownloadRequestError {
  readonly _tag = "MaterialDownloadRequestError";
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
