// The phone's test/kit/fixtures (metro.config.js swaps it in): the same recordings the pretend
// world serves on the desktop, read from a bundle (./recorded.js, made by `npm run demo:fixtures`)
// since the phone can't read the repository's files. Looked up the same way (test/kit/recordings.ts).
import { recordings } from "../../../test/kit/recordings";
import recorded from "./recorded";

export type { Exchange, System } from "../../../test/kit/recordings";

export const { exchanges, exchange, bodyText, edunexJson, sixPage, publicPage, calendarFeed } = recordings((file) => {
  const text = recorded[file];
  if (text === undefined) throw new Error(`No recording ${file} in the demo's bundle: run \`npm run demo:fixtures\` again`);
  return text;
});
