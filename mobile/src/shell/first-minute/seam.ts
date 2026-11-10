// Where the first minute hands over to Beranda (./scene.tsx), and all the scene knows about Beranda. It's little, on
// purpose: the stage is the scene's own colour (./colors.ts) and leaves like a curtain, upward, taking its doors, its
// mark and its greeting with it. Beranda was under it all along, its blocks in their places and filling as the first
// read brings them, so the scene needs no position, size or colour of anything on Beranda, and leaves nothing on it.
// A new Beranda re-points only this:
//
//   statusBar   the status bar's icons over Beranda's page, once the stage has left it
//   edge        the curtain's lower corners, rounded like Beranda's own blocks
import { shape } from "../../ui/theme";

export const seam = {
  /** The status bar's icons over Beranda's page: dark on its white page, light on its dark one. */
  statusBar: (scheme: "light" | "dark"): "light" | "dark" => (scheme === "dark" ? "light" : "dark"),
  /** The curtain's lower corners (dp). */
  edge: shape.xl,
} as const;
