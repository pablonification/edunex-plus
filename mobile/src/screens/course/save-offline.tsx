// "Simpan untuk offline" (src/app/screens/course.tsx's MoreMenu): every file of the course into the
// app's downloads (mobile/src/host/save-offline.ts), each then opening offline from its own row.
// The menu's choice says how many files and how big, as the desktop's; while it saves, the page says
// how far it has got, and the result is said the desktop's way. A phone has no folder to pick, so
// "Simpan ke folder lain…" isn't offered.
import { useMemo, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { errorKey } from "../../../../src/app/bridge";
import { useFormat, useLang, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useBridge } from "../../../../src/app/store";
import { planOfflineFiles } from "../../../../src/core/course-materials";
import { type SaveProgress, saveProgress } from "../../host/save-offline";
import { toast } from "../../swaps/overlays";
import { ProgressBar } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import type { SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

function useSaveProgress(code: string): SaveProgress | null {
  return useSyncExternalStore(saveProgress.subscribe, () => saveProgress.get(code));
}

/** The ⋯ menu's "Simpan untuk offline", or null for a course Edunex doesn't have. */
export function useSaveOfflineChoice(page: CoursePage): SheetChoice | null {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const bridge = useBridge();
  const theme = useTheme();
  const { course } = page;
  const progress = useSaveProgress(course.code);
  const [asked, setAsked] = useState(false);
  const busy = asked || progress !== null;
  const plan = useMemo(
    () =>
      course.edunex
        ? planOfflineFiles({ code: course.code, name: course.name, mainCourseId: course.edunex.courseId }, page.outline, page.materials ?? [], lang)
        : null,
    [course, page.outline, page.materials, lang],
  );
  if (!plan) return null;

  const save = async () => {
    setAsked(true);
    try {
      const result = await bridge.invoke("course.saveOffline", { code: course.code, pick: false });
      if (result.saved + result.kept + result.failed === 0) toast(t("offline.nothing"));
      else if (result.failed > 0) toast(t("offline.failed", { count: result.failed, action: t("offline.save") }), "danger");
      else toast(t("offline.done", { count: result.saved, saved: result.saved, kept: result.kept }), "success");
    } catch (error) {
      toast(t(errorKey(error)), "danger");
    } finally {
      setAsked(false);
    }
  };
  const { files } = plan;
  const size = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  const hint = progress
    ? t("mobile.offline.saving", { count: progress.total, done: progress.done, total: progress.total })
    : files.length === 0
      ? t("offline.noneYet")
      : size > 0
        ? t("offline.files", { count: files.length, size: f.fileSize(size) })
        : t("offline.filesNoSize", { count: files.length });
  return {
    label: t("offline.save"),
    hint,
    icon: <Icons.FolderDown size={18} color={theme.color.muted} />,
    disabled: busy || files.length === 0,
    onPress: () => void save(),
    testID: "action.courseMenu.saveOffline",
  };
}

/** While the course's files are being saved: how far it has got. It keeps going if the Student leaves the page. */
export function SaveOfflineProgress({ code }: { code: string }) {
  const t = useT();
  const progress = useSaveProgress(code);
  if (!progress) return null;
  const label = t("mobile.offline.saving", { count: progress.total, done: progress.done, total: progress.total });
  return (
    <View style={{ marginTop: space[4] }}>
      <Notice tone="info" title={label} testID="notice.course.saveOffline">
        <View style={{ gap: space[2], paddingTop: space[1] }}>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={label} />
          <Text size="small" tone="muted">
            {t("mobile.offline.savingHint")}
          </Text>
        </View>
      </Notice>
    </View>
  );
}
