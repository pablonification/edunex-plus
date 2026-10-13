// A pretend for the pages a sign-in window walks through, with the addresses
// the real ones use: sso-edunex.itb.ac.id (sends the Student to Microsoft and
// takes its answer back), Microsoft's (the password page, or the account
// picker, or straight back when it remembers the Student from a moment ago),
// Edunex's website (which saves its session a moment after it opens) and SIX
// ("Login dengan ITB Account", its callback, its signed-in pages). Microsoft
// remembers the Student in the window's own cookies, so wiping the sign-in
// session makes it ask again.

export const MICROSOFT_HOST = "login.microsoftonline.com";
const TENANT = "00000000-0000-4000-8000-000000000000";
/** What a pretend sign-in hands Edunex's website: shaped like its real token, made up. */
export const PRETEND_SIGN_IN_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDAwMDEifQ.c2lnbmF0dXJl";
export const PRETEND_SIGN_IN_COOKIE = "pretend-six-from-sign-in";

/** Cookies by host, as one browser session keeps them. */
export type CookieJar = Map<string, Map<string, string>>;

/** A page's answer: a redirect, or a page (with what its own script saves, after a while). */
export type Answer = { status: number; location: string } | { status: number; html: string; saves?: { key: string; value: string; afterMs: number } };

const page = (title: string, body: string) => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;

export class PretendSignInPages {
  /** What Microsoft asks of a Student it remembers: nothing, or to pick their account again. */
  asksRemembered: "nothing" | "account" = "nothing";
  /** How long Edunex's website takes to save its session once it opens. */
  edunexSavesAfterMs = 1_500;
  /** sso-edunex sends the Student back to Microsoft this many more times (a sign-in Microsoft wants again). */
  ssoAsksAgain = 0;
  /** SIX turns away its "Login dengan ITB Account" address (its /login page then has the button). */
  sixRefusesShortcut = false;
  /** Every address answered, in order. */
  readonly visited: string[] = [];

  answer(address: string, jar: CookieJar): Answer {
    this.visited.push(address);
    const url = new URL(address);
    const cookies = jar.get(url.host) ?? new Map<string, string>();
    jar.set(url.host, cookies);
    switch (url.host) {
      case MICROSOFT_HOST:
        return this.microsoft(url, cookies);
      case "sso-edunex.itb.ac.id":
        if (url.pathname === "/") return { status: 302, location: authorize("https://sso-edunex.itb.ac.id/v2/login") };
        if (url.pathname === "/v2/login" && url.searchParams.get("code")) {
          if (this.ssoAsksAgain > 0) {
            this.ssoAsksAgain -= 1;
            cookies.clear();
            jar.get(MICROSOFT_HOST)?.clear();
            return { status: 302, location: authorize("https://sso-edunex.itb.ac.id/v2/login") };
          }
          return { status: 302, location: "https://edunex.itb.ac.id/" };
        }
        return { status: 404, html: page("Not Found", "<h1>Not Found</h1>") };
      case "edunex.itb.ac.id": {
        const auth = JSON.stringify({ accessToken: PRETEND_SIGN_IN_TOKEN, verified: true });
        return { status: 200, html: page("Edunex", "<div id=app>Memuat…</div>"), saves: { key: "auth", value: auth, afterMs: this.edunexSavesAfterMs } };
      }
      case "six.itb.ac.id":
        return this.six(url, cookies);
      default:
        return { status: 404, html: page("Not Found", "") };
    }
  }

  private microsoft(url: URL, cookies: Map<string, string>): Answer {
    const back = url.searchParams.get("redirect_uri") ?? url.searchParams.get("then") ?? "";
    const handBack = () => ({ status: 302, location: `${back}?code=pretend-code&state=pretend` });
    // The Student typed their password (and 2FA), or picked their account: Microsoft remembers them now.
    if (url.pathname === "/common/login") {
      cookies.set("ESTSAUTH", "pretend-microsoft-session");
      return handBack();
    }
    const form = (title: string, field: string) =>
      page(title, `<form method=post action="https://${MICROSOFT_HOST}/common/login?then=${encodeURIComponent(back)}">${field}</form>`);
    if (!cookies.has("ESTSAUTH")) return { status: 200, html: form("Masuk ke akun Anda", "<input type=password name=passwd>") };
    if (this.asksRemembered === "account") return { status: 200, html: form("Pilih akun", "<button>dimas@example.com</button>") };
    return handBack();
  }

  private six(url: URL, cookies: Map<string, string>): Answer {
    if (url.pathname === "/login/MS365") {
      if (this.sixRefusesShortcut) return { status: 404, html: page("Not Found", "<h1>Not Found</h1>") };
      return { status: 302, location: authorize("https://six.itb.ac.id/login/MS365/callback") };
    }
    if (url.pathname === "/login/MS365/callback" && url.searchParams.get("code")) {
      cookies.set("khongguan", PRETEND_SIGN_IN_COOKIE);
      return { status: 302, location: "https://six.itb.ac.id/home" };
    }
    if (url.pathname === "/login") return { status: 200, html: page("SIX", '<a href="/login/MS365">Login dengan ITB Account</a>') };
    if (!cookies.has("khongguan")) return { status: 302, location: "https://six.itb.ac.id/login" };
    return { status: 200, html: page("SIX", '<a href="/home">Beranda</a> <a href="/logout">Logout</a>') };
  }
}

function authorize(redirect: string): string {
  const query = new URLSearchParams({ client_id: "pretend", response_type: "code", redirect_uri: redirect, response_mode: "query", state: "pretend" });
  return `https://${MICROSOFT_HOST}/${TENANT}/oauth2/v2.0/authorize?${query}`;
}
