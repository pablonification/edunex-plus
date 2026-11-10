// Akun's rows, shown on Profil (round 4; Settings' top before it): each system's row (a line icon in a tile, as every
// row's) with its state as the one line under it: "Terhubung" in green, no dot (round 3's final review: the dot and the
// word said it twice); when it was last checked only once that's stale. Signed out (or the session ended), the row signs
// in; signed in, it opens a sheet whose one choice signs out of just that system. What the first read found is the
// group's last row, "Ringkasan awal".
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useBridge, useStatus } from "../../../../src/app/store";
import type { SourceId } from "../../../../src/core/models";
import { useSignInNote } from "../../shell/source-status";
import { IconTile, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Chevron, haptic, type MetaTone, SettingRow } from "../../ui/settings-list";
import { ActionSheet } from "../../ui/sheet";
import { useTheme } from "../../ui/theme";
import type { Report } from "./save";

/** "Ringkasan awal": what the first read found. */
export function FirstScanRow() {
  const t = useT();
  return (
    <SettingRow
      leading={<IconTile icon={(color) => <Icons.Zap size={22} color={color} />} />}
      title={t("settings.firstScan")}
      onPress={() => router.push("/first-scan")}
      label={`${t("settings.firstScan.show")}: ${t("settings.firstScan")}`}
      hint={t("settings.firstScan.hint")}
      trailing={<Chevron />}
      testID="action.firstScan"
    />
  );
}

/** One system's account: its state and last check as the one line; the row signs in, or opens its sign-out. */
export function AccountRow({ source, report, testID }: { source: SourceId; report: Report; testID?: string }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const status = useStatus(source);
  const note = useSignInNote(source);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const name = t(`source.${source}`);
  const run = async (what: "auth.signIn" | "auth.signOut") => {
    setBusy(true);
    try {
      await bridge.invoke(what, { source });
    } catch (error) {
      report(error, what === "auth.signIn" ? "welcome.signInFailed" : undefined);
    } finally {
      setBusy(false);
    }
  };
  const needsSignIn = status.state === "signed-out" || status.state === "expired";
  const checked = status.updatedAt !== null ? f.fromNow(status.updatedAt) : null;
  // Fresh: just "Terhubung". When it was last checked is said only once it's stale (the state after "live").
  const state: { text: string; tone: MetaTone } =
    needsSignIn && note
      ? { text: note.text, tone: note.slow ? "amber" : "muted" }
      : status.state === "signed-out"
        ? { text: t("settings.notConnected"), tone: "muted" }
        : status.state === "expired"
          ? { text: t("settings.account.expired"), tone: "amber" }
          : status.state === "connecting"
            ? { text: t("status.connecting"), tone: "muted" }
            : status.state === "live"
              ? { text: t("status.live"), tone: "ok" }
              : { text: checked ? t("settings.account.stale", { when: checked }) : t(`status.${status.state}`, { source: name }), tone: "amber" };
  const signInLabel = t(status.state === "expired" ? "settings.signInAgainTo" : "settings.signInTo", { source: name });
  return (
    <View testID={testID ?? `row.account.${source}`}>
      <SettingRow
        leading={
          <IconTile icon={(color) => (source === "six" ? <Icons.GraduationCap size={22} color={color} /> : <Icons.BookOpen size={22} color={color} />)} />
        }
        title={name}
        // Connected: the word alone in green; a dot beside it said the same thing twice (round 3's final review).
        meta={state.text}
        metaTone={state.tone}
        busy={busy}
        disabled={status.state === "connecting"}
        label={factsLabel(name, state.text, needsSignIn ? signInLabel : null)}
        // A session that ended: signing in again is all it takes, and the last data stays readable meanwhile.
        hint={needsSignIn ? (status.state === "expired" ? t("settings.accounts.note") : undefined) : t("settings.signOutOf", { source: name })}
        onPress={() => (needsSignIn ? void run("auth.signIn") : setMenu(true))}
        trailing={needsSignIn ? <Pill tone="brand">{t(status.state === "expired" ? "action.signInAgain" : "action.signIn")}</Pill> : <Chevron />}
        testID={needsSignIn ? `action.signIn.${source}` : `action.account.${source}`}
      />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={name}
        testID={`sheet.account.${source}`}
        choices={[
          {
            label: t("settings.signOutOf", { source: name }),
            tone: "danger",
            icon: <SignOutIcon />,
            onPress: () => {
              haptic.confirm();
              void run("auth.signOut");
            },
            testID: `action.signOut.${source}`,
          },
        ]}
      />
    </View>
  );
}

function SignOutIcon() {
  const v = useTheme().v4;
  return <Icons.LogOut size={22} color={v.redFg} />;
}
