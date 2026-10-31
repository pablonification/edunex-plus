// "Yang berubah": one row on Beranda (how many changed this week, the newest), opening a sheet with the last
// few as src/app/screens/home.tsx shows them. The bell keeps all of them, with the same words: "Lihat semua"
// opens its screen.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useCourseColor } from "../../../../src/app/courses";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import type { Alert, AlertKind } from "../../../../src/core/models";
import { type HomeContext, recentChanges } from "../../../../src/core/needs";
import { useNav } from "../../nav";
import { Button } from "../../ui/controls";
import { CourseDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Row, Section } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { toned } from "./parts";

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
  const theme = useTheme();
  const { go } = useNav();
  const history = useDataset("app.alerts");
  const [open, setOpen] = useState(false);
  const all = useMemo(() => recentChanges(context, history?.items ?? []), [context, history]);
  const changes = all.slice(0, CHANGES_SHOWN);
  const newest = changes[0];
  const leave = (then: () => void) => {
    setOpen(false);
    then();
  };
  return (
    <Section testID="section.changes">
      <List>
        <Row
          testID="action.changes"
          leading={<Icons.History size={22} color={theme.color.onSurfaceVariant} />}
          title={
            <Text size="bodyLarge" weight="medium">
              {t("home.changes")}
              {all.length > 0 && (
                <Text size="bodyLarge" tone="muted" tabular>
                  {`  ${all.length}`}
                </Text>
              )}
            </Text>
          }
          meta={
            <Text size="bodyMedium" tone="muted" numberOfLines={1}>
              {newest ? t(newest.title.key, newest.title.vars) : t("home.changes.none")}
            </Text>
          }
          // Nothing changed: the bell still has the history.
          onPress={() => (changes.length ? setOpen(true) : router.push("/alerts"))}
        />
      </List>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("home.changes")}
        testID="sheet.changes"
        footer={
          <Button variant="tonal" onPress={() => leave(() => router.push("/alerts"))} testID="action.changes.all">
            {t("home.changes.all")}
          </Button>
        }
      >
        <View style={{ marginHorizontal: -space[6] }}>
          {changes.map((item) => (
            <ChangeRow key={item.id} item={item} onOpen={() => leave(() => go(item.target))} />
          ))}
        </View>
      </Sheet>
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
