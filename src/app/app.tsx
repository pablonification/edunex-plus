// The window's root: providers, then either the welcome screen (nobody signed
// in) or the signed-in shell.
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import type { Bridge } from "./bridge";
import { I18nProvider, type UiClock } from "./i18n";
import { PdfViewerProvider } from "./pdf";
import { Shell } from "./shell/shell";
import { Welcome } from "./shell/welcome";
import { type AppStore, StoreProvider, useDataset, useSettings, useStatus } from "./store";
import { Toaster, TooltipProvider } from "./ui/overlays";
import { PanelBoundary } from "./ui/panel-boundary";

export function App({ store, bridge, clock }: { store: AppStore; bridge: Bridge; clock?: UiClock }) {
  // The window chrome differs per system (styles.css: --title-bar, --window-controls), from the first frame.
  useLayoutEffect(() => {
    document.documentElement.dataset.platform = store.platform;
  }, [store.platform]);
  return (
    <StoreProvider store={store} bridge={bridge}>
      <Localized clock={clock}>
        <TooltipProvider>
          <PanelBoundary name="app">
            <PdfViewerProvider>
              <Root />
            </PdfViewerProvider>
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
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  // Saved data keeps the shell up even while a session is being checked or has ended.
  const nobody = edunex.state === "signed-out" && !account && six.state === "signed-out" && !student;
  // On first run the welcome screen stays until the Student moves on, so SIX can be connected right after Edunex.
  const [welcoming, setWelcoming] = useState(nobody);
  if (nobody && !welcoming) setWelcoming(true);
  return welcoming ? <Welcome onDone={() => setWelcoming(false)} /> : <Shell />;
}
