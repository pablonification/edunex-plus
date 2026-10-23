// The colors the Student picked for their courses, and the automatic color
// each course got when it first showed, so it never moves by itself. Kept on
// this computer ("local.courseColors", saved with "local.set") and removed
// when they sign out of everything. By course code, so a course keeps its
// color in every term it's taken. The rules live in core/course-colors.ts.
import { z } from "zod";

/**
 * A palette color's name ("blue"), never renamed once released. The format is
 * checked, not the name: an id a later version adds, or one an older version
 * had, still loads (as automatic). Never narrow it: retire an id by leaving it
 * out of the palette.
 */
export const CourseColorId = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);

/** As a course's own attendance target (`Settings.attendanceTargets`). */
const Code = z.string().min(1).max(32);
/** More than a whole degree's courses. */
export const MAX_COURSE_COLORS = 200;
const capped = <T extends z.ZodTypeAny>(value: T) =>
  z.record(Code, value).refine((entries) => Object.keys(entries).length <= MAX_COURSE_COLORS, "Too many course colors");

export const CourseColors = z.object({
  /** The Student's picks. `at` (ms) decides which go first past the cap. */
  picks: capped(z.object({ color: CourseColorId, at: z.number() })),
  /** The automatic color each course got when it first showed. Optional, so a value without it still loads. */
  automatic: capped(CourseColorId).optional(),
});
export type CourseColors = z.infer<typeof CourseColors>;

export const courseColorDatasets = {
  "local.courseColors": CourseColors,
} as const;
