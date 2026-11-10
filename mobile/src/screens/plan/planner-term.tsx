// A semester of the plan (round 2, v4): its heading with the one line that sums it up (SKS of the limit, the IP it
// expects, the IPK after it), then its courses as rows in one card. A course row: the course's tile, its name, one
// quiet line (code · SKS · its tag), and its grade at the end, a tap on it a sheet of grades. A tap on the row opens
// what else can be done with the course (move it, remove it, leave it out this semester); a long press too. The
// semester's last row adds a course.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import type { LetterGrade } from "../../../../src/core/models";
import type { ProjectedStep } from "../../../../src/core/planner";
import { Button, IconButton } from "../../ui/controls";
import { Group, GroupRow, IconTile, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { SectionHeading } from "./planner-kit";
import { GradeSelect } from "./projection";

/** A semester: its heading and line, its courses in one card, and the row that adds one. */
export function TermSection({
  term,
  title,
  whatIf = false,
  sks,
  limit,
  step,
  onAdd,
  addLabel,
  onRemove,
  removeLabel,
  children,
}: {
  term: string;
  title: string;
  /** The semester holds what-ifs: the heading says they're only in the plan. */
  whatIf?: boolean;
  sks: number;
  limit: number | null;
  step: ProjectedStep | undefined;
  onAdd?: () => void;
  addLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const over = limit !== null && sks > limit;
  const meta = factsLabel(
    `${sks}${limit !== null ? ` / ${limit}` : ""} SKS`,
    step && `IP ${step.ip === null ? "-" : f.number(step.ip, 2)}`,
    step && t("planner.ipkAfter", { ipk: step.ipk === null ? "-" : f.number(step.ipk, 2) }),
  );
  return (
    <View testID={`card.term.${term}`}>
      <SectionHeading
        title={title}
        meta={meta}
        // Over the limit: said by an icon too, never by the red alone.
        metaTone={over ? "red" : "muted"}
        metaIcon={over ? (color) => <Icons.AlertTriangle size={14} color={color} weight="bold" /> : undefined}
        trailing={
          whatIf ? (
            <View accessible accessibilityLabel={t("planner.nowWhatIf")} accessibilityLiveRegion="polite">
              <Pill tone="brand">{t("planner.whatIfTag")}</Pill>
            </View>
          ) : onRemove ? (
            <IconButton label={removeLabel ?? ""} onPress={onRemove} testID={`action.removeTerm.${term}`}>
              <Icons.X size={18} color={v.muted} />
            </IconButton>
          ) : undefined
        }
      />
      <Group>
        {children}
        {onAdd && (
          <GroupRow
            leading={<IconTile icon={(color) => <Icons.Plus size={22} color={color} weight="bold" />} />}
            title={
              <Text size="labelLarge" weight="semibold" style={{ color: v.brandInk }}>
                {addLabel ?? t("planner.addCourse")}
              </Text>
            }
            onPress={onAdd}
            testID={`action.addCourse.${term}`}
          />
        )}
      </Group>
    </View>
  );
}

/**
 * A course's row in a semester: its tile, its name, one line (code · SKS · its tag), its grade. `flag`: the course's
 * own warning (odd/even, earlier than the curriculum), an icon on the line; its words are in the row's sheet.
 */
export function CourseRow({
  code,
  name,
  sks,
  tag,
  flag,
  grade,
  guess,
  posted,
  onGrade,
  onMore,
  first,
}: {
  code: string;
  name: string;
  sks: number;
  tag?: string | null;
  flag?: string;
  grade: LetterGrade;
  guess?: boolean;
  posted?: boolean;
  onGrade: (grade: LetterGrade) => void;
  onMore?: () => void;
  first?: boolean;
}) {
  const t = useT();
  const v = useTheme().v4;
  const line = factsLabel(code, `${sks} SKS`, tag);
  return (
    <GroupRow
      first={first}
      leading={<CourseTile code={code} name={name} />}
      title={name}
      meta={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
          {flag ? <Icons.AlertTriangle size={14} color={v.ambFg} weight="bold" /> : null}
          <Text size="bodyMedium" tabular style={{ color: v.muted, flexShrink: 1 }}>
            {line}
          </Text>
        </View>
      }
      trailing={
        posted ? (
          <View
            accessibilityLabel={`${t("grades.sixGrade")}: ${grade}`}
            style={{ minWidth: 52, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: v.chip }}
          >
            <Text size="labelLarge" face="display" weight="bold" style={{ color: v.fg2 }}>
              {grade}
            </Text>
          </View>
        ) : (
          <GradeSelect label={t("grades.expectedOf", { code })} value={grade} guess={guess} onChange={onGrade} testID={`action.grade.${code}`} />
        )
      }
      onPress={onMore}
      onLongPress={onMore}
      accessibilityLabel={factsLabel(code, name, `${sks} SKS`, tag, flag)}
      accessibilityHint={onMore ? t("mobile.planner.options", { code }) : undefined}
      testID={`row.course.${code}`}
    />
  );
}

/** A KRS course the Student left out as a what-if: crossed out where it was, with the way back. */
export function DroppedRow({ code, name, sks, onPutBack, first }: { code: string; name: string; sks: number; onPutBack: () => void; first?: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const struck = { textDecorationLine: "line-through" } as const;
  return (
    <GroupRow
      first={first}
      leading={
        <View style={{ opacity: 0.45 }}>
          <CourseTile code={code} name={name} />
        </View>
      }
      title={
        <Text size="bodyLarge" style={[{ color: v.muted }, struck]}>
          {name}
        </Text>
      }
      meta={factsLabel(code, `${sks} SKS`, t("planner.droppedTag"))}
      trailing={
        <Button size="sm" variant="ghost" label={t("planner.putBackCode", { code })} onPress={onPutBack} testID={`action.putBack.${code}`}>
          {t("planner.putBack")}
        </Button>
      }
      testID={`row.course.${code}`}
    />
  );
}

/** A semester with nothing in it yet: why, in one line (the row under it adds a course). */
export function EmptyRow({ text }: { text: string }) {
  const v = useTheme().v4;
  return (
    <GroupRow
      first
      title={
        <Text size="bodyMedium" style={{ color: v.muted }}>
          {text}
        </Text>
      }
    />
  );
}
