// "Yang berubah": the last week's changes, as src/app/screens/home.tsx shows them, on "Perlu kamu urus"'s screen (round
// 2, v4: one tap from Beranda). The bell keeps all of them, with the same words: "Lihat semua" opens its screen.
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import type { Alert, AlertKind } from "../../../../src/core/models";
import { type HomeContext, recentChanges } from "../../../../src/core/needs";
import { useNav } from "../../nav";
import { changeLines } from "../../parts/change-meta";
import { CourseIconTile } from "../../ui/course-icon-tile";
import { Group, GroupRow, Heading, IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { useShortCourseName } from "./parts";

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

/**
 * "Yang berubah" on "Perlu kamu urus"'s screen: the last week's changes as src/app/screens/home.tsx shows them, at most
 * five, then "Lihat semua" for the bell's whole history.
 */
export function Changes({ context }: { context: HomeContext }) {
  const t = useT();
  const { go } = useNav();
  const v = useTheme().v4;
  const history = useDataset("app.alerts");
  const all = useMemo(() => recentChanges(context, history?.items ?? []), [context, history]);
  const changes = all.slice(0, CHANGES_SHOWN);
  return (
    <View testID="section.changes">
      <Heading
        trailing={
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/alerts")}
            hitSlop={12}
            style={{ minHeight: 48, justifyContent: "center" }}
            testID="action.changes.all"
          >
            <Text size="labelLarge" weight="medium" style={{ color: v.brandInk }}>
              {t("home.changes.all")}
            </Text>
          </Pressable>
        }
      >
        {t("home.changes")}
      </Heading>
      {changes.length === 0 ? (
        <Text size="bodyMedium" style={{ color: v.muted, marginHorizontal: 4 }}>
          {t("home.changes.none")}
        </Text>
      ) : (
        <Group>
          {changes.map((item, i) => (
            <ChangeRow key={item.id} item={item} first={i === 0} onOpen={() => go(item.target)} />
          ))}
        </Group>
      )}
    </View>
  );
}

/** A change as v4's row: its kind's tile (amber when it asks something of the Student), what changed, one meta line, the day. */
function ChangeRow({ item, first, onOpen }: { item: Alert; first: boolean; onOpen: () => void }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const Icon = CHANGE_ICON[item.kind] ?? Icons.Bell;
  const glyph = (color: string) => <Icon size={22} color={color} />;
  const important = IMPORTANT.has(item.title.key) || (item.body !== null && item.body !== undefined && IMPORTANT_BODY.has(item.body.key));
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  const name = useShortCourseName();
  const { title, meta, spoken } = changeLines(t, item, name);
  // The day it was seen ("Hari ini", "Kemarin"), never the clock time of the read that saw it (a sync at 00:45 isn't
  // when anything happened): the event's own time is in the meta line.
  const when = f.relativeDay(item.at);
  return (
    <GroupRow
      first={first}
      testID={`row.change.${item.id}`}
      accessibilityLabel={factsLabel(...spoken, when)}
      leading={important ? <IconTile tone="amber" icon={glyph} /> : code ? <CourseIconTile code={code} icon={glyph} /> : <IconTile tone="plain" icon={glyph} />}
      title={
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
      }
      // One line, short where the desktop's runs long (../../parts/change-meta.ts); TalkBack reads it all.
      meta={
        meta ? (
          <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted }}>
            {meta}
          </Text>
        ) : undefined
      }
      trailing={
        <Text size="labelMedium" tabular style={{ color: v.muted }}>
          {when}
        </Text>
      }
      onPress={onOpen}
    />
  );
}
