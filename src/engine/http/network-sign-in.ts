// Wi-Fi that wants its own sign-in first (ITB's campus Wi-Fi, #381) answers for the sites the app reads with
// something that sends the browser to that sign-in: a page that refreshes there, or a redirect. Nothing of the
// site's came back: no connection yet, not the site changing or ending the session (#387). SIX, Edunex and ITB's
// public pages each ask here before they take an answer as one of their own.

/** Microsoft's sign-in (Azure's older addresses too), where an ended SIX or Edunex session goes: never taken for a network's own. */
const MICROSOFT_SIGN_IN = /(^|\.)(microsoftonline\.(com|us|cn)|microsoft\.com|live\.com|msauth\.net|msftauth\.net|windows\.net|b2clogin\.com|ciamlogin\.com)$/i;
/** A page's `<meta>` tags. */
const META = /<meta\b[^<>]*>/gi;
/** One attribute's value, by its whole name: after a space, a quote or a slash, never "data-http-equiv"'s tail. */
const ATTRIBUTES = {
  "http-equiv": /[\s"'/]http-equiv\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i,
  content: /[\s"'/]content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i,
};
const attribute = (tag: string, name: keyof typeof ATTRIBUTES): string | null => {
  const found = ATTRIBUTES[name].exec(tag);
  return found ? (found[1] ?? found[2] ?? found[3] ?? "") : null;
};
/** Where a refresh's `content` ("0; url=https://…", "0;URL='…'") sends the browser. */
const REFRESH_TO = /^\s*[\d.]*\s*[;,]?\s*(?:url\s*=\s*)?["']?([^"'\s]+)/i;

/**
 * How sure a caller must be. `naming`: the address must carry the page asked for (its site and path), as the network's
 * sign-in does to send the browser back there after; another sign-in service carries only its own callback.
 */
export interface Away {
  naming: boolean;
}

/**
 * The site (its host) that `address`, read from `from`, leads to when that's off `from`'s own site and isn't
 * Microsoft's sign-in: a network's sign-in. With `naming`, only when the address also carries the page asked for (the
 * campus gate's "?destination_url=https://six.itb.ac.id/app/…/statusmhs", #381), so a site's own move elsewhere (a new
 * address, a page it sends the Student to, another sign-in service with the site's callback) still reads as that site
 * changing or ending the session, never as no connection. Null for the same site (by http too), an address with no
 * site (javascript:, data:), Microsoft's sign-in, or no address at all.
 */
export function awayTo(address: string | undefined, from: string, { naming }: Away = { naming: true }): string | null {
  if (!address) return null;
  try {
    const url = new URL(address.replace(/&amp;/g, "&"), from);
    const home = new URL(from).hostname;
    if (!url.hostname || url.hostname === home || MICROSOFT_SIGN_IN.test(url.hostname)) return null;
    return !naming || carries(url, new URL(from)) ? url.host : null;
  } catch {
    return null;
  }
}

/**
 * Whether `address` carries the page `asked` back: its site and path together ("six.itb.ac.id/home"), in the address's
 * query or fragment (never its own path), as it is, decoded, or in one of its values decoded once more.
 */
function carries(address: URL, asked: URL): boolean {
  const page = `${asked.hostname}${asked.pathname === "/" ? "" : decodeURI(asked.pathname)}`.toLowerCase();
  const raw = `${address.search}${address.hash}`;
  const texts = [raw, ...address.searchParams.values(), ...new URLSearchParams(address.hash.slice(1)).values()];
  for (const value of [...texts]) {
    try {
      texts.push(decodeURIComponent(value));
    } catch {
      // Not encoded the usual way: read as it is.
    }
  }
  return texts.some((text) => text.toLowerCase().includes(page));
}

/** The site a page asked for at `from` sends the browser off to with a `<meta http-equiv="refresh">` (its host), or null. */
export function refreshesAway(html: string, from: string, away: Away = { naming: true }): string | null {
  for (const [tag] of html.matchAll(META)) {
    if (attribute(tag, "http-equiv")?.trim().toLowerCase() !== "refresh") continue;
    const gate = awayTo(REFRESH_TO.exec(attribute(tag, "content") ?? "")?.[1], from, away);
    if (gate) return gate;
  }
  return null;
}
