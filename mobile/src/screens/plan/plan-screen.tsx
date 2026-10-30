// Rencana studi on the phone (src/app/screens/plan.tsx): the study planner, the curriculum map,
// KRS, UKT and ITB's academic calendar, as tabs fixed under the top bar that scroll sideways.
// The tab shown is the route's (`?tab=`), recorded in its place as the Student picks it, so Back
// leaves the screen and a link opens the right tab. Each tab has its own crash guard: a tab that
// breaks leaves the tab bar, and the way to another tab.
import { Component, type ComponentRef, type ComponentType, type ErrorInfo, type ReactNode, useEffect, useRef } from "react";
import type { ScrollView } from "react-native";
import { View } from "react-native";
import { type StringKey, useT } from "../../../../src/app/i18n";
import { builtPlanTabs, type PlanTab } from "../../../../src/app/shell/built";
import { useNav } from "../../nav";
import { ProblemBanner, usePullToRefresh } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import * as bills from "./bills";
import * as curriculum from "./curriculum";
import * as deadlines from "./deadlines";
import { useFreshPlan } from "./fresh-plan";
import * as krs from "./krs";
import { PageScrollProvider } from "./page-scroll";
import { PlaceStateProvider } from "./place-state";
import * as planner from "./planner";
import { TabBar } from "./tab-bar";

const TAB: Readonly<Record<PlanTab, ComponentType<{ onCalendar?: () => void }>>> = {
  planner: planner.Tab,
  curriculum: curriculum.Tab,
  krs: krs.Tab,
  bills: bills.Tab,
  deadlines: deadlines.Tab,
};

export function PlanScreen({ tab }: { tab?: string }) {
  const t = useT();
  const { replace } = useNav();
  const pull = usePullToRefresh();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Back from another screen that changed the saved plan: the tab starts again from what's saved.
  const fresh = useFreshPlan();
  const first = builtPlanTabs[0] ?? "planner";
  const current: PlanTab = builtPlanTabs.some((id) => id === tab) ? (tab as PlanTab) : first;
  const setCurrent = (next: PlanTab) => replace({ screen: "plan", tab: next });
  // A tab opens at its top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new tab is what moves the page
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [current]);
  if (!builtPlanTabs.length) return null;
  const Tab = TAB[current];
  return (
    <Page
      testID="screen.plan"
      scrollRef={scroll}
      header={
        <>
          <TopBar title={t("nav.plan")} />
          {/* A plan the app can't trust right now (offline, SIX's session ended, a page SIX changed): said here, as on the desktop. */}
          <ProblemBanner belowBar />
          <TabBar
            value={current}
            label={t("nav.plan")}
            prefix="plan"
            tabs={builtPlanTabs.map((id) => ({ value: id, label: t(`plan.tab.${id}` as StringKey) }))}
            onChange={setCurrent}
          />
        </>
      }
      {...pull}
    >
      <PlaceStateProvider>
        <PageScrollProvider value={scroll}>
          <View testID={`panel.plan.${current}`}>
            <TabBoundary key={`${current}:${fresh}`} name={`plan ${current}`}>
              <Tab onCalendar={() => setCurrent("deadlines")} />
            </TabBoundary>
          </View>
        </PageScrollProvider>
      </PlaceStateProvider>
    </Page>
  );
}

/** The crash guard (src/app/ui/panel-boundary.tsx): a bad record breaks one tab with a visible error and a way to try again. */
class TabBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[panel:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <TabError error={error} onRetry={() => this.setState({ error: null })} />;
  }
}

function TabError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View accessibilityRole="alert" style={{ alignItems: "flex-start", gap: space[3], paddingVertical: space[10] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Icons.AlertTriangle size={18} color={theme.color.dangerFg} />
        <Text size="body" weight="semibold">
          {t("error.panel")}
        </Text>
      </View>
      <Text size="small" tone="muted" style={{ fontFamily: "monospace" }}>
        {error.message}
      </Text>
      <Button size="sm" onPress={onRetry} testID="action.tryAgain">
        {t("action.tryAgain")}
      </Button>
    </View>
  );
}
