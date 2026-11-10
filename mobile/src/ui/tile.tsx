// A course's mark (DESIGN.md "Course tiles"): its own glyph, solid in the course's own colour, with nothing behind it,
// so a course is known by colour and shape at a glance and is the same wherever it appears (Kuliah, Nilai, search,
// Notifikasi, Jadwal). The colour is the course's own (the picker's, or the automatic one), its ink from
// theme.courseTile; the glyph is Fluent's, filled, one per subject family, picked from what the course is about, the
// same every time.

import type { ComponentType } from "react";
import { View } from "react-native";
import { useCourseColor } from "../../../src/app/courses";
import { type CourseIconName, CourseIcons } from "./icons";
import { useTheme } from "./theme";

/** A course's glyph: always filled, at `size` in `color`. (`weight` and `duotoneOpacity` are the old family's: ignored.) */
type Glyph = ComponentType<{ size?: number; color?: string; weight?: "duotone" | "fill" | "regular"; duotoneOpacity?: number }>;

/**
 * What a course is about, by words in its name (Indonesian and English), first match wins. Each glyph's drawing loads
 * when a tile first draws it (../ui/icons.tsx says why), so only the term's few load.
 */
const BY_NAME: readonly [RegExp, CourseIconName][] = [
  [/tugas akhir|skripsi|proposal|thesis|capstone/i, "Thesis"],
  [/transport|infrastruktur|infrastructure|jalan|rel\b/i, "Transport"],
  [/komunikasi|pemasaran|marketing|communication|media/i, "Communication"],
  [/ekonomi|economic|keuangan|finance|bisnis|business/i, "Economy"],
  [/akuntansi|accounting|bank/i, "Accounting"],
  [/perencanaan|planning|kota|urban|wilayah|regional/i, "Planning"],
  [/arsitektur|architecture|bangunan|building/i, "Architecture"],
  [/jembatan|struktur|structur|sipil|civil/i, "Civil"],
  [/program|software|perangkat lunak|informatika|informatics|data/i, "Code"],
  [/elektro|electric|listrik|daya|power/i, "Electric"],
  [/komputer|computer|sistem digital|embedded|mikro/i, "Computer"],
  [/kimia|chemi|biologi|biolog|lab/i, "Lab"],
  [/fisika|physic|kuantum|quantum/i, "Physics"],
  [/matematika|math|kalkulus|calculus|statistik|statistic/i, "Math"],
  [/lingkungan|environment|hutan|forest|tanaman|plant/i, "Environment"],
  [/kesehatan|health|medis|medic|farmasi|pharma/i, "Health"],
  [/hukum|law|etika|ethic/i, "Law"],
  [/desain|design|seni|art|rupa/i, "Design"],
  [/gambar|drawing|teknik|engineering|metode|method/i, "Drawing"],
  [/manajemen|management|kewirausahaan|entrepreneur/i, "Management"],
  [/sosial|social|masyarakat|society|psikolog|psycholog/i, "Society"],
  [/bahasa|language|inggris|english|indonesia|global/i, "Language"],
];

/** Which glyph a course takes: by its name, else the open book. */
export function courseGlyphName(name: string | undefined): CourseIconName {
  return (name && BY_NAME.find(([words]) => words.test(name))?.[1]) || "Course";
}

/** The glyph for a course: by its name, else the open book. Draw it in the course's ink. */
export function courseGlyph(name: string | undefined): Glyph {
  return CourseIcons[courseGlyphName(name)] as Glyph;
}

/** The course's ink and tint, from its colour (the same the picker set). */
export function useCourseTile(): (code: string | null | undefined) => { ink: string; tint: string } {
  const tone = useCourseColor();
  const theme = useTheme();
  return (code) => theme.courseTile(tone(code));
}

/**
 * A course's mark at a row's start: its glyph in the course's colour, with no box behind it. `bare`: a solid dot in
 * the course's colour, while the course's official name (which picks the glyph) is still coming.
 */
export function CourseTile({ code, name, size = 44, bare = false }: { code: string; name: string | undefined; size?: number; bare?: boolean }) {
  const { ink } = useCourseTile()(code);
  const Glyph = courseGlyph(name);
  const dot = Math.round(size * 0.32);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {bare ? <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: ink }} /> : <Glyph size={Math.round(size * 0.64)} color={ink} />}
    </View>
  );
}

/** The course's glyph alone, in its ink (a tinted card's corner). */
export function CourseGlyph({ code, name, size = 22 }: { code: string; name: string | undefined; size?: number }) {
  const { ink } = useCourseTile()(code);
  const Glyph = courseGlyph(name);
  return <Glyph size={size} color={ink} />;
}
