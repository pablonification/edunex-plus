// The window's root: providers, then either the welcome screen (nobody signed
// in) or the signed-in shell.
import { useEffect, type ReactNode } from "react";
import type { Bridge } from "./bridge";
import { I18nProvider, type UiClock } from "./i18n";
import { Shell } from "./shell/shell";
import { Welcome } from "./shell/welcome";
import { type AppStore, StoreProvider, useDataset, useSettings, useStatus } from "./store";
import { Toaster, TooltipProvider } from "./ui/overlays";
import { PanelBoundary } from "./ui/panel-boundary";

export function App({ store, bridge, clock }: { store: AppStore; bridge: Bridge; clock?: UiClock }) {
  return (
    <StoreProvider store={store} bridge={bridge}>
      <Localized clock={clock}>
        <TooltipProvider>
          <PanelBoundary name="app">
            <Root />
          </PanelBoundary>
          <Toaster />
        </TooltipProvider>
      </Localized>
    </StoreProvider>
  );
}

function Localized({ clock, children }: { clock?: UiClock; children: ReactNode }) {
  const { lang } = useSettings();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <I18nProvider lang={lang} clock={clock}>
      {children}
    </I18nProvider>
  );
}

function Root() {
  const status = useStatus("edunex");
  const account = useDataset("edunex.account");
  // Saved data keeps the shell up even while a session is being checked or has ended.
  return status.state === "signed-out" && !account ? <Welcome /> : <Shell />;
}
