// Settings' top: who's signed in (a white card: the initials, the name in Plus Jakarta Sans, the NIM and the program
// as one quiet line), then Akun: each system's row (a line icon in a tile, as every row's) with its state as the one
// line under it ("Terhubung"; when it was last checked only once that's stale). Signed out (or the session ended), the
// row signs in; signed in, it opens a sheet whose one choice signs out of just that system. What the first read found
// is the group's last row.
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { displayName, initials } from "../../../../src/app/names";
import { useBridge, useDataset, useStatus } from "../../../../src/app/store";
import type { SourceId } from "../../../../src/core/models";
import { useSignInNote } from "../../shell/source-status";
import { LiveDot } from "../../ui/display";
import { IconTile, Panel, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Chevron, haptic, type MetaTone, SettingRow, SettingsGroup } from "../../ui/settings-list";
import { ActionSheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import type { Report } from "./save";

/** Who's signed in: the initials, the name, the NIM and the program (Edunex's account, else SIX's). */
export function Profile() {
  const v = useTheme().v4;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  if (!name) return null;
  const facts = factsLabel(account?.nim ?? student?.nim, student?.program);
  return (
    <Panel testID="card.profile" style={{ flexDirection: "row", alignItems: "center", gap: space[4], padding: space[4], marginTop: space[2] }}>
      <View
        style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: v.brandTint, alignItems: "center", justifyContent: "center" }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text size="titleLarge" face="display" weight="bold" style={{ color: v.brandInk }}>
          {initials(name)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={factsLabel(displayName(name), facts)}>
        <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg, letterSpacing: -0.2 }}>
          {displayName(name)}
        </Text>
        {facts ? (
          <Text size="bodyMedium" style={{ color: v.muted, marginTop: 2 }}>
            {facts}
          </Text>
        ) : null}
      </View>
    </Panel>
  );
}

/** Akun: Edunex, SIX, and the first-connection summary. */
export function Accounts({ report }: { report: Report }) {
  const t = useT();
  return (
    <SettingsGroup title={t("settings.accounts")}>
      <AccountRow source="edunex" report={report} />
      <AccountRow source="six" report={report} />
      <SettingRow
        leading={<IconTile icon={(color) => <Icons.Zap size={22} color={color} />} />}
        title={t("settings.firstScan")}
        onPress={() => router.push("/first-scan")}
        label={`${t("settings.firstScan.show")}: ${t("settings.firstScan")}`}
        hint={t("settings.firstScan.hint")}
        trailing={<Chevron />}
        testID="action.firstScan"
      />
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
        leading={
          <IconTile icon={(color) => (source === "six" ? <Icons.GraduationCap size={22} color={color} /> : <Icons.BookOpen size={22} color={color} />)} />
        }
        title={name}
        meta={
          status.state === "live" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LiveDot />
              <MetaText tone="ok">{state.text}</MetaText>
            </View>
          ) : (
            state.text
          )
        }
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

/** A meta line's words in a state's ink, beside a dot. */
function MetaText({ tone, children }: { tone: MetaTone; children: string }) {
  const v = useTheme().v4;
  const color = tone === "ok" ? v.okFg : tone === "amber" ? v.ambFg : tone === "red" ? v.redFg : v.muted;
  return (
    <Text size="bodyMedium" style={{ color, flexShrink: 1 }}>
      {children}
    </Text>
  );
}
