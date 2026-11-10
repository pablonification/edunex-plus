// The first minute's own colours (./scene.tsx), on the stage, which is Beranda's header colour (./seam.ts). Kept apart
// from the scene so the contrast test reads them (test/mobile/contrast.test.ts).

/** A door before its system is in: white at this strength over the stage, the same for both doors. */
export const DOOR_REST_ALPHA = { light: 0.14, dark: 0.09 } as const;
/** A door once its system is in: lit. In light, the sign-in button too. */
export const DOOR_LIT = { light: "#ffffff", dark: "#dbe6ff" } as const;
/** What's written on a lit door, each system in its own colour. */
export const DOOR_INK = { edunex: "#1450c4", six: "#0f2f6b" } as const;
/** The app's mark on the seam: Edunex Plus's blue, ringed in white so it reads on a lit door and on the stage alike. */
export const MARK_COLOR = "#1f63e0";
export const MARK_INK = "#ffffff";
/** The language chip's edge: white at this strength over the stage. */
export const CHIP_EDGE_ALPHA = 0.7;
