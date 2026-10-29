// "Yang berubah": a short look at the last week's changes, as src/app/screens/home.tsx shows them.
// The bell keeps all of them, with the same words: "Lihat semua" opens its screen.
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useCourseColor } from "../../../../src/app/courses";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import type { Alert, AlertKind } from "../../../../src/core/models";
import { type HomeContext, recentChanges } from "../../../../src/core/needs";
import { useNav } from "../../nav";
import { CourseDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Row, Section } from "../../ui/layout";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { Quiet, toned } from "./parts";

/** "Yang berubah" shows this many; the bell has the rest. */
const CHANGES_SHOWN = 5;

const CHANGE_ICON: Partial<Record<AlertKind, typeof Icons.Home>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  taskEdited: Icons.PenLine,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.Megaphone,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
};
const IMPORTANT: ReadonlySet<string> = new Set(["alert.taskEdited.afterSubmit", "alert.materialToday", "home.change.moved", "home.change.meeting"]);
/** An edit after hand-in whose title names the change ("Tenggat diundur ke …") still says so in its body. */
const IMPORTANT_BODY: ReadonlySet<string> = new Set(["alert.taskEdited.afterSubmit.body", "alert.taskEdited.count.after"]);

export function Changes({ context }: { context: HomeContext }) {
  const t = useT();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  const all = useMemo(() => recentChanges(context, history?.items ?? []), [context, history]);
  const changes = all.slice(0, CHANGES_SHOWN);
  return (
    <Section
      title={t("home.changes")}
      testID="section.changes"
      action={
        <Pressable accessibilityRole="link" onPress={() => router.push("/alerts")} hitSlop={12} testID="action.changes.all">
          <Text size="small" weight="medium" tone="accent">
            {t("home.changes.all")}
          </Text>
        </Pressable>
      }
    >
      {changes.length === 0 ? (
        <Quiet>{t("home.changes.none")}</Quiet>
      ) : (
        <List>
          {changes.map((item) => (
            <ChangeRow key={item.id} item={item} onOpen={() => go(item.target)} />
          ))}
        </List>
      )}
    </Section>
  );
}

function ChangeRow({ item, onOpen }: { item: Alert; onOpen: () => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const Icon = CHANGE_ICON[item.kind] ?? Icons.Bell;
  const important = IMPORTANT.has(item.title.key) || (item.body !== null && item.body !== undefined && IMPORTANT_BODY.has(item.body.key));
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  const colorOf = useCourseColor();
  return (
    <Row
      testID={`row.change.${item.id}`}
      leading={
        <View style={{ marginTop: 2 }}>
          <Icon size={18} color={important ? theme.color.warningFg : theme.color.faint} />
          {code && (
            <View style={{ position: "absolute", right: -4, bottom: -4, padding: 2, borderRadius: 3, backgroundColor: theme.color.surface }}>
              <CourseDot color={colorOf(code)} size={8} />
            </View>
          )}
        </View>
      }
      title={<Meta>{toned(t(item.title.key, item.title.vars), "fg", { size: "body", weight: "medium" })}</Meta>}
      // Whole on a phone: there's no pointer to show a cut line in full.
      meta={item.body ? <Meta>{t(item.body.key, item.body.vars)}</Meta> : undefined}
      trailing={
        <Text size="caption" tabular tone="faint">
          {f.dayOffset(item.at) === 0 ? f.time(item.at) : f.relativeDay(item.at)}
        </Text>
      }
      onPress={onOpen}
    />
  );
}
