import { SITE_HOME, siteOf } from "../src/host/signed-pages";
import { useParam } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { SignedPage } from "../src/screens/web/signed-page";

/** Edunex's or SIX's page in the app, signed in (?url=…); any other address opens SIX's home. */
export default function Screen() {
  usePerfDrawn(true);
  const asked = useParam("url") ?? "";
  const url = siteOf(asked) ? asked : SITE_HOME.six;
  return <SignedPage key={url} url={url} />;
}
