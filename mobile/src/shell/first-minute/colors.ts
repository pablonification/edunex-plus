// The first minute's own colours (./scene.tsx; the first frame's too, ../welcome.tsx): the stage and what's on it. The
// scene takes nothing from Beranda's palette, so a new Beranda changes none of them. Kept apart from the scene so the
// first frame loads only this, and the contrast test reads them (test/mobile/contrast.test.ts). Every colour here is
// opaque: nothing see-through is laid over the stage, so a frame costs one flat fill per shape.

/** The stage: Edunex Plus's blue over the whole screen; in dark, the same blue gone deep. */
export const STAGE = { light: "#1f63e0", dark: "#1a3158" } as const;
/** What's written on the stage. */
export const STAGE_INK = "#ffffff";
/** A door before its system is in, the same for both doors: the stage a step lighter (white at 14% and 9%, mixed here). */
export const DOOR_REST = { light: "#3e79e4", dark: "#2f4467" } as const;
/** A door once its system is in: lit. In dark a dimmer light, so two lit doors don't glare in a dark room, yet light
 *  enough that navy words on it are the clearest thing on the stage. */
export const DOOR_LIT = { light: "#ffffff", dark: "#a3b9e6" } as const;
/** A system's name on its lit door: each in its own blue on white; in dark both navy, as mid-blue on the dim light was faint. */
export const DOOR_INK = {
  light: { edunex: "#1450c4", six: "#0f2f6b" },
  dark: { edunex: "#0f2f6b", six: "#0f2f6b" },
} as const;
/** The tick on a lit door: one colour on both doors, in both themes. */
export const DOOR_TICK = "#0f2f6b";
/** What a system just learned, in small words on its lit door. */
export const DOOR_FACT = "#0f2f6b";
/** The ring at a door's foot while its system connects (its bright half: the brightest thing on the door), and the
 *  glow's light. */
export const DOOR_LIGHT = "#ffffff";
/** The rest of that ring: a dim track, the door barely a step lighter (white at 15% over a resting door). */
export const RING_TRACK = { light: "#5b8de8", dark: "#4e607e" } as const;
/** The sign-in button and its words. */
export const BUTTON = { bg: { light: "#ffffff", dark: "#dbe6ff" }, ink: "#1450c4" } as const;
/** The app's mark between the doors: Edunex Plus's blue, ringed in white so it reads on a lit door and on the stage alike. */
export const MARK_COLOR = { light: "#1f63e0", dark: "#1147b3" } as const;
export const MARK_INK = "#ffffff";
/** A thin edge around that white ring, in the stage's own colour: unseen on the stage, it keeps the ring whole on a lit door. */
export const MARK_EDGE = STAGE;
/** The still glow behind the mark, the stage's one light: white at this strength at its centre, nothing at its rim. */
export const GLOW_ALPHA = { light: 0.3, dark: 0.16 } as const;
/** The stage's lower edge as it lifts off Beranda: in dark a clear line, where navy over near-black would blur. */
export const HEM = { light: "#1f63e0", dark: "#6f8fd0" } as const;
/** The language chip's edge: white at this strength over the stage. */
export const CHIP_EDGE_ALPHA = 0.7;
