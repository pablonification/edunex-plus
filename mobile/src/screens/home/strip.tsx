// Beranda's strip about the Student (direction B): what they check every day as counts to tap, the official app's
// logbook numbers made theirs. Tasks still to do (Tugas's own "Belum selesai"), courses whose absences have run out
// (Kuliah), classes still to come today (Jadwal). A count of none is never "0": good news is a check and two words, and
// a day with no more classes has no cell. Each cell opens the page with the detail.
import { useT } from "../../../../src/app/i18n";
import { useTasksBadge } from "../../../../src/app/shell/badges";
import { useNav } from "../../nav";
import { useFirstFrameShown } from "../../shell/first-frame";
import { CountCell, CountStrip, useB } from "../../ui/b";

export function HomeStrip({ absences, classesLeft }: { absences: number; classesLeft: number }) {
  const t = useT();
  const b = useB();
  const { go } = useNav();
  // Counting every Task and exam is kept off the first frame (as the tabs' badges are): the cell stands in its shape.
  const counted = useFirstFrameShown();
  return (
    <CountStrip testID="home.strip">
      {counted ? <TasksCell /> : <CountCell pending value="" label={t("mobile.tab.tasks")} onPress={() => go({ screen: "tasks" })} testID="home.strip.tasks" />}
      {absences > 0 ? (
        <CountCell
          value={String(absences)}
          label={t("mobile.strip.absences")}
          ink={b.red}
          onPress={() => go({ screen: "presence" })}
          testID="home.strip.absences"
        />
      ) : (
        <CountCell mark value="" label={t("mobile.strip.absencesNone")} onPress={() => go({ screen: "presence" })} testID="home.strip.absences" />
      )}
      {classesLeft > 0 ? (
        <CountCell value={String(classesLeft)} label={t("mobile.strip.classes")} onPress={() => go({ screen: "schedule" })} testID="home.strip.classes" />
      ) : null}
    </CountStrip>
  );
}

function TasksCell() {
  const t = useT();
  const b = useB();
  const { go } = useNav();
  const badge = useTasksBadge();
  const open = () => go({ screen: "tasks" });
  if (!badge) return <CountCell mark value="" label={t("mobile.strip.tasksNone")} onPress={open} testID="home.strip.tasks" />;
  return (
    <CountCell
      value={String(badge.value)}
      label={t("mobile.tab.tasks")}
      ink={badge.tone === "warning" ? b.amber : undefined}
      onPress={open}
      testID="home.strip.tasks"
    />
  );
}
