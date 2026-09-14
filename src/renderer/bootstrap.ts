import type { FeedKey, FeedSnapshot } from "@shared/feeds";
import type { InAppNotification } from "@shared/notifications";
import type { AppInfo, NavKey, ShellSettings } from "@shared/shell";

type BrowserPreviewTarget = { edunex?: Window["edunex"] };

const PREVIEW_FETCHED_AT = "2026-09-13T12:00:00.000Z";
const PREVIEW_SHELL_SETTINGS: ShellSettings = {
  hiddenViews: [],
  quitOnClose: false,
};

/**
 * Installs the browser-only preview bridge when the Electron preload script is
 * not present. The real bridge always wins, and production boot never gets a
 * demo implementation.
 */
export function ensureBrowserPreviewBridge(
  target: BrowserPreviewTarget,
  enabled: boolean,
): boolean {
  if (!enabled || target.edunex) return false;
  target.edunex = createBrowserPreviewBridge();
  return true;
}

/**
 * Small, local fixture bridge for `npx vite`: it keeps the renderer useful in
 * a normal browser while the Electron preload bridge remains the production
 * seam. No network or credentials are involved.
 */
export function createBrowserPreviewBridge(): Window["edunex"] {
  const snapshots: Record<FeedKey, FeedSnapshot> = {
    todo: {
      feed: "todo",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: {
        tasks: [
          {
            type: "task",
            code: "II4091",
            course: "Final Project Proposal",
            name: "Answer Tugas 01",
            time: "2100-09-14T23:59:00.000Z",
            id: 113986,
            answers: [{ id: 2644208, answer: "Preview draft answer", is_sent: 0 }],
          },
        ],
        exams: [],
        questions: [],
        modules: [],
      },
    },
    courses: {
      feed: "courses",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: [
        {
          type: "courses",
          id: "preview-course",
          attributes: {
            code: "II4091",
            name: "Final Project Proposal",
            class_name: "II4091-01",
            period_id: 20261,
            period_year: "2026",
            period_type: "1",
            is_active: 1,
            is_enrolled: 1,
          },
        },
      ],
    },
    exams: {
      feed: "exams",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: [],
    },
    agenda: {
      feed: "agenda",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: [],
    },
    presences: {
      feed: "presences",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: [
        {
          course_id: "preview-course",
          course_code: "II4091",
          courses_name: "Final Project Proposal",
          class_id: 1,
          class_name: "II4091-01",
          semester: 1,
          year: "2026-1",
          presences: [
            { id: 1, name: "Week 01 — Opening", date: "2026-08-19T07:00:00.000Z", status: "Present" },
          ],
        },
      ],
    },
    materials: {
      feed: "materials",
      accountId: "browser-preview",
      fetchedAt: PREVIEW_FETCHED_AT,
      data: [
        {
          id: 9001,
          name: "Week 05 — Slides",
          course_code: "II4091",
          course_name: "Final Project Proposal",
          file_name: "Week-05-Slides.pdf",
          file_url: "/blob-storage/materials/9001/Week-05-Slides.pdf",
          mime_type: "application/pdf",
          size: 245760,
        },
      ],
    },
  };

  const noOpUnsubscribe = () => undefined;
  const noOpNotifications: InAppNotification[] = [];

  return {
    version: "dev preview",
    platform: "browser",
    fireTestNotification: async () => undefined,
    getAppInfo: async (): Promise<AppInfo> => ({
      version: "dev preview",
      platform: "browser",
      trayActive: false,
      notificationsSupported: false,
    }),
    onNavigate: (_callback: (view: NavKey) => void) => noOpUnsubscribe,
    onFullscreenChange: (_callback: (isFullscreen: boolean) => void) => noOpUnsubscribe,
    getAuthState: async () => "signed-in",
    startLogin: async () => undefined,
    signOut: async () => undefined,
    onAuthState: (_callback) => noOpUnsubscribe,
    getFeed: async (feed: FeedKey) => snapshots[feed] ?? null,
    onFeedUpdated: (_callback) => noOpUnsubscribe,
    downloadMaterial: async () => ({
      ok: false as const,
      error: "Downloads require the Electron app.",
    }),
    getShellSettings: async () => PREVIEW_SHELL_SETTINGS,
    setViewHidden: async () => PREVIEW_SHELL_SETTINGS,
    setQuitOnClose: async () => PREVIEW_SHELL_SETTINGS,
    onShellSettings: (_callback) => noOpUnsubscribe,
    getNotifications: async () => noOpNotifications,
    markNotificationsRead: async () => noOpNotifications,
    markAllNotificationsRead: async () => noOpNotifications,
    onNotificationsUpdated: (_callback) => noOpUnsubscribe,
    onNotificationClicked: (_callback) => noOpUnsubscribe,
    saveDraft: async (input) => ({
      ok: true,
      status: input.answerId ? 200 : 201,
      created: !input.answerId,
      answerId: input.answerId ?? "preview-answer",
    }),
    submitAnswer: async () => ({ ok: true, status: 200 }),
  };
}
