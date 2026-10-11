// An EduNex session: the access token read after sign-in (see signin.ts).
import { z } from "zod";

export const EdunexSession = z.object({ token: z.string().min(1) });
export type EdunexSession = z.infer<typeof EdunexSession>;
