// The demo build's link (edunexplusdemo://demo?…) names a scenario for the demo's world, read at
// start-up (src/demo/world.ts); as a screen, it's Beranda.
import { Redirect } from "expo-router";

export default function DemoLink() {
  return <Redirect href="/" />;
}
