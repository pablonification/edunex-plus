// What the engine needs from EduNex responses, verified against recordings
// (test/fixtures/edunex). Unknown extra fields are ignored; a missing or
// mistyped field the app relies on fails the check.
import { z } from "zod";

/** GET /login/me — also the liveness check. EduNex keeps the student number in `code`. */
export const LoginMe = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
});

/** GET /course/presences/list — the Student's course and class pairs for the current period. */
export const CoursePairs = z.array(
  z.object({
    course_id: z.number(),
    course_code: z.string(),
    courses_name: z.string(),
    class_id: z.number(),
    class_name: z.string(),
    semester: z.string(),
    year: z.string(),
  }),
);
