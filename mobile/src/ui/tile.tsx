// A course's tile (round 2, v4; DESIGN.md "Course tiles"): a rounded square in the course's tint holding a filled
// two-tone icon in its ink, as Grab's and GoPay's service tiles, so a course is known by colour and shape at a glance.
// The colour is the course's own (the picker's, or the automatic one), its ink and tint from theme.courseTile; the
// icon is picked from what the course is about, the same every time.

import { AtomIcon } from "phosphor-react-native/src/icons/Atom";
import { BankIcon } from "phosphor-react-native/src/icons/Bank";
import { BookOpenIcon } from "phosphor-react-native/src/icons/BookOpen";
import { BridgeIcon } from "phosphor-react-native/src/icons/Bridge";
import { BriefcaseIcon } from "phosphor-react-native/src/icons/Briefcase";
import { BuildingsIcon } from "phosphor-react-native/src/icons/Buildings";
import { CalculatorIcon } from "phosphor-react-native/src/icons/Calculator";
import { ChartLineUpIcon } from "phosphor-react-native/src/icons/ChartLineUp";
import { CodeIcon } from "phosphor-react-native/src/icons/Code";
import { CpuIcon } from "phosphor-react-native/src/icons/Cpu";
import { FlaskIcon } from "phosphor-react-native/src/icons/Flask";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { GraduationCapIcon } from "phosphor-react-native/src/icons/GraduationCap";
import { HeartbeatIcon } from "phosphor-react-native/src/icons/Heartbeat";
import { LeafIcon } from "phosphor-react-native/src/icons/Leaf";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { MapTrifoldIcon } from "phosphor-react-native/src/icons/MapTrifold";
import { MegaphoneIcon } from "phosphor-react-native/src/icons/Megaphone";
import { PaintBrushIcon } from "phosphor-react-native/src/icons/PaintBrush";
import { PencilRulerIcon } from "phosphor-react-native/src/icons/PencilRuler";
import { ScalesIcon } from "phosphor-react-native/src/icons/Scales";
import { TrainIcon } from "phosphor-react-native/src/icons/Train";
import { UsersIcon } from "phosphor-react-native/src/icons/Users";
import type { ComponentType } from "react";
import { View } from "react-native";
import { useCourseColor } from "../../../src/app/courses";
import { useTheme } from "./theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: "duotone" | "fill" | "regular"; duotoneOpacity?: number }>;

/** What a course is about, by words in its name (Indonesian and English), first match wins. */
const BY_NAME: readonly [RegExp, Glyph][] = [
  [/tugas akhir|skripsi|proposal|thesis|capstone/i, GraduationCapIcon],
  [/transport|infrastruktur|infrastructure|jalan|rel\b/i, TrainIcon],
  [/komunikasi|pemasaran|marketing|communication|media/i, MegaphoneIcon],
  [/ekonomi|economic|keuangan|finance|bisnis|business/i, ChartLineUpIcon],
  [/akuntansi|accounting|bank/i, BankIcon],
  [/perencanaan|planning|kota|urban|wilayah|regional/i, MapTrifoldIcon],
  [/arsitektur|architecture|bangunan|building/i, BuildingsIcon],
  [/jembatan|struktur|structur|sipil|civil/i, BridgeIcon],
  [/program|software|perangkat lunak|informatika|informatics|data/i, CodeIcon],
  [/elektro|electric|listrik|daya|power/i, LightningIcon],
  [/komputer|computer|sistem digital|embedded|mikro/i, CpuIcon],
  [/kimia|chemi|biologi|biolog|lab/i, FlaskIcon],
  [/fisika|physic|kuantum|quantum/i, AtomIcon],
  [/matematika|math|kalkulus|calculus|statistik|statistic/i, CalculatorIcon],
  [/lingkungan|environment|hutan|forest|tanaman|plant/i, LeafIcon],
  [/kesehatan|health|medis|medic|farmasi|pharma/i, HeartbeatIcon],
  [/hukum|law|etika|ethic/i, ScalesIcon],
  [/desain|design|seni|art|rupa/i, PaintBrushIcon],
  [/gambar|drawing|teknik|engineering|metode|method/i, PencilRulerIcon],
  [/manajemen|management|kewirausahaan|entrepreneur/i, BriefcaseIcon],
  [/sosial|social|masyarakat|society|psikolog|psycholog/i, UsersIcon],
  [/bahasa|language|inggris|english|indonesia|global/i, GlobeIcon],
];

/** The tile's glyph for a course: by its name, else the open book. */
export function courseGlyph(name: string | undefined): Glyph {
  return (name && BY_NAME.find(([words]) => words.test(name))?.[1]) || BookOpenIcon;
}

/** The course's ink and tint, from its colour (the same the picker set). */
export function useCourseTile(): (code: string | null | undefined) => { ink: string; tint: string } {
  const tone = useCourseColor();
  const theme = useTheme();
  return (code) => theme.courseTile(tone(code));
}

/** `bare`: the tint alone, while the course's official name (which picks the glyph) is still coming. */
export function CourseTile({ code, name, size = 44, bare = false }: { code: string; name: string | undefined; size?: number; bare?: boolean }) {
  const { ink, tint } = useCourseTile()(code);
  const Glyph = courseGlyph(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: tint, alignItems: "center", justifyContent: "center" }}
    >
      {!bare && <Glyph size={Math.round(size * 0.52)} color={ink} weight="duotone" duotoneOpacity={0.35} />}
    </View>
  );
}

/** The course's glyph alone, in its ink (a tinted card's corner). */
export function CourseGlyph({ code, name, size = 22 }: { code: string; name: string | undefined; size?: number }) {
  const { ink } = useCourseTile()(code);
  const Glyph = courseGlyph(name);
  return <Glyph size={size} color={ink} weight="duotone" duotoneOpacity={0.35} />;
}
