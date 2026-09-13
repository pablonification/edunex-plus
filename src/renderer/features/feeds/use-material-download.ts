import { useCallback, useState } from "react";
import type {
  MaterialDownloadRequest,
  MaterialDownloadResult,
} from "@shared/materials";
import type { MaterialItem } from "./feed-data";

export type MaterialDownloadStatus = "idle" | "downloading" | "done" | "error";

export interface MaterialDownloadState {
  status: MaterialDownloadStatus;
  /** Human-readable outcome: saved path on success, clear error otherwise. */
  message: string | null;
}

export type MaterialDownloader = (
  request: MaterialDownloadRequest,
) => Promise<MaterialDownloadResult>;

/**
 * Explicit-download state per material (#30). Downloading routes through
 * main (preload `downloadMaterial`) so the bearer token never reaches the
 * renderer; the list itself stays offline-readable from the snapshot cache.
 */
export function useMaterialDownload(
  downloader: MaterialDownloader = (request) => window.edunex.downloadMaterial(request),
) {
  const [byId, setById] = useState<Record<string, MaterialDownloadState>>({});

  const download = useCallback(
    async (material: MaterialItem) => {
      if (!material.fileUrl) return;
      setById((prev) => ({ ...prev, [material.id]: { status: "downloading", message: null } }));
      try {
        const result = await downloader({ fileUrl: material.fileUrl, fileName: material.fileName });
        if (result.ok) {
          setById((prev) => ({
            ...prev,
            [material.id]: { status: "done", message: `Saved to ${result.filePath}` },
          }));
        } else if (result.cancelled) {
          setById((prev) => ({ ...prev, [material.id]: { status: "idle", message: null } }));
        } else {
          setById((prev) => ({
            ...prev,
            [material.id]: { status: "error", message: result.error },
          }));
        }
      } catch {
        setById((prev) => ({
          ...prev,
          [material.id]: {
            status: "error",
            message: "Download failed — check your connection and try again.",
          },
        }));
      }
    },
    [downloader],
  );

  return { states: byId, download };
}
