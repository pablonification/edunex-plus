// The crash guard. Each panel (sidebar, top bar, every screen, every dialog)
// sits inside one, so a bad record breaks one panel with a visible error and
// a way out, never the whole window.
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { useT } from "../i18n";
import { Button } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";

interface Props {
  /** Shown in the copied details, so a report says which panel broke. */
  name: string;
  children: ReactNode;
  compact?: boolean;
  /** Kept above the error when the panel breaks: a dialog's title and Close, so the way out stays. */
  header?: ReactNode;
}

export class PanelBoundary extends Component<Props, { error: Error | null }> {
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
    return (
      <>
        {this.props.header}
        <PanelError name={this.props.name} error={error} compact={this.props.compact} onRetry={() => this.setState({ error: null })} />
      </>
    );
  }
}

function PanelError({ name, error, compact, onRetry }: { name: string; error: Error; compact?: boolean; onRetry: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const details = `Edunex Plus · ${name}\n${error.name}: ${error.message}\n${error.stack ?? ""}`;
    void navigator.clipboard?.writeText(details).then(
      () => setCopied(true),
      () => undefined,
    );
  };
  return (
    <div role="alert" className={cx("flex flex-col items-start gap-3 text-body", compact ? "p-3" : "mx-auto max-w-[520px] px-6 py-16")}>
      <p className="flex items-center gap-2 font-semibold">
        <Icons.AlertTriangle className="size-4 text-danger-fg" />
        {t("error.panel")}
      </p>
      {!compact && <p className="font-mono text-small break-words text-muted">{error.message}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {t("action.tryAgain")}
        </Button>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? t("action.copied") : t("action.copyDetails")}
        </Button>
      </div>
    </div>
  );
}
