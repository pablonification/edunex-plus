// Rencana studi: the study planner, the curriculum map, KRS, UKT and ITB's
// academic deadlines (#79, #80). Each tab is its own file under ./plan/ and
// shows once it's built (../shell/built.ts); the screen shows once one is.
// The sidebar's count for it is in ../shell/badges.ts.
import * as Tabs from "@radix-ui/react-tabs";
import { type ComponentType, useState } from "react";
import { type StringKey, useT } from "../i18n";
import { builtPlanTabs, type PlanTab } from "../shell/built";
import { Page, PageHeader } from "../ui/layout";
import { TabBar } from "../ui/tabs";
import * as bills from "./plan/bills";
import * as curriculum from "./plan/curriculum";
import * as deadlines from "./plan/deadlines";
import * as krs from "./plan/krs";
import * as planner from "./plan/planner";

const TAB: Readonly<Record<PlanTab, ComponentType<{ onCalendar?: () => void }>>> = {
  planner: planner.Tab,
  curriculum: curriculum.Tab,
  krs: krs.Tab,
  bills: bills.Tab,
  deadlines: deadlines.Tab,
};

export function PlanScreen({ tab }: { tab?: string }) {
  const t = useT();
  const first = builtPlanTabs[0] ?? "planner";
  const [current, setCurrent] = useState<PlanTab>(builtPlanTabs.some((id) => id === tab) ? (tab as PlanTab) : first);
  if (!builtPlanTabs.length) return null;
  return (
    <Page width="wide">
      <PageHeader title={t("nav.plan")} className="mb-5" />
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as PlanTab)}>
        <TabBar
          value={current}
          label={t("nav.plan")}
          tabs={builtPlanTabs.map((id) => ({ value: id, label: t(`plan.tab.${id}` as StringKey) }))}
          className="border-b border-line"
        />
        {builtPlanTabs.map((id) => {
          const Tab = TAB[id];
          return (
            <Tabs.Content key={id} value={id} className="focus-ring rounded-sm pt-6">
              <Tab onCalendar={() => setCurrent("deadlines")} />
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </Page>
  );
}
