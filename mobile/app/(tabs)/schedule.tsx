import { TabHeader, usePullToRefresh } from "../../src/shell/source-status";
import { Page, PageHeader } from "../../src/ui/layout";

export default function Screen() {
  const pull = usePullToRefresh();
  return (
    <Page testID="screen.schedule" header={<TabHeader />} {...pull}>
      <PageHeader title="schedule" />
    </Page>
  );
}
