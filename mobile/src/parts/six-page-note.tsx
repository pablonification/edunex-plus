// What a screen says about the SIX pages its data comes from (src/app/six-page-note.tsx): a page
// whose layout changed (its data stays as last read, and says from when), else the rows the app
// left out or kept with a blank cell, as SIX writes them, with a way to check it on SIX and to
// report it. Nothing to say: nothing shown.
import { View } from "react-native";
import { useOpenExternal } from "../../../src/app/hooks";
import { useFormat, useT } from "../../../src/app/i18n";
import { useDataset, useDatasetPayload, useStatus } from "../../../src/app/store";
import { SIX_WEB, sixPageOf, sixTimetableUrl } from "../../../src/core/links";
import type { ChangedPage, DatasetName } from "../../../src/core/models";
import { dayNoon } from "../../../src/core/schedule";
import { Button } from "../ui/controls";
import { Icons } from "../ui/icons";
import { Notice } from "../ui/layout";
import { Text } from "../ui/text";
import { useTheme } from "../ui/theme";
import { ReportButton } from "./report";

/** SIX's timetable on `day`'s month ("Buka jadwal di SIX"), where a class the app couldn't read has its time and room (ADR 0013). */
export function OpenSixTimetable({ day, primary }: { day: string; primary?: boolean }) {
  const t = useT();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  return (
    <Button
      size="sm"
      variant={primary ? "primary" : "secondary"}
      icon={<Icons.ArrowUpRight size={14} />}
      onPress={() => open(student ? sixTimetableUrl(student, dayNoon(day)) : SIX_WEB)}
    >
      {t("schedule.unread.open")}
    </Button>
  );
}

/** The SIX page among `datasets`' that changed while the rest of SIX reads (SourceStatus.changedPages), if any. */
export function useChangedPage(datasets: readonly DatasetName[]): ChangedPage | undefined {
  const status = useStatus("six");
  if (status.state === "signed-out") return undefined;
  return status.changedPages?.find((page) => page.datasets.some((name) => datasets.includes(name as DatasetName)));
}

/** `datasets`: what the screen shows from SIX, the one it shows most first. */
export function SixPageNote({ datasets }: { datasets: readonly DatasetName[] }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const page = useChangedPage(datasets);
  const last = useDatasetPayload(datasets.find((name) => page?.datasets.includes(name)) ?? datasets[0]!);
  const skipped = useDataset("six.skipped");
  const student = useDataset("six.student");
  const openSix = (name: DatasetName) => (
    <>
      <Button size="sm" onPress={() => open(student ? sixPageOf(name, student) : SIX_WEB)}>
        {t("sixPage.openSix")}
      </Button>
      <ReportButton about={{ datasets: [...datasets] }} />
    </>
  );

  if (page) {
    return (
      <Notice tone="warning" title={t("sixPage.changed")} action={openSix(datasets.find((name) => page.datasets.includes(name))!)} testID="note.sixChanged">
        {last ? t("sixPage.changedSince", { when: f.dayTimeWord(last.fetchedAt) }) : t("sixPage.changedNever")}
      </Notice>
    );
  }

  const left = datasets.filter((name) => skipped?.[name]?.length);
  const rows = left.flatMap((name) => skipped![name]!.map((row) => ({ ...row, key: `${name} ${row.row} ${row.why}` })));
  if (!rows.length) return null;
  const blank = rows.every((row) => row.blank);
  return (
    <Notice
      tone="neutral"
      title={t(blank ? "skipped.blankTitle" : "skipped.title", { count: rows.length })}
      action={openSix(left[0]!)}
      testID="note.sixSkipped"
    >
      <Text size="small">{t(blank ? "skipped.blankBody" : "skipped.body", { count: rows.length })}</Text>
      <View style={{ marginTop: 6, gap: 2 }}>
        {rows.map((row) => (
          <Text key={row.key} size="caption" tabular>
            {row.row}
          </Text>
        ))}
      </View>
    </Notice>
  );
}

/** The courses an estimate leaves out because SIX writes their grade or SKS in a way the app can't read yet. */
export function UnreadNote({ record }: { record: { unread: readonly { code: string }[] } }) {
  const t = useT();
  const theme = useTheme();
  const count = record.unread.length;
  if (!count) return null;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <View style={{ paddingTop: 3 }}>
        <Icons.Info size={14} color={theme.color.muted} />
      </View>
      <Text size="small" tone="muted" style={{ flex: 1 }}>
        {count > 3 ? t("sixRecords.unreadMany", { count }) : t("sixRecords.unread", { codes: record.unread.map((course) => course.code).join(", "), count })}
      </Text>
    </View>
  );
}
