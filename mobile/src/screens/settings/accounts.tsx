// Settings' top, Akun (who's signed in is Profil's card, the screen this one is opened from): each system's row, its
// name and its state as the one line under it: "Terhubung" in green, no dot (round 3's final review: the dot and the
// word said it twice); when it was last checked only once that's stale. Signed out (or the session ended), the row signs
// in; signed in, it opens a sheet whose one choice signs out of just that system. Each row starts with its system's own
// mark (Icons.Edunex, Icons.Six: the same two as on Profil), quiet, with no tile behind it: the only rows of Settings
// that name a system, so the only ones with a mark (round 2's council: "rows have no icons").
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useBridge, useStatus } from "../../../../src/app/store";
import type { SourceId } from "../../../../src/core/models";
import { useSignInNote } from "../../shell/source-status";
import { Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Chevron, haptic, type MetaTone, SettingRow, SettingsGroup } from "../../ui/settings-list";
import { ActionSheet } from "../../ui/sheet";
import { useTheme } from "../../ui/theme";
import type { Report } from "./save";

/** Akun: Edunex and SIX. The page's first group, right under its title. */
export function Accounts({ report }: { report: Report }) {
  const t = useT();
  return (
    <SettingsGroup title={t("settings.accounts")} first>
      <AccountRow source="edunex" report={report} />
      <AccountRow source="six" report={report} />
    </SettingsGroup>
  );
}

/** One system's account: its state and last check as the one line; the row signs in, or opens its sign-out. */
function AccountRow({ source, report }: { source: SourceId; report: Report }) {
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
    <View testID={`row.account.${source}`}>
      <SettingRow
        leading={<SourceMark source={source} />}
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

/** The system's mark at its row's start: the glyph alone in the page's quiet ink, in a 44 dp slot. */
function SourceMark({ source }: { source: SourceId }) {
  const v = useTheme().v4;
  const Glyph = source === "six" ? Icons.Six : Icons.Edunex;
  return (
    <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Glyph size={24} color={v.fg2} />
    </View>
  );
}

function SignOutIcon() {
  const v = useTheme().v4;
  return <Icons.LogOut size={22} color={v.redFg} />;
}
