// Whether nobody is signed in yet: the welcome screen is up, over the tabs (../../app/_layout.tsx).
import { useDataset, useStatus } from "../../../src/app/store";
import { useSettling } from "../host/settling";

/** Saved data keeps the app up even while a session is being checked or has ended (the desktop's nobodyIn). */
export function useNobodyIn(): boolean {
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  // The demo signing itself in after the first frame isn't a first run.
  const settling = useSettling();
  return edunex.state === "signed-out" && !account && six.state === "signed-out" && !student && !settling;
}
