// Identity-only OIDC, kept in main. No AI permissions, tokens in the renderer, or client secrets.
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { z } from "zod";
import { listenForCode } from "./callback";

const ISSUER = "https://auth.openai.com";
const endpoint = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.origin === ISSUER && !url.username && !url.password && !url.hash;
  });
const Discovery = z.object({ issuer: z.literal(ISSUER), authorization_endpoint: endpoint, token_endpoint: endpoint, jwks_uri: endpoint });

export const ChatGptIdentity = z.object({
  issuer: z.literal(ISSUER),
  clientId: z.string().min(1),
  subject: z.string().min(1),
  name: z.string().min(1).max(200),
});
export type ChatGptIdentity = z.infer<typeof ChatGptIdentity>;
export interface ChatGptConfig {
  clientId: string;
  redirectUri: string;
}

/** Desktop applications are public clients: provisioning must allow token-endpoint auth `none`. */
export function chatgptConfig(env: NodeJS.ProcessEnv): ChatGptConfig | null {
  const clientId = env.OPENAI_CLIENT_ID;
  const redirectUri = env.OPENAI_REDIRECT_URI;
  if (!clientId?.startsWith("oaiapp_") || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      Number(url.port) === 0 ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    return { clientId, redirectUri };
  } catch {
    return null;
  }
}

export async function signInWithChatGpt(options: {
  config: ChatGptConfig;
  signal: AbortSignal;
  fetch: typeof fetch;
  openBrowser(url: string): Promise<void>;
  message: string;
}): Promise<ChatGptIdentity> {
  const { config, signal } = options;
  const request: typeof fetch = (url, init) => options.fetch(url, { ...init, signal, redirect: "error", credentials: "omit" });
  const discoveryResponse = await request(`${ISSUER}/.well-known/openid-configuration`);
  if (!discoveryResponse.ok) throw new Error("OpenAI discovery failed");
  const discovery = Discovery.parse(await discoveryResponse.json());
  const random = () => randomBytes(32).toString("base64url");
  const state = random();
  const nonce = random();
  const verifier = random();
  const callback = await listenForCode(new URL(config.redirectUri), state, signal, options.message);
  try {
    const authorize = new URL(discovery.authorization_endpoint);
    authorize.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    await options.openBrowser(authorize.href);
    const code = await callback.code;
    const response = await request(discovery.token_endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!response.ok) throw new Error("OpenAI token exchange failed");
    const { id_token: idToken } = z.object({ id_token: z.string().min(1) }).parse(await response.json());
    const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri), { [customFetch]: request });
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: discovery.issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat", "nonce"],
      maxTokenAge: "10m",
      clockTolerance: 5,
    });
    if (
      payload.nonce !== nonce ||
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)
    ) {
      throw new Error("OpenAI identity did not match this sign-in");
    }
    // Names are presentation only. Email is deliberately not an account-linking key.
    return ChatGptIdentity.parse({ issuer: discovery.issuer, clientId: config.clientId, subject: payload.sub, name: payload.name ?? "ChatGPT" });
  } finally {
    callback.close();
  }
}
