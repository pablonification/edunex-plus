// Rencana studi › UKT on the phone (src/app/screens/plan/bills.tsx, S15): bills, instalments and
// deadlines in one column. This semester's and next semester's bill with what's paid and the
// next deadline, SIX's last day next to ITB's calendar deadline, an overdue bill said plainly,
// then every term's bill. View only: the app never pays.
import { View } from "react-native";
import { useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type BillUrgency, billLeft, billUrgency, nextTerm, rupiah, uktDeadline } from "../../../../src/core/academic";
import type { Bill } from "../../../../src/core/models";
import { SixPageNote } from "../../parts/six-page-note";
import { Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Notice, Section } from "../../ui/layout";
import { Text } from "../../ui/text";
import { type Palette, radius, space, useTheme } from "../../ui/theme";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

const STATUS: Record<BillUrgency, { bg: keyof Palette | null; fg: keyof Palette; icon: (typeof Icons)[keyof typeof Icons] }> = {
  paid: { bg: null, fg: "successFg", icon: Icons.CheckCircle },
  "not-billed": { bg: "neutralBg", fg: "neutralFg", icon: Icons.Circle },
  unknown: { bg: "neutralBg", fg: "neutralFg", icon: Icons.Info },
  overdue: { bg: "dangerBg", fg: "dangerFg", icon: Icons.AlertTriangle },
  soon: { bg: "warningBg", fg: "warningFg", icon: Icons.Clock },
  due: { bg: "neutralBg", fg: "neutralFg", icon: Icons.Clock },
  "no-date": { bg: "neutralBg", fg: "neutralFg", icon: Icons.Clock },
};

function StatusChip({ bill }: { bill: Bill }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const urgency = billUrgency(bill, now);
  const { bg, fg, icon: Icon } = STATUS[urgency];
  const label = urgency === "overdue" ? t("bills.status.overdue") : t(`bills.status.${bill.status}`);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 24,
        paddingHorizontal: bg ? 8 : 0,
        borderRadius: radius.full,
        backgroundColor: bg ? theme.color[bg] : "transparent",
      }}
    >
      <Icon size={12} color={theme.color[fg]} weight="bold" />
      <Text size="caption" weight="semibold" style={{ color: theme.color[fg] }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const notBilled = (term: string): Bill => ({
  term,
  amount: null,
  paid: null,
  status: "not-billed",
  dueDate: null,
  dueAt: null,
  instalments: [],
  nextDueAt: null,
});

const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00+07:00`);

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const termYears = useTermYears();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills)
    return (
      <SixNeeded
        datasets={["six.bills"]}
        icon={<Icons.Wallet size={20} color={theme.color.muted} />}
        title={t("bills.needSix")}
        body={t("bills.needSixBody")}
      />
    );
  const billed = bills.filter((b) => b.status !== "not-billed");
  const current = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  // SIX lists a term's row only once the term is set up: until then it isn't billed either.
  const next = current && (bills.find((b) => b.term === nextTerm(current.term)) ?? notBilled(nextTerm(current.term)));
  const overdue = bills.filter((b) => billUrgency(b, now) === "overdue");
  const allPaid = billed.length > 0 && billed.every((b) => b.status === "paid");
  return (
    <View style={{ gap: space[6] }}>
      {overdue.map((bill) => (
        <View key={bill.term} accessibilityRole="alert">
          <Notice tone="danger" title={t("bills.overdue", { term: termYears(bill.term), date: f.dayMonth(bill.nextDueAt!), amount: rupiah(billLeft(bill)) })} />
        </View>
      ))}
      <SixPageNote datasets={["six.bills"]} />
      {current && <BillCard label={t("bills.thisTerm")} bill={current} />}
      {next && <BillCard label={t("bills.nextTerm")} bill={next} />}
      {/* "Lunas" on every row would bury the one that isn't: a paid row stays quiet, and all paid is said once. */}
      <Section first title={t("bills.history")} description={allPaid ? t("bills.allPaid") : undefined} testID="section.billsHistory">
        <List>
          {[...billed].reverse().map((bill) => (
            <View
              key={bill.term}
              testID={`row.bill.${bill.term}`}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="body" weight="medium">
                  {termYears(bill.term)}
                </Text>
                {/* "Batas bayar 15 Jan 2026": a date on its own under a term reads as when it was paid. */}
                {bill.dueDate && (
                  <Text size="small" tone="muted" tabular>
                    {`${t("bills.deadline")} ${f.dayMonth(dayMs(bill.dueDate))} ${bill.dueDate.slice(0, 4)}`}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text size="body" tabular>
                  {bill.amount !== null ? rupiah(bill.amount) : "-"}
                </Text>
                {bill.instalments.length > 0 && (
                  <Text size="caption" tone="faint">
                    {t("bills.inInstalments", { count: bill.instalments.length })}
                  </Text>
                )}
                {bill.status !== "paid" && <StatusChip bill={bill} />}
              </View>
            </View>
          ))}
        </List>
        <View style={{ marginTop: space[2] }}>
          <Meta size="caption" tone="faint">
            {t("bills.from")}
            {t("bills.viewOnly")}
          </Meta>
        </View>
      </Section>
    </View>
  );
}

/** One deadline to follow: the earlier of SIX's and ITB's calendar, with the other explained. */
function deadlineOf(bill: Bill, itbDay: string | null): { day: string; other: { day: string; source: "six" | "itb" } | null } | null {
  const six = bill.dueDate;
  if (!six && !itbDay) return null;
  if (!six) return { day: itbDay!, other: null };
  if (!itbDay || itbDay === six) return { day: six, other: null };
  return itbDay < six ? { day: itbDay, other: { day: six, source: "six" } } : { day: six, other: { day: itbDay, source: "itb" } };
}

function BillCard({ label, bill }: { label: string; bill: Bill }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const termYears = useTermYears();
  const calendar = useDataset("itb.calendar");
  const itb = uktDeadline(calendar, bill.term);
  const billedNow = bill.status !== "not-billed";
  const deadline = deadlineOf(bill, itb?.lastDay ?? null);
  // Each instalment covered by what's paid; unknown (null) when SIX writes the payment in a way the app can't read yet.
  const paidInstalments = (() => {
    let paid = bill.paid ?? 0;
    return bill.instalments.map((i) => {
      const covered = paid >= i.amount;
      paid -= i.amount;
      return bill.status === "unknown" ? null : covered;
    });
  })();
  const divider = { marginTop: space[3], paddingTop: space[3], borderTopWidth: 1, borderTopColor: theme.color.line } as const;
  return (
    <Card style={{ paddingHorizontal: space[4], paddingVertical: space[4] }} testID={`card.bill.${bill.term}`}>
      <Meta size="small">
        {label}
        {termYears(bill.term)}
      </Meta>
      {billedNow ? (
        <>
          <Text size="figure" weight="semibold" tabular style={{ marginTop: space[1] }}>
            {bill.amount !== null ? rupiah(bill.amount) : "-"}
          </Text>
          <View style={{ marginTop: space[1.5], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
            <StatusChip bill={bill} />
            {bill.status === "partly-paid" && bill.paid !== null && (
              <Meta>
                {t("bills.paidOf", { paid: rupiah(bill.paid) })}
                {t("bills.left", { amount: rupiah(billLeft(bill)) })}
              </Meta>
            )}
            {bill.nextDueAt !== null && (
              <Text size="small" weight="medium" tabular>
                {t("bills.nextDue", { date: f.dayMonth(bill.nextDueAt) })}
              </Text>
            )}
          </View>
        </>
      ) : (
        <>
          <Text size="title" weight="medium" tone="muted" style={{ marginTop: space[1] }}>
            {t("bills.notBilled")}
          </Text>
          <Text size="small" tone="muted" style={{ marginTop: 2 }}>
            {deadline ? t("bills.expect", { date: f.dayMonth(dayMs(deadline.day)).replace(" ", " ") }) : t("bills.expectNoDate")}
          </Text>
        </>
      )}
      {billedNow && deadline && (
        <View style={divider}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
            <Text size="small" tone="muted">
              {t("bills.deadline")}
            </Text>
            <Text size="small" weight={bill.status === "paid" ? "regular" : "semibold"} tone={bill.status === "paid" ? "muted" : "fg"} tabular>
              {f.dayMonth(dayMs(deadline.day))}
            </Text>
          </View>
          {/* Which of two deadlines to follow matters only while there's something to pay: once paid, the other is only a fact. */}
          {deadline.other && (
            <Text size="caption" tone="faint" style={{ marginTop: 2 }}>
              {bill.status === "paid"
                ? t(deadline.other.source === "six" ? "mobile.bills.paidOtherSix" : "mobile.bills.paidOtherItb", {
                    date: f.dayMonth(dayMs(deadline.other.day)),
                  })
                : t(deadline.other.source === "six" ? "bills.otherSix" : "bills.otherItb", { date: f.dayMonth(dayMs(deadline.other.day)) })}
            </Text>
          )}
        </View>
      )}
      {bill.instalments.length > 0 && (
        <View style={divider}>
          <Text size="caption" weight="medium" tone="muted" style={{ marginBottom: space[1.5] }}>
            {t("bills.instalments")}
          </Text>
          <View style={{ gap: space[1] }}>
            {bill.instalments.map((instalment, i) => (
              <View key={instalment.number} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {paidInstalments[i] === null ? (
                    <Icons.Info size={14} color={theme.color.faint} />
                  ) : paidInstalments[i] ? (
                    <Icons.CheckCircle size={14} color={theme.color.successFg} />
                  ) : (
                    <Icons.Circle size={14} color={theme.color.faint} />
                  )}
                  <Text size="small">{t("bills.instalment", { number: instalment.number })}</Text>
                </View>
                <Text size="small" tabular>
                  {rupiah(instalment.amount)}
                </Text>
                <Text size="small" tone="muted" tabular>
                  {f.dayMonth(dayMs(instalment.dueDate))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}
