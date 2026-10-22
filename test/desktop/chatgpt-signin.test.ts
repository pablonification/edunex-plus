// Real signature verification against an in-process OpenAI stand-in. No provider account or network.
import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ state: "", code: "pretend-code", close: vi.fn() }));
vi.mock("../../src/desktop/chatgpt/callback", () => ({
  listenForCode: async (_redirect: URL, state: string) => {
    browser.state = state;
    return { code: Promise.resolve(browser.code), close: browser.close };
  },
}));

import { chatgptConfig, signInWithChatGpt } from "../../src/desktop/chatgpt/signin";

const issuer = "https://auth.openai.com";
const config = { clientId: "oaiapp_pretend", redirectUri: "http://127.0.0.1:1455/auth/openai/callback" };
const keys = await generateKeyPair("RS256");
const otherKeys = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(keys.publicKey)), kid: "pretend-key", alg: "RS256" };
beforeEach(() => browser.close.mockClear());

function provider(
  options: {
    claims?: Record<string, unknown>;
    wrongSignature?: boolean;
    missingToken?: boolean;
    tokenStatus?: number;
    discovery?: Record<string, unknown>;
  } = {},
) {
  let authorization: URL;
  const exchanges: URLSearchParams[] = [];
  const calls: string[] = [];
  const network: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    expect(init?.redirect).toBe("error");
    expect(init?.credentials).toBe("omit");
    if (url.endsWith("openid-configuration"))
      return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/keys`,
        ...options.discovery,
      });
    if (url.endsWith("/keys")) return Response.json({ keys: [jwk] });
    expect(url).toBe(`${issuer}/token`);
    const body = new URLSearchParams(String(init?.body));
    exchanges.push(body);
    expect(body.get("redirect_uri")).toBe(config.redirectUri);
    expect(body.get("client_id")).toBe(config.clientId);
    expect(body.has("client_secret")).toBe(false);
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(createHash("sha256").update(body.get("code_verifier")!).digest("base64url")).toBe(authorization.searchParams.get("code_challenge"));
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      sub: "pretend-student",
      name: "Dimas Pratama",
      iss: issuer,
      aud: config.clientId,
      iat: now,
      exp: now + 60,
      nonce: authorization.searchParams.get("nonce"),
      ...options.claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "pretend-key" })
      .sign(options.wrongSignature ? otherKeys.privateKey : keys.privateKey);
    return Response.json(options.missingToken ? {} : { id_token: token }, { status: options.tokenStatus ?? 200 });
  };
  const signIn = () =>
    signInWithChatGpt({
      config,
      fetch: network,
      signal: new AbortController().signal,
      message: "Return to the app",
      openBrowser: async (url) => {
        authorization = new URL(url);
        expect(authorization.searchParams.get("state")).toBe(browser.state);
        expect(authorization.searchParams.get("scope")).toBe("openid profile email");
        expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
      },
    });
  return { signIn, exchanges, calls, authorization: () => authorization };
}

describe("ChatGPT identity sign-in", () => {
  it("accepts an ID token without access or refresh tokens, sends the original PKCE verifier, and retains only a stable identity", async () => {
    const p = provider();
    expect(await p.signIn()).toEqual({ issuer, clientId: config.clientId, subject: "pretend-student", name: "Dimas Pratama" });
    expect(p.exchanges[0].get("code")).toBe("pretend-code");
    expect(browser.close).toHaveBeenCalledOnce();
    const first = p.authorization().searchParams;
    await p.signIn();
    for (const key of ["state", "nonce", "code_challenge"]) expect(p.authorization().searchParams.get(key)).not.toBe(first.get(key));
  });

  it.each([
    ["signature", { wrongSignature: true }],
    ["issuer", { claims: { iss: "https://example.com" } }],
    ["audience", { claims: { aud: "oaiapp_another" } }],
    ["expiration", { claims: { exp: 1 } }],
    ["missing expiry", { claims: { exp: undefined } }],
    ["missing issue time", { claims: { iat: undefined } }],
    ["future issue time", { claims: { iat: Math.floor(Date.now() / 1000) + 60 } }],
    ["nonce", { claims: { nonce: "another-transaction" } }],
    ["subject", { claims: { sub: "" } }],
    ["authorized party", { claims: { aud: [config.clientId, "another"], azp: "another" } }],
    ["single-audience authorized party", { claims: { azp: "another" } }],
    ["missing authorized party", { claims: { aud: [config.clientId, "another"] } }],
    ["missing ID token", { missingToken: true }],
    ["failed exchange", { tokenStatus: 401 }],
  ])("rejects an invalid %s and closes the callback", async (_reason, options) => {
    await expect(provider(options).signIn()).rejects.toThrow();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it.each([
    { issuer: "https://example.com" },
    { token_endpoint: "https://example.com/token" },
    { authorization_endpoint: "http://auth.openai.com/authorize" },
    { jwks_uri: "https://example.com/keys" },
  ])("refuses discovery outside the trusted OpenAI issuer: %j", async (discovery) => {
    const p = provider({ discovery });
    await expect(p.signIn()).rejects.toThrow();
    expect(p.calls).toHaveLength(1);
  });

  it("requires a provisioned client and an exact loopback callback; never reads a secret", () => {
    expect(chatgptConfig({ OPENAI_CLIENT_ID: config.clientId, OPENAI_REDIRECT_URI: config.redirectUri })).toEqual(config);
    expect(chatgptConfig({})).toBeNull();
    for (const redirect of [
      "https://example.com/callback",
      "http://localhost:1455/callback",
      "http://127.0.0.1/callback",
      `${config.redirectUri}?extra=1`,
      "bad url",
    ]) {
      expect(chatgptConfig({ OPENAI_CLIENT_ID: config.clientId, OPENAI_REDIRECT_URI: redirect })).toBeNull();
    }
  });
});
