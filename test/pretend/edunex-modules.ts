// What II4091's modules hold in the pretend Edunex. No module's contents were
// ever recorded (only course-wide ones), so these are made up in the real
// shape: the kinds a real II4091 module holds (a lecturer's link written as a
// one-line note, LaTeX templates as zip uploads, PDF slides), with invented
// names, links and sizes. The joint class carries its own copies, as it does
// on Edunex. The pretend Edunex clones a recorded content record for each.

export interface ModuleContent {
  courseId: number;
  moduleId: number;
  name: string;
  type: string;
  content: string;
  size: number | null;
  /** When the lecturer posted it, as Edunex writes it. */
  at: string;
}

const file = (name: string) => `https://edunexfixture.blob.core.windows.net/edunex/fixture-${name}`;

export const MODULE_CONTENTS: readonly ModuleContent[] = [
  {
    courseId: 95326,
    moduleId: 450218,
    name: "Link Penawaran Topik TA",
    type: "text",
    content: '<p><a href="https://docs.google.com/spreadsheets/d/fixture-topik-ta/edit">Penawaran topik TA 2026-2027</a></p>',
    size: null,
    at: "2026-08-28T14:10:00+07:00",
  },
  {
    courseId: 95326,
    moduleId: 450220,
    name: "Template Proposal TA - LaTeX",
    type: "zip",
    content: file("template-proposal"),
    size: 8_402_113,
    at: "2026-08-28T14:12:00+07:00",
  },
  {
    courseId: 95326,
    moduleId: 450220,
    name: "Template Laporan TA - LaTeX",
    type: "zip",
    content: file("template-laporan"),
    size: 1_004_200,
    at: "2026-08-28T14:12:30+07:00",
  },
  {
    courseId: 95326,
    moduleId: 450219,
    name: "Slide Pengantar Proposal TA",
    type: "pdf",
    content: file("slide-pengantar"),
    size: 2_310_544,
    at: "2026-09-04T09:20:00+07:00",
  },
  {
    courseId: 97602,
    moduleId: 460708,
    name: "Topik TA dari Dosen",
    type: "text",
    content:
      '<p><strong>Daftar topik dari dosen:</strong> <a href="https://docs.google.com/spreadsheets/d/fixture-topik-dosen/edit">Topik TA Dosen 2026</a></p>',
    size: null,
    at: "2026-08-28T14:15:00+07:00",
  },
  {
    courseId: 97602,
    moduleId: 460710,
    name: "Template Proposal TA - LaTeX",
    type: "zip",
    content: file("template-proposal-gabungan"),
    size: 8_402_113,
    at: "2026-08-28T14:16:00+07:00",
  },
  {
    courseId: 97602,
    moduleId: 460709,
    name: "Slide Pengantar Proposal TA",
    type: "pdf",
    content: file("slide-pengantar-gabungan"),
    size: 2_310_544,
    at: "2026-09-04T09:22:00+07:00",
  },
];
