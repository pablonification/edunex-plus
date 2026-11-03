// The web views' cookie store (android/…/WebCookiesModule.kt). Missing on a build without the
// native module (a JS-only test run): reads give nothing and clears do nothing.
import { requireOptionalNativeModule } from "expo";

interface WebCookiesModule {
  get(url: string): string;
  set(url: string, cookie: string): Promise<boolean>;
  clear(): Promise<boolean>;
  clearOrigin(origin: string): void;
}

const native = requireOptionalNativeModule<WebCookiesModule>("WebCookies");

/** The cookies a web view holds for `url`, by name. */
export function cookiesFor(url: string): { name: string; value: string }[] {
  const header = native?.get(url) ?? "";
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf("=");
      return at === -1 ? { name: part, value: "" } : { name: part.slice(0, at), value: part.slice(at + 1) };
    });
}

/** Puts one cookie ("name=value; Path=/; Secure") into the web views' store for `url`. */
export async function setCookie(url: string, cookie: string): Promise<void> {
  await native?.set(url, cookie);
}

/** Forgets every cookie and page storage the web views kept. */
export async function clearWebData(): Promise<void> {
  await native?.clear();
}

/** Forgets what one site's pages kept in their storage ("https://edunex.itb.ac.id": Edunex's sign-in). */
export function clearOrigin(origin: string): void {
  native?.clearOrigin(origin);
}
