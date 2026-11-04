// A course's absences by its code, as Jadwal's details on the desktop read them for a meeting (src/app/screens/schedule/
// details.tsx's AttendanceFact): a meeting Edunex announced has no SIX class of its own to carry them, yet its course's
// budget ("Sisa jatah absen 2×") is the same. Null while there's nothing to say: no course by that code, or no count yet.
import { useAttendance } from "../../../src/app/attendance";
import type { AttendanceHealth } from "../../../src/core/attendance";

export function useCourseHealth(code: string | null): AttendanceHealth | null {
  const attendance = useAttendance();
  if (code === null) return null;
  const health = attendance?.courses.find((course) => course.course.code === code)?.health;
  return health && health.countedIn !== "unknown" && health.state !== "unknown" ? health : null;
}
