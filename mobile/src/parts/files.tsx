// A file from Edunex on the phone (src/app/screens/tasks.tsx's LecturerFile and src/app/open-file.tsx,
// scope A12 and A13): pressing it downloads it into the app's files once, then opens it in the
// phone's own app for its kind (Android asks which, the first time); once it's on the phone, Share
// sends it on (Drive, a chat). Nothing is shown inside the app. Every way goes through the bridge
// ("files.download", "files.local", "files.open", "files.reveal"), as the desktop's does. A link
// Edunex no longer honours is said the desktop viewer's way, with "Buka di Edunex" to its page.
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ActionError } from "../../../src/app/bridge";
import { useOpenExternal } from "../../../src/app/hooks";
import { useT } from "../../../src/app/i18n";
import { useBridge } from "../../../src/app/store";
import type { TaskFile } from "../../../src/core/models";
import { toast } from "../swaps/overlays";
import { IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { Text } from "../ui/text";
import { radius, space, useTheme } from "../ui/theme";

/** A name the download accepts (200 characters at most), its extension kept. */
function shortName(name: string): string {
  if (name.length <= 200) return name;
  const ext = /\.[\w]{1,8}$/.exec(name)?.[0] ?? "";
  return name.slice(0, 200 - ext.length) + ext;
}

/**
 * The ways to a file on the phone: open it (downloading it first, once), share it, and whether it's
 * here. `edunexUrl`: the file's page on Edunex (its Task, its module), offered when its link stopped working.
 */
export function useEdunexFile(file: TaskFile, edunexUrl?: string) {
  const t = useT();
  const bridge = useBridge();
  const openExternal = useOpenExternal();
  const [here, setHere] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const open = async () => {
    setBusy(true);
    try {
      try {
        await bridge.invoke("files.download", { url: file.url, name: shortName(file.name) });
        setHere(true);
      } catch (error) {
        // Refused: Edunex's link expired or the file is gone, so only its page on Edunex can help.
        if (error instanceof ActionError && error.kind === "Rejected")
          toast(t("file.problem.expired"), "danger", edunexUrl ? { label: t("action.openInEdunex"), onClick: () => openExternal(edunexUrl) } : undefined);
        else toast(t("file.downloadFailed", { name: file.name }), "danger");
        return;
      }
      await bridge.invoke("files.open", { url: file.url }).catch((error: unknown) => {
        const noApp = error instanceof ActionError && error.kind === "Rejected";
        toast(t(noApp ? "mobile.file.noApp" : "mobile.file.openFailed", { name: file.name }), "danger");
        void check();
      });
    } finally {
      setBusy(false);
    }
  };
  const share = () =>
    void bridge.invoke("files.reveal", { url: file.url }).catch(() => {
      toast(t("mobile.file.shareFailed", { name: file.name }), "danger");
      void check();
    });
  return { here, busy, open, share };
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

/** A lecturer's file, as a card: press to open it in the phone's app; Share once it's here. `edunexUrl`: its page on Edunex. */
export function LecturerFile({ file, edunexUrl, testID }: { file: TaskFile; edunexUrl?: string; testID?: string }) {
  const t = useT();
  const theme = useTheme();
  const { here, busy, open, share } = useEdunexFile(file, edunexUrl);
  return (
    <View style={[styles.card, { borderColor: theme.color.edge, backgroundColor: theme.color.surfaceContainerLow }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.file.openFor", { name: file.name })}
        accessibilityState={{ busy }}
        onPress={() => void open()}
        android_ripple={{ color: theme.color.selected }}
        style={styles.press}
      >
        <FileBadge name={file.name} />
        <Text size="body" weight="medium" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
          {file.name}
        </Text>
        {busy ? <ActivityIndicator size="small" color={theme.color.faint} /> : !here && <Icons.Download size={18} color={theme.color.faint} />}
      </Pressable>
      {here && (
        <IconButton label={t("mobile.file.shareFor", { name: file.name })} onPress={share}>
          {/* Android's share glyph; src/ui/icons has no "Share" yet. */}
          <ShareNetworkIcon size={18} color={theme.color.muted} />
        </IconButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingRight: space[1],
  },
  press: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[3], paddingVertical: space[2.5], minHeight: 56 },
});
