import { PresenceContent } from "../../src/screens/presence/presence-screen";
import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page } from "../../src/ui/layout";

export default function Screen() {
  const pull = usePullToRefresh();
  return (
    <Page testID="screen.presence" header={<TabHeader />} {...pull}>
      <PresenceContent />
    </Page>
  );
}
