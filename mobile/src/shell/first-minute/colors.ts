// The first minute's own colours (./scene.tsx; the first frame's too, ../welcome.tsx): the stage and what's on it. The
// scene takes nothing from Beranda's palette, so a new Beranda changes none of them. Kept apart from the scene so the
// first frame loads only this, and the contrast test reads them (test/mobile/contrast.test.ts).

/** The stage: Edunex Plus's blue over the whole screen; in dark, the same blue gone deep. */
export const STAGE = { light: "#1f63e0", dark: "#1a3158" } as const;
/** What's written on the stage. */
export const STAGE_INK = "#ffffff";
/** A door before its system is in: white at this strength over the stage, the same for both doors. */
export const DOOR_REST_ALPHA = { light: 0.14, dark: 0.09 } as const;
/**
 * A working door's light breathes between these (of fully lit): low enough that its name, still white, keeps 3:1 on
 * it at the top of the breath.
 */
export const DOOR_BREATH = { low: 0.04, high: 0.2 } as const;
/** A door once its system is in: lit. The sign-in button too. */
export const DOOR_LIT = { light: "#ffffff", dark: "#dbe6ff" } as const;
/** What's written on a lit door, each system in its own colour; Edunex's on the button. */
export const DOOR_INK = { edunex: "#1450c4", six: "#0f2f6b" } as const;
/** The app's mark on the seam: Edunex Plus's blue, ringed in white so it reads on a lit door and on the stage alike. */
export const MARK_COLOR = "#1f63e0";
export const MARK_INK = "#ffffff";
/** The language chip's edge: white at this strength over the stage. */
export const CHIP_EDGE_ALPHA = 0.7;
/** A sign-in that failed, said over the button: the same pale red and deep red in both themes (the stage is dark in both). */
export const FAILED = { bg: "#fde8e8", ink: "#a11616" } as const;
