// What a service's tile answers with before it's opened (Nilai "3,26", UKT "Lunas", KRS "14 SKS"): one source for
// Beranda's grid and Semua layanan, so the same tile says the same thing in both places. Each is null until its fact
// is in (never a guess, never a placeholder). Reads only data the app already has.
import { useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { billUrgency } from "../../../../src/core/academic";
import { shownIndex } from "../grades/transcript";

/** Nilai: the IPK, as Profil's card and Nilai's page say it. */
export function useGradesTag(): string | null {
  const f = useFormat();
  const transcript = useDataset("six.transcript");
  const ipk = transcript ? shownIndex(transcript.ipk) : null;
  return ipk === null ? null : f.number(ipk, 2);
}

/** UKT: "Lunas", or the date this term's bill is due by (Profil's row, the same bill). Anything else is the page's to say. */
export function useBillsTag(): string | null {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills) return null;
  const bill = (term && bills.find((b) => b.term === term)) || bills.filter((b) => b.status !== "not-billed").at(-1);
  if (!bill) return null;
  const urgency = billUrgency(bill, now);
  return (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null
    ? f.dayMonth(bill.nextDueAt)
    : bill.status === "paid"
      ? t("bills.status.paid")
      : null;
}

/** KRS: the SKS taken this term. */
export function useKrsTag(): string | null {
  const t = useT();
  const plan = useDataset("six.krs");
  return plan?.sks == null ? null : t("krs.sks", { sks: plan.sks });
}

/** Every service's tag at once, by its id: what a grid passes to `ServiceTile`'s `tag`. */
export function useServiceTags(): Readonly<Record<string, string | null>> {
  return { grades: useGradesTag(), bills: useBillsTag(), krs: useKrsTag() };
}
