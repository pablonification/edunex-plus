// Whether the first minute plays (./scene.tsx): it starts while nobody is signed in and, once started, stays through
// the sign-in until it has handed over to Beranda, a moment after "nobody" stopped being true. The scene's code and
// art load only then: a start with someone signed in pays for this file's one check and no more.
import { useState } from "react";
import { useNobodyIn } from "../nobody";

// Whether the stage (the two doors) is up right now: a sign-in page that has nothing left for the Student to do steps
// aside for it (../sign-in.tsx) instead of covering it with a spinner.
let stageUp = false;
export const firstMinuteStageUp = () => stageUp;
export function setFirstMinuteStageUp(up: boolean): void {
  stageUp = up;
}

export function FirstMinuteGate() {
  const nobody = useNobodyIn();
  const [playing, setPlaying] = useState(nobody);
  if (nobody && !playing) setPlaying(true);
  if (!playing) return null;
  const { FirstMinute } = require("./scene") as typeof import("./scene");
  return <FirstMinute onDone={() => setPlaying(false)} />;
}
