// The relay on Cloudflare (docs/relay.md): a Worker that hands every /v1/ request, with the address
// it came from, to one Durable Object, which keeps everything and runs the relay (./relay.ts); and
// the cron trigger every ten minutes, which files what waits. The Durable Object's storage is the
// only place reports are kept: nothing about them is public.
import { githubSigningKeys } from "./actions";
import { gitHubApi } from "./github";
import { LIMITS, Relay } from "./relay";
import type { Store } from "./store";

/** The few parts of Cloudflare's types the relay uses (the runtime's own are a bigger download). */
interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

export interface Env {
  RELAY: DurableObjectNamespace;
  /** "owner/name" (wrangler.toml). */
  GITHUB_REPO: string;
  /** Secrets (`wrangler secret put`): the fine-grained token for the repository's issues, and the maintainer's. */
  GITHUB_TOKEN?: string;
  MAINTAINER_TOKEN?: string;
  /** Only to try the relay against a GitHub of one's own (`wrangler dev`). */
  GITHUB_API?: string;
}

/** The path the cron trigger knocks on, which the Worker never passes on from outside. */
const CRON = "/cron";

/** GitHub's keys, fetched once an hour at most, for the fix bot's tickets. */
const signingKeys = githubSigningKeys();

/** The one Durable Object that keeps everything. */
export class RelayObject {
  private readonly relay: Relay;

  constructor(state: { storage: Store }, env: Env) {
    this.relay = new Relay({
      store: state.storage,
      github: gitHubApi({ repo: env.GITHUB_REPO, token: env.GITHUB_TOKEN ?? "", api: env.GITHUB_API }),
      now: () => Date.now(),
      maintainerToken: env.MAINTAINER_TOKEN ?? "",
      repo: env.GITHUB_REPO,
      signingKeys,
      log: (line) => console.log(line),
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === CRON) {
      await this.relay.cron();
      return new Response(null, { status: 204 });
    }
    return this.relay.handle(request, request.headers.get("x-relay-address") ?? "");
  }
}

const relayOf = (env: Env) => env.RELAY.get(env.RELAY.idFromName("relay"));

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith("/v1/")) return Promise.resolve(Response.json({ error: "not-found" }, { status: 404 }));
    // Said too big up front, it's turned away here, unread (the relay stops reading one that's too big anyway).
    if (Number(request.headers.get("content-length") ?? 0) > LIMITS.maxBody) return Promise.resolve(Response.json({ error: "too-big" }, { status: 413 }));
    // Cloudflare says where the request came from; whatever the sender wrote there is replaced.
    const headers = new Headers(request.headers);
    headers.set("x-relay-address", request.headers.get("cf-connecting-ip") ?? "");
    return relayOf(env).fetch(new Request(request, { headers }));
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await relayOf(env).fetch(new Request(`https://relay.internal${CRON}`, { method: "POST" }));
  },
};
