// The two IPC channels between the window and the engine. Kept apart from the
// contract so the preload stays a few lines with no dependencies.
export const CHANNEL_INVOKE = "edunex-plus:invoke";
export const CHANNEL_EVENT = "edunex-plus:event";
