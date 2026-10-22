// An optional identity for future AI features, separate from the Student's academic accounts.
import { useEffect, useRef, useState } from "react";
import type { ChatGptStatus } from "../../core/actions/chatgpt";
import { useT } from "../i18n";
import { useBridge } from "../store";
import { Button } from "../ui/controls";
import { ConfirmDialog } from "../ui/overlays";

export function ChatGptSettings() {
  const t = useT();
  const bridge = useBridge();
  const [status, setStatus] = useState<ChatGptStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let live = true;
    const unsubscribe = bridge.onEvent((event) => {
      if (event.type === "chatgpt") {
        setStatus(event.status);
        setBusy(event.status.connecting);
      }
    });
    bridge.invoke("chatgpt.status", {}).then(
      (next) => {
        if (live) {
          setStatus(next);
          setBusy(next.connecting);
        }
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, [bridge]);

  const connect = async () => {
    const attempt = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const next = await bridge.invoke("chatgpt.connect", {});
      if (generation.current === attempt) setStatus(next);
    } catch {
      if (generation.current === attempt) setFailed(true);
    } finally {
      if (generation.current === attempt) setBusy(false);
    }
  };
  const disconnect = async () => {
    ++generation.current;
    try {
      setStatus(await bridge.invoke("chatgpt.disconnect", {}));
      setConfirming(false);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-body">{t("chatgpt.title")}</span>
          <span role="status" className="block text-small text-muted">
            {busy
              ? t("chatgpt.waiting")
              : status?.name
                ? t("chatgpt.connected", { name: status.name })
                : status && !status.available
                  ? t("chatgpt.unavailable")
                  : null}
          </span>
        </span>
        {busy ? (
          <Button size="sm" onClick={() => void disconnect()}>
            {t("chatgpt.cancel")}
          </Button>
        ) : status?.name ? (
          <Button size="sm" onClick={() => setConfirming(true)}>
            {t("chatgpt.disconnect")}
          </Button>
        ) : (
          <Button size="sm" disabled={!status?.available} onClick={() => void connect()}>
            {t("chatgpt.connect")}
          </Button>
        )}
      </div>
      <p className="text-small text-muted">{t("chatgpt.hint")}</p>
      {failed && (
        <p role="alert" className="text-small text-danger-fg">
          {t("chatgpt.failed")}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("chatgpt.disconnectTitle")}
        body={t("chatgpt.disconnectBody")}
        confirmLabel={t("chatgpt.disconnect")}
        onConfirm={() => void disconnect()}
      />
    </div>
  );
}
