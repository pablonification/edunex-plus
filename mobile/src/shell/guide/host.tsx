// The guide's place over the screens (../../../app/_layout.tsx): nothing on a start where it won't show. A Student
// who took or skipped the tour costs two reads here (is it running, is it done) and no more: the tour's drawing
// (./tour.tsx, with Reanimated and the kit) is loaded at its first use (metro.config.js), which is the moment the
// invitation's turn comes or the Student asks for the tour in Settings › Tentang.
import { useEffect } from "react";
import { useSettings } from "../../../../src/app/store";
import { useSettling } from "../../host/settling";
import { useFirstMinuteCovering } from "../first-minute/covering";
import { useNobodyIn } from "../nobody";
import { endGuide, useGuideOffers, useGuideRunning } from "./state";
import { guideMayOffer } from "./steps";
import { GuideOffer, GuideTour } from "./tour";

export function GuideHost() {
  const running = useGuideRunning();
  const { guideDone } = useSettings();
  // Done for good and not asked for: nothing more is read, nothing is loaded.
  if (!running && guideDone !== false) return null;
  return <Due running={running} />;
}

/** A Student the tour is still for, or one who asked for it: the tour while it runs, else the invitation on its turn. */
function Due({ running }: { running: boolean }) {
  const { guideDone, firstScanDone } = useSettings();
  const offers = useGuideOffers();
  const settling = useSettling();
  const covering = useFirstMinuteCovering();
  const nobody = useNobodyIn();
  // Signed out of everything while it ran: the tour goes with the screens it was pointing at.
  useEffect(() => {
    if (running && nobody) endGuide();
  }, [running, nobody]);
  if (nobody) return null;
  if (running) return <GuideTour />;
  if (!guideMayOffer({ guideDone, firstScanDone, offers, settling, covering, nobody })) return null;
  return <GuideOffer />;
}
