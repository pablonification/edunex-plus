// A file from Edunex on the phone (src/app/screens/tasks.tsx's LecturerFile and src/app/open-file.tsx,
// scope A12 and A13): pressing it downloads it into the app's files once, then opens it in the
// phone's own app for its kind (Android asks which, the first time); once it's on the phone, Share
// sends it on (Drive, a chat). Nothing is shown inside the app. Whatever goes wrong is said on the row, with the way
// forward (round 2, W1: round 1 said it in a snackbar, or, for a file no app opened, nowhere). Every way goes through the bridge
// ("files.download", "files.local", "files.open", "files.reveal"), as the desktop's does. A link
// Edunex no longer honours is said the desktop viewer's way, with "Buka di Edunex" to its page.
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { ActionError } from "../../../src/app/bridge";
import { useOpenExternal } from "../../../src/app/hooks";
import { useT } from "../../../src/app/i18n";
import { useBridge } from "../../../src/app/store";
import type { TaskFile } from "../../../src/core/models";
import { toast } from "../swaps/overlays";
import { Button, IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { Text } from "../ui/text";
import { radius, shape, space, useTheme } from "../ui/theme";

/** A name the download accepts (200 characters at most), its extension kept. */
function shortName(name: string): string {
  if (name.length <= 200) return name;
  const ext = /\.[\w]{1,8}$/.exec(name)?.[0] ?? "";
  return name.slice(0, 200 - ext.length) + ext;
}

/** Why a file didn't open, said on its row until the next try: what happened and the way forward (W1). */
export type FileProblem = "expired" | "download" | "noApp" | "openFailed" | "share";

/**
 * The ways to a file on the phone: open it (downloading it first, once), share it, and whether it's here. `edunexUrl`:
 * the file's page on Edunex (its Task, its module), offered when the phone can't help. `inline`: the row shows
 * `problem` itself (FileRow); else, as before, a failure is said in a snackbar.
 */
export function useEdunexFile(file: TaskFile, edunexUrl?: string, { inline = false }: { inline?: boolean } = {}) {
  const t = useT();
  const bridge = useBridge();
  const openExternal = useOpenExternal();
  const [here, setHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const check = useCallback(
    () =>
      bridge.invoke("files.local", { url: file.url }).then(
        (copy) => setHere(copy !== null),
        () => setHere(false),
      ),
    [bridge, file.url],
  );
  useEffect(() => {
    void check();
  }, [check]);
  const fail = (kind: FileProblem) => {
    if (inline) return setProblem(kind);
    if (kind === "expired")
      toast(t("file.problem.expired"), "danger", edunexUrl ? { label: t("action.openInEdunex"), onClick: () => openExternal(edunexUrl) } : undefined);
    else if (kind === "download") toast(t("file.downloadFailed", { name: file.name }), "danger");
    else if (kind === "share") toast(t("mobile.file.shareFailed", { name: file.name }), "danger");
    else toast(t(kind === "noApp" ? "mobile.file.noApp" : "mobile.file.openFailed", { name: file.name }), "danger");
  };

  const open = async () => {
    setBusy(true);
    setProblem(null);
    try {
      try {
        await bridge.invoke("files.download", { url: file.url, name: shortName(file.name) });
        setHere(true);
      } catch (error) {
        // Refused: Edunex's link expired or the file is gone, so only its page on Edunex can help.
        fail(error instanceof ActionError && error.kind === "Rejected" ? "expired" : "download");
        return;
      }
      await bridge.invoke("files.open", { url: file.url }).catch((error: unknown) => {
        fail(error instanceof ActionError && error.kind === "Rejected" ? "noApp" : "openFailed");
        void check();
      });
    } finally {
      setBusy(false);
    }
  };
  const share = () => {
    setProblem(null);
    void bridge.invoke("files.reveal", { url: file.url }).catch(() => {
      fail("share");
      void check();
    });
  };
  return { here, busy, open, share, problem };
}

/**
 * A lecturer's file as a row (a module's material, a Task's file): the whole row opens it in the phone's app,
 * downloading it once; Share sits beside it once it's here. Anything that goes wrong is said under the row, in the
 * error colour, with the way forward as buttons (Coba lagi, Bagikan, Buka di Edunex), and stays until the next try:
 * never a snackbar that's gone before it's read.
 */
export function FileRow({
  file,
  edunexUrl,
  leading,
  children,
  label,
  testID,
}: {
  file: TaskFile;
  edunexUrl?: string;
  leading: ReactNode;
  /** What the row says (the title, its facts). */
  children: ReactNode;
  label: string;
  testID?: string;
}) {
  const t = useT();
  const theme = useTheme();
  const { here, busy, open, share, problem } = useEdunexFile(file, edunexUrl, { inline: true });
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy }}
          onPress={() => void open()}
          android_ripple={{ color: theme.color.selected }}
          style={[styles.row, { paddingRight: here ? space[1] : space[4] }]}
        >
          {leading}
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
          {busy ? (
            <ActivityIndicator size="small" color={theme.color.onSurfaceVariant} />
          ) : (
            !here && <Icons.Download size={20} color={theme.color.onSurfaceVariant} />
          )}
        </Pressable>
        {here && (
          <View style={{ paddingRight: space[1] }}>
            <IconButton label={t("mobile.file.shareFor", { name: file.name })} onPress={share} testID={testID ? `${testID}.share` : undefined}>
              {/* Android's share glyph; src/ui/icons has no "Share" yet. */}
              <ShareNetworkIcon size={20} color={theme.color.onSurfaceVariant} />
            </IconButton>
          </View>
        )}
      </View>
      {problem && (
        <FileProblemNote
          problem={problem}
          name={file.name}
          edunexUrl={edunexUrl}
          onRetry={() => void open()}
          onShare={share}
          testID={testID ? `${testID}.problem` : undefined}
        />
      )}
    </View>
  );
}

/**
 * What went wrong with a file, under its row, in the error colour, with the way forward as buttons (Coba lagi,
 * Bagikan, Buka di Edunex): FileRow's, and any row drawn from `useEdunexFile` with `inline` (a module's file in v4).
 * `style`: where it starts (the row's text column).
 */
export function FileProblemNote({
  problem,
  name,
  edunexUrl,
  onRetry,
  onShare,
  testID,
  style,
}: {
  problem: FileProblem;
  name: string;
  edunexUrl?: string;
  onRetry: () => void;
  onShare: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const theme = useTheme();
  const openExternal = useOpenExternal();
  return (
    <View style={[styles.problem, style]} testID={testID} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 2 }}>
          <Icons.AlertTriangle size={16} color={theme.color.error} weight="bold" />
        </View>
        <Text size="bodyMedium" tone="danger" style={{ flex: 1 }}>
          {problemText(t, problem, name)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[2], marginLeft: space[6] }}>
        {(problem === "download" || problem === "openFailed") && (
          <Button size="sm" variant="secondary" onPress={onRetry} testID="action.fileRetry">
            {t("action.tryAgain")}
          </Button>
        )}
        {(problem === "noApp" || problem === "openFailed") && (
          <Button size="sm" variant="secondary" onPress={onShare} testID="action.fileShare">
            {t("mobile.file.share")}
          </Button>
        )}
        {edunexUrl && problem !== "openFailed" && (
          <Button size="sm" variant="secondary" onPress={() => openExternal(edunexUrl)} testID="action.fileEdunex">
            {t("action.openInEdunex")}
          </Button>
        )}
      </View>
    </View>
  );
}

function problemText(t: ReturnType<typeof useT>, problem: FileProblem, name: string): string {
  switch (problem) {
    case "expired":
      return t("file.problem.expired");
    case "download":
      return t("file.downloadFailed", { name });
    case "noApp":
      return t("mobile.file.noApp", { name });
    case "openFailed":
      return t("mobile.file.openFailed", { name });
    case "share":
      return t("mobile.file.shareFailed", { name });
  }
}

/** "PDF", "DOCX": the kind, on a quiet square; red only for a file that failed. */
export function FileBadge({ name, state }: { name: string; state?: "waiting" | "uploading" | "uploaded" | "failed" }) {
  const theme = useTheme();
  const c = theme.color;
  const ext = /\.([a-z0-9]{1,4})$/i.exec(name)?.[1]?.toUpperCase() ?? "";
  const failed = state === "failed";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { backgroundColor: failed ? c.dangerBg : c.neutralBg }]}
    >
      {state === "uploading" || state === "waiting" ? (
        <ActivityIndicator size="small" color={c.neutralFg} />
      ) : failed ? (
        <Icons.AlertTriangle size={14} color={c.dangerFg} />
      ) : ext ? (
        <Text size="micro" weight="bold" style={{ color: c.neutralFg, fontSize: 10 }}>
          {ext}
        </Text>
      ) : (
        <Icons.FileText size={14} color={c.neutralFg} />
      )}
    </View>
  );
}

/** A lecturer's file on its own tonal card (a Task's, an exam's): FileRow with the file's kind for its icon. */
export function LecturerFile({ file, edunexUrl, testID }: { file: TaskFile; edunexUrl?: string; testID?: string }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.color.surfaceContainerLow }]}>
      <FileRow file={file} edunexUrl={edunexUrl} leading={<FileBadge name={file.name} />} label={t("mobile.file.openFor", { name: file.name })} testID={testID}>
        <Text size="bodyLarge" numberOfLines={2}>
          {file.name}
        </Text>
      </FileRow>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  card: { borderRadius: shape.lg, overflow: "hidden" },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], paddingLeft: space[4], paddingVertical: space[3], minHeight: 56 },
  problem: { paddingLeft: space[4], paddingRight: space[4], paddingBottom: space[3] },
});
