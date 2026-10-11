// The Student's SIX records and ITB's public pages for the grades and planner
// tests, read from the recorded (scrubbed) pages by the real readers, so the
// tests see exactly what the app would. Each call returns fresh copies.
import type { AcademicCalendar, CourseCatalog, Curriculum, Progress, Transcript } from "../../src/core/models";
import { readCalendar } from "../../src/engine/sources/itb/calendar";
import { readProgramList, readProgramPage } from "../../src/engine/sources/itb/catalog-pages";
import { withProgramList, withProgramPage } from "../../src/engine/sources/itb/catalog";
import { fetchCurriculum } from "../../src/engine/sources/six/records";
import { readProgress } from "../../src/engine/sources/six/readers/progress";
import { readTranscript } from "../../src/engine/sources/six/readers/transcript";
import { publicPage, sixPage } from "../kit/fixtures";
import { calendarFixture } from "../pretend/itb";

export interface Records {
  transcript: Transcript;
  progress: Progress;
  curriculum: Curriculum;
  catalog: CourseCatalog;
  calendar: AcademicCalendar;
}

const escape = (path: string) => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

export async function records(): Promise<Records> {
  const { progress, ipk } = readProgress(sixPage(/\/transkrip\/kurikulum\/\d+$/));
  const transcript = readTranscript(sixPage(/\/transkrip\/historis\/\d+$/), ipk);
  const curriculum = await fetchCurriculum({
    who: async () => ({ nim: "18223901", studentId: "2021000001", term: "2026-1" }),
    page: async (path) => sixPage(escape(path)),
  });
  let catalog = withProgramList(undefined, readProgramList(publicPage("kur2024")), 0);
  for (const id of ["154", "174", "182"]) catalog = withProgramPage(catalog, id, readProgramPage(publicPage(`kur2024-${id}`)), 0);
  return { transcript, progress, curriculum, catalog, calendar: readCalendar(calendarFixture(), 0) };
}
