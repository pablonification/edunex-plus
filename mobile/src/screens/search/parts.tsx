// Search's parts (direction B): flat rows on the white page with a hairline between them, each one tap to the exact
// thing. A row leads with its course's own glyph in its colour, its kind (a Task, an exam, a file) a small mark at
// the glyph's corner; a service is its own solid circle, as on Beranda and Semua layanan. The quiet line is one line:
// the course's name in its colour, then what differs. The typed part of a name is marked in the brand colour.
import { type ComponentType, memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BHeading, ServiceCircle, useB } from "../../ui/b";
import { type IconProps, Icons } from "../../ui/icons";
import { Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import type { Service } from "../services/list";
import { markedSpans } from "./services";

/** A service's mark: the list's own small solid tile (its `icon` and `tone`), the same look as Semua layanan's. */
export function ServiceMark({ service }: { service: Service }) {
  return (
    <View style={styles.mark}>
      <ServiceCircle icon={service.icon} tone={service.tone} size={36} />
    </View>
  );
}

/**
 * A course's mark: its own glyph in its colour, as on Kuliah and Nilai; never one cap for every course. On a Task's,
 * an exam's or a material's row, `kind` is what the thing is, small at the glyph's corner on a patch of the page.
 */
export function CourseMark({ code, name }: { code: string; name: string | undefined }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
      <CourseGlyph code={code} name={name} size={24} />
    </View>
  );
}

/** A thing's kind as its bare glyph, in its course's colour when it has one (or `color`: a state's, such as amber). */
export function KindMark({ icon: Icon, code, color: own }: { icon: ComponentType<IconProps>; code: string | null; color?: string }) {
  const b = useB();
  const course = useCourseTile();
  const color = own ?? (code ? course(code).ink : b.fg2);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
      <Icon size={24} color={color} />
    </View>
  );
}

/** The name with the typed words marked: each word's first place in it, case and accents forgiven. */
export function Marked({ text, query }: { text: string; query: string }) {
  const b = useB();
  const spans = markedSpans(text, query);
  return (
    <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: b.fg }}>
      {spans.map(([part, on], i) =>
        on ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the spans of one name, in order
          <Text key={i} size="bodyLarge" weight="bold" style={{ color: b.brand }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** One result: its mark, its name, one quiet line; the whole row one target, a hairline under all but the last. */
export const ResultRow = memo(function ResultRow({
  leading,
  title,
  course,
  kind: Kind,
  meta,
  metaWhole = false,
  chevron = false,
  last,
  onPress,
  testID,
  label,
}: {
  leading: ReactNode;
  title: ReactNode;
  /** The course a Task, exam or material belongs to: named in the page's ink before the quiet line (its colour is its glyph's). */
  course?: { code: string; name: string };
  /** What the thing is (a Task, an exam, a file), small before the quiet line, as Tugas's rows say it. */
  kind?: ComponentType<IconProps>;
  meta?: string;
  /** The quiet line is a date: it stays whole and the course's name gives way (cut with "…"), never the other way. */
  metaWhole?: boolean;
  /** It opens something: the quiet chevron at its end. */
  chevron?: boolean;
  last: boolean;
  onPress(): void;
  testID: string;
  label: string;
}) {
  const b = useB();
  return (
    <Tap feel="row" onPress={onPress} testID={testID} accessibilityLabel={label}>
      <View style={styles.row}>
        {leading}
        <View style={[styles.body, { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, borderBottomColor: b.line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title}
            {course || meta ? (
              // One line, whatever the font size: the two parts sit side by side and the longer one is cut, not wrapped.
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {Kind && (
                  <View style={{ marginRight: space[1] }}>
                    <Kind size={16} color={b.muted} />
                  </View>
                )}
                {course && (
                  <Text size="bodyMedium" numberOfLines={1} style={{ flexShrink: 1, color: b.fg2 }}>
                    {course.name}
                  </Text>
                )}
                {meta ? (
                  <Text
                    size="bodyMedium"
                    tabular
                    numberOfLines={1}
                    style={{ flexShrink: metaWhole ? 0 : 1, maxWidth: course ? "78%" : "100%", color: b.muted }}
                  >
                    {course ? ` · ${meta}` : meta}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          {chevron && <Icons.ChevronRight size={20} color={b.muted} />}
        </View>
      </View>
    </Tap>
  );
});

/** A section's name over its rows: B's heading, with the space a section needs above it. */
export function SectionHeading({ children, first }: { children: string; first: boolean }) {
  return <BHeading style={{ marginTop: first ? space[2] : space[6], marginBottom: space[1] }}>{children}</BHeading>;
}

/** Something opened lately, as a chip: one tap opens it again. `leading` replaces the clock (a course's own glyph). */
export function RecentChip({ label, onPress, testID, leading }: { label: string; onPress(): void; testID: string; leading?: ReactNode }) {
  const b = useB();
  return (
    <Tap feel="tile" onPress={onPress} testID={testID} accessibilityLabel={label} style={[styles.chip, { borderColor: b.line }]}>
      {leading ?? <Icons.History size={16} color={b.muted} />}
      <Text size="labelLarge" numberOfLines={1} style={{ color: b.fg, maxWidth: 200 }}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  mark: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 64 },
  body: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: space[3] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    minHeight: 48,
    paddingHorizontal: space[4],
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
