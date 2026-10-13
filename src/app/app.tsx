// The window's root: providers, then either the welcome screen (nobody signed
// in) or the signed-in shell. The welcome screen's code loads before the window
// first draws only when it is the first screen (firstScreenLoaded).
import { type ReactNode, Suspense, useEffect, useLayoutEffect, useState } from "react";
import type { SourceStatus } from "../core/models";
import type { Bridge } from "./bridge";
import { I18nProvider, type UiClock } from "./i18n";
import { later } from "./later";
import { PdfViewerProvider } from "./pdf";
import { Shell } from "./shell/shell";
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

const Welcome = later(() => import("./shell/welcome").then((screen) => screen.Welcome));

/** Saved data keeps the shell up even while a session is being checked or has ended. */
function nobodyIn(edunex: SourceStatus, six: SourceStatus, account: unknown, student: unknown): boolean {
  return edunex.state === "signed-out" && !account && six.state === "signed-out" && !student;
}

/** Loads the first screen's code, so the window's first frame is never blank (Beranda comes with the window). */
export async function firstScreenLoaded(store: AppStore): Promise<void> {
  if (nobodyIn(store.status("edunex"), store.status("six"), store.dataset("edunex.account")?.value, store.dataset("six.student")?.value))
    await Welcome.preload();
}

function Root() {
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const nobody = nobodyIn(edunex, six, account, student);
  // On first run the welcome screen stays until the Student moves on, so SIX can be connected right after Edunex.
  const [welcoming, setWelcoming] = useState(nobody);
  if (nobody && !welcoming) setWelcoming(true);
  return welcoming ? (
    // Its code is in on first run; after a sign-out, the idle preload has long brought it.
    <Suspense fallback={null}>
      <Welcome onDone={() => setWelcoming(false)} />
    </Suspense>
  ) : (
    <Shell />
  );
}
