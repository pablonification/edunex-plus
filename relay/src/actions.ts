// Which run of the fix bot is asking. GitHub Actions gives each job a token, signed by GitHub, that
// says which repository, workflow file and run it belongs to (its OIDC token). Nobody reading a
// run's public log can make one, so a ticket that shows there is no use without it
// (.github/workflows/drift-fix.yml, docs/relay.md).

const ISSUER = "https://token.actions.githubusercontent.com";

/** One of GitHub's signing keys, as its key list gives it. */
export interface SigningKey {
  kid?: string;
  kty: string;
  n: string;
  e: string;
}

/** GitHub's signing keys: fetched in production, made up in the tests. */
export type SigningKeys = () => Promise<SigningKey[]>;

/** GitHub's keys, fetched again after an hour. */
export function githubSigningKeys(): SigningKeys {
  let kept: { at: number; keys: SigningKey[] } | null = null;
  return async () => {
    if (kept && Date.now() - kept.at < 3_600_000) return kept.keys;
    const response = await fetch(`${ISSUER}/.well-known/jwks`);
    if (!response.ok) return kept?.keys ?? [];
    kept = { at: Date.now(), keys: ((await response.json()) as { keys: SigningKey[] }).keys };
    return kept.keys;
  };
}

const bytes = (part: string) => Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

function parsePart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes(part)));
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface Expected {
  /** The relay's own address: the token must have been made for it. */
  audience: string;
  /** "owner/name". */
  repo: string;
  /** The workflow file, on main. */
  workflow: string;
  keys: SigningKeys;
  now: number;
}

/** The run a GitHub Actions token belongs to, if it's genuine, unexpired, made for the relay, and from `workflow` on main of `repo`. */
export async function actionsRun(token: string, expected: Expected): Promise<string | null> {
  const [head, body, signature, extra] = token.split(".");
  if (!head || !body || !signature || extra !== undefined) return null;
  const header = parsePart(head);
  const claims = parsePart(body);
  if (header?.alg !== "RS256" || !claims) return null;
  const jwk = (await expected.keys()).find((key) => key.kid === header.kid);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(signature), new TextEncoder().encode(`${head}.${body}`)))) return null;
  } catch {
    return null;
  }
  const seconds = expected.now / 1000;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== ISSUER || !audiences.includes(expected.audience)) return null;
  // A minute's grace either way, for clocks that differ.
  if (typeof claims.exp !== "number" || claims.exp + 60 < seconds || (typeof claims.nbf === "number" && claims.nbf - 60 > seconds)) return null;
  if (claims.repository !== expected.repo || claims.workflow_ref !== `${expected.repo}/.github/workflows/${expected.workflow}@refs/heads/main`) return null;
  return typeof claims.run_id === "string" || typeof claims.run_id === "number" ? String(claims.run_id) : null;
}
