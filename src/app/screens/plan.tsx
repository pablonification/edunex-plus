// Rencana studi: the study planner, the curriculum map, KRS, UKT and ITB's
// academic deadlines (#79, #80). Each tab is its own file under ./plan/ and
// shows once it's built (its `ready` flag); the screen shows once one is.
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { type StringKey, useT } from "../i18n";
import { Page, PageHeader } from "../ui/layout";
import { TabBar } from "../ui/tabs";
import * as bills from "./plan/bills";
import * as curriculum from "./plan/curriculum";
import * as deadlines from "./plan/deadlines";
import * as krs from "./plan/krs";
import * as planner from "./plan/planner";

type Badge = { value: number; tone: "neutral" | "warning" } | null;

const TABS = [
  ["planner", planner],
  ["curriculum", curriculum],
  ["krs", krs],
  ["bills", bills],
  ["deadlines", deadlines],
] as const;
type TabId = (typeof TABS)[number][0];

const shown = TABS.filter(([, tab]) => tab.ready);

export const ready = shown.length > 0;

/** The tabs' counts together: what needs the Student (warnings) first. */
export function useBadge(): Badge {
  // biome-ignore lint/correctness/useHookAtTopLevel: TABS is fixed, so every tab's hook runs on every render, in the same order
  const badges = TABS.map(([, tab]) => tab.useBadge()).filter((badge, i): badge is NonNullable<Badge> => badge !== null && TABS[i][1].ready);
  const warnings = badges.filter((badge) => badge.tone === "warning");
  const pick = warnings.length ? warnings : badges;
  if (!pick.length) return null;
  return { value: pick.reduce((sum, badge) => sum + badge.value, 0), tone: warnings.length ? "warning" : "neutral" };
}

export function PlanScreen({ tab }: { tab?: string }) {
  const t = useT();
  const first = shown[0]?.[0] ?? "planner";
  const [current, setCurrent] = useState<TabId>(shown.some(([id]) => id === tab) ? (tab as TabId) : first);
  if (!shown.length) return null;
  return (
    <Page width="wide">
      <PageHeader title={t("nav.plan")} className="mb-5" />
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as TabId)}>
        <TabBar
          value={current}
          label={t("nav.plan")}
          tabs={shown.map(([id]) => ({ value: id, label: t(`plan.tab.${id}` as StringKey) }))}
          className="border-b border-line"
        />
        {shown.map(([id, { Tab }]) => (
          <Tabs.Content key={id} value={id} className="focus-ring rounded-sm pt-6">
            <Tab onCalendar={() => setCurrent("deadlines")} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Page>
  );
}
