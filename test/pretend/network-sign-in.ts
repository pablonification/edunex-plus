// Wi-Fi that wants its own sign-in first, as campus Wi-Fi answered for SIX in #381: the network stands in for every site
// the app reads, until the Student signs in to it. `page`: its page that only sends the browser to the sign-in (as the
// reports kept it, test/fixtures/six/report-campus-wifi-sign-in-statusmhs.html); `redirect`: a 302 there instead (#387),
// which a request that follows redirects meets as the sign-in's own form.
import type { HttpRequest, HttpResponse } from "../../src/engine/http/transport";

export type NetworkSignIn = "page" | "redirect";

export const NETWORK_SIGN_IN = "https://gate-dev2.itb.ac.id/captive-portal";
const FORM_HTML =
  '<!DOCTYPE html><html><head><title>ITB Wi-Fi</title></head><body><form method="post" action="/captive-portal/login"><input name="username"><input name="password" type="password"><button>Masuk</button></form></body></html>';

const to = (url: URL) => `${NETWORK_SIGN_IN}?destination_url=${url.toString()}`;
const page = (url: URL) => `
<html>
    <head>
        <meta http-equiv="refresh" content="0; url=${to(url)}">
        <script type="text/javascript">
            window.location.replace('${to(url).replaceAll("/", "\\/")}');
        </script>
    </head>
</html>`;

/** The network's answer for `url`, in place of the site's. */
export function networkSignIn(kind: NetworkSignIn, request: HttpRequest, url: URL): HttpResponse {
  if (kind === "page") return { status: 200, headers: { "content-type": "text/html" }, body: page(url), url: url.toString() };
  if (request.redirect === "manual") return { status: 302, headers: { location: to(url) }, body: "", url: url.toString() };
  return { status: 200, headers: { "content-type": "text/html; charset=UTF-8" }, body: FORM_HTML, url: to(url) };
}
