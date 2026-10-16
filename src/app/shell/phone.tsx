// Settings' "Notifikasi di HP": alerts on the Student's phone through the ntfy
// app (src/engine/alerts/phone.ts). Off until the Student connects; then a QR
// code of the subscribe link for Android, the code to paste for iPhone (its
// ntfy app doesn't open ntfy:// links), the steps, a test and a way out. The
// window only asks: main makes the code and does the sending.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { encode } from "uqr";
import type { PhoneLink } from "../../core/actions/phone";
import type { StringKey } from "../../core/strings";
import { useT } from "../i18n";
import { useBridge, useDataset } from "../store";
import { Button } from "../ui/controls";
import { Icons } from "../ui/icons";
import { toast } from "../ui/overlays";

const STEPS: StringKey[] = ["phone.step.install", "phone.step.android", "phone.step.iphone"];

/** The rows inside Settings' phone group, read afresh when another Student signs in: their phone isn't the last one's. */
export function PhoneSettings({ report }: { report: (error: unknown) => void }) {
  const nim = useDataset("edunex.account")?.nim;
  return <PhoneRows key={nim ?? ""} report={report} />;
}

function PhoneRows({ report }: { report: (error: unknown) => void }) {
  const t = useT();
  const bridge = useBridge();
  const [link, setLink] = useState<PhoneLink | null>(null);
  const [busy, setBusy] = useState<"connect" | "test" | "disconnect" | null>(null);
  const [sent, setSent] = useState(false);
  const [notCancelled, setNotCancelled] = useState(false);

  useEffect(() => {
    let live = true;
    bridge.invoke("phone.link", {}).then(
      (next) => live && setLink(next),
      () => live && setLink({ connected: false }),
    );
    return () => {
      live = false;
    };
  }, [bridge]);

  const run = async (what: NonNullable<typeof busy>, work: () => Promise<void>) => {
    setBusy(what);
    try {
      await work();
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };
  const connect = () =>
    run("connect", async () => {
      setNotCancelled(false);
      setLink(await bridge.invoke("phone.connect", {}));
    });
  const test = () =>
    run("test", async () => {
      setSent(false);
      const next = await bridge.invoke("phone.test", {});
      setLink(next);
      setSent(next.connected && next.problem === null);
    });
  const disconnect = () =>
    run("disconnect", async () => {
      const { cancelled } = await bridge.invoke("phone.disconnect", {});
      setSent(false);
      setNotCancelled(!cancelled);
      setLink({ connected: false });
    });
  const copy = () => void bridge.invoke("phone.copy", {}).then(() => toast(t("phone.copied"), "success"), report);

  if (!link) return <div className="h-14" />;
  if (!link.connected)
    return (
      <>
        <Line label={t("phone.off")} hint={t("phone.offHint")}>
          <Button size="sm" busy={busy === "connect"} icon={<Icons.Smartphone className="size-3.5" />} onClick={() => void connect()}>
            {t("phone.connect")}
          </Button>
        </Line>
        {notCancelled && <Status tone="warning">{t("phone.notCancelled")}</Status>}
      </>
    );
  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3">
        <QrCode text={link.link} label={t("phone.qr")} />
        <ol className="min-w-0 list-decimal space-y-1.5 pl-4 text-small text-muted">
          {STEPS.map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
      </div>
      <Line label={t("phone.topic")} hint={<span className="font-mono break-all text-body select-all">{link.topic}</span>}>
        <Button size="sm" aria-label={t("phone.copyCode")} onClick={copy}>
          {t("phone.copy")}
        </Button>
      </Line>
      <Line label={t("phone.test")} hint={t("phone.testHint")}>
        <Button size="sm" busy={busy === "test"} onClick={() => void test()}>
          {t("phone.testAction")}
        </Button>
      </Line>
      {link.problem ? (
        <Status tone="warning">{t(link.problem === "offline" ? "phone.problem.offline" : "phone.problem.busy")}</Status>
      ) : (
        sent && <Status tone="success">{t("phone.testSent")}</Status>
      )}
      <Line label={t("phone.disconnect")} hint={t("phone.disconnectHint")}>
        <Button size="sm" variant="danger" busy={busy === "disconnect"} onClick={() => void disconnect()}>
          {t("phone.disconnectAction")}
        </Button>
      </Line>
    </>
  );
}

/** A row the way Settings draws its own: what it is, a hint, and its control beside it. */
function Line({ label, hint, children }: { label: string; hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        <span className="block text-small text-muted">{hint}</span>
      </span>
      {children}
    </div>
  );
}

function Status({ tone, children }: { tone: "success" | "warning"; children: ReactNode }) {
  const Icon = tone === "success" ? Icons.CheckCircle : Icons.AlertTriangle;
  return (
    <p
      role="status"
      className={
        tone === "success"
          ? "flex items-start gap-2 bg-success-bg/60 px-4 py-2.5 text-small text-success-fg"
          : "flex items-start gap-2 bg-warning-bg/60 px-4 py-2.5 text-small text-warning-fg"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" weight="bold" />
      {children}
    </p>
  );
}

/**
 * A QR code drawn from its modules, one SVG path, never markup from a string.
 * Black on white in either theme, with the quiet border cameras need.
 */
function QrCode({ text, label }: { text: string; label: string }) {
  const { d, size } = useMemo(() => {
    const { data } = encode(text, { ecc: "M", border: 0 });
    let path = "";
    for (const [y, row] of data.entries()) for (const [x, dark] of row.entries()) if (dark) path += `M${x} ${y}h1v1h-1z`;
    return { d: path, size: data.length };
  }, [text]);
  const quiet = 3;
  const box = size + quiet * 2;
  return (
    <svg role="img" aria-label={label} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} shapeRendering="crispEdges" className="size-36 shrink-0 rounded-lg">
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
