// Profil: the Student's card (IPK, SKS), Nilai and the study plan's screens with their state, then the account
// (src/screens/academic), on the white page. The bar: the tab's name, then the gear (Settings is reached from this tab
// only, now the avatar is gone), Search and the bell.
import { router } from "expo-router";
import { useT } from "../../../src/app/i18n";
import { BTabHeader } from "../../src/parts/b-header";
import { usePerfFocused } from "../../src/perf";
import { AcademicContent } from "../../src/screens/academic/academic-screen";
import { usePullToRefresh } from "../../src/shell/source-status";
import { useB } from "../../src/ui/b";
import { IconButton } from "../../src/ui/controls";
import { Icons } from "../../src/ui/icons";
import { Page } from "../../src/ui/layout";
import { TabClock } from "../../src/ui/tab-clock";

export default function Screen() {
  const t = useT();
  const pull = usePullToRefresh();
  const b = useB();
  usePerfFocused("profile");
  return (
    <TabClock name="profile">
      {() => (
        <Page
          testID="screen.profile"
          header={
            <BTabHeader
              title={t("mobile.tab.profile")}
              actions={
                <IconButton label={t("nav.settings")} onPress={() => router.push("/settings")} testID="action.settings">
                  <Icons.Settings size={24} color={b.fg} />
                </IconButton>
              }
            />
          }
          background={b.page}
          contentStyle={{ paddingHorizontal: 20 }}
          {...pull}
        >
          <AcademicContent />
        </Page>
      )}
    </TabClock>
  );
}
