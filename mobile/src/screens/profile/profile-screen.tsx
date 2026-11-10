// Profil (round 4), the last tab, as students know it from Gojek, Grab and Edunex Mobile: who they are, how their
// studies stand, then the lists. Top to bottom:
// 1. Who they are (./identity.tsx): a large circle with their initials, their name as the screen's one title, the NIM and
//    the program on one quiet line, straight on the grey page (no bar title saying "Profil" over it).
// 2. The IPK card (./academic.tsx) in the screen's one colour, then the to-do chips while something is due. A centred
//    hero over a blue card: Profil's own shape, apart from the other tabs' grey pages of white rows and Beranda's band.
// 3. Groups, each a heading over one card of rows: Akademik (Nilai and Rencana studi's parts), Akun (Edunex, SIX,
//    Ringkasan awal), Aplikasi (Pengaturan, Tentang with the version), then Keluar alone, confirmed in a sheet.
// What's below the first screenful mounts a part at a time (../../ui/parts.tsx). A sign-in or sign-out that fails says
// so under the bar, as Settings does.
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorKey } from "../../../../src/app/bridge";
import { useT } from "../../../../src/app/i18n";
import { useStore } from "../../../../src/app/store";
import { ProblemBanner, usePullToRefresh } from "../../shell/source-status";
import { Rise } from "../../ui/expressive";
import { Heading, IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { Part } from "../../ui/parts";
import { Chevron, ErrorBanner, SettingRow, SettingsGroup } from "../../ui/settings-list";
import { space, useTheme } from "../../ui/theme";
import { SignOutAll } from "../settings/about";
import { AccountRow, FirstScanRow } from "../settings/accounts";
import type { Report } from "../settings/save";
import { AcademicRows, AcademicTodos, StandingCard } from "./academic";
import { Identity } from "./identity";

export function ProfileScreen() {
  const t = useT();
  const v = useTheme().v4;
  const pull = usePullToRefresh();
  const [problem, setProblem] = useState<string | null>(null);
  const report: Report = useCallback((error, fallback) => setProblem(t(errorKey(error, fallback))), [t]);
  return (
    <Page testID="screen.profile" background={v.page} header={<ProfileBar problem={problem} onClose={() => setProblem(null)} />} {...pull}>
      <View style={{ gap: space[4] }}>
        <Rise screen="profile" index={0}>
          <Identity />
        </Rise>
        <Rise screen="profile" index={1}>
          <StandingCard />
        </Rise>
        <AcademicTodos />
      </View>
      <Part at={1}>
        <Rise screen="profile" index={2}>
          <Heading>{t("mobile.profile.academic")}</Heading>
          <AcademicRows />
        </Rise>
      </Part>
      <Part at={2}>
        <Rise screen="profile" index={3}>
          <SettingsGroup title={t("settings.accounts")} testID="section.profile.accounts">
            <AccountRow source="edunex" report={report} testID="row.profile.edunex" />
            <AccountRow source="six" report={report} testID="row.profile.six" />
            <FirstScanRow />
          </SettingsGroup>
        </Rise>
      </Part>
      <Part at={3}>
        <Rise screen="profile" index={4}>
          <AppGroup />
          <SignOutAll report={report} />
        </Rise>
      </Part>
    </Page>
  );
}

/** No title (the name under it is the screen's): the status bar's room, then a problem banner when there is one. */
function ProfileBar({ problem, onClose }: { problem: string | null; onClose(): void }) {
  const v = useTheme().v4;
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: v.page }}>
      <ProblemBanner />
      {problem && <ErrorBanner text={problem} onClose={onClose} />}
    </View>
  );
}

/** Pengaturan, and Tentang with the version (opens Settings at its Tentang group). */
function AppGroup() {
  const t = useT();
  const store = useStore();
  const version = t("settings.version", { version: store.version });
  return (
    <SettingsGroup title={t("mobile.profile.app")} testID="section.profile.app">
      <SettingRow
        leading={<IconTile tone="plain" icon={(color) => <Icons.Settings size={22} color={color} />} />}
        title={t("nav.settings")}
        onPress={() => router.push("/settings")}
        trailing={<Chevron />}
        testID="row.profile.settings"
      />
      <SettingRow
        leading={<IconTile tone="plain" icon={(color) => <Icons.Info size={22} color={color} />} />}
        title={t("settings.about")}
        meta={version}
        onPress={() => router.push({ pathname: "/settings", params: { at: "about" } })}
        trailing={<Chevron />}
        testID="row.profile.about"
      />
    </SettingsGroup>
  );
}
