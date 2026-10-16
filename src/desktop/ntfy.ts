// The phone channel's way out (src/engine/alerts/phone.ts): ntfy's public
// server, through an in-memory Electron session of its own, so the system
// proxy applies and nothing of Edunex's (its session, its cookies) ever rides
// along. The engine names a topic and a message; only this file knows the
// server's address. What fails is reported without its details: a network
// error can carry the address, and the address carries the topic.
import type { Session } from "electron";
import { NTFY_HOST, type Ntfy } from "../engine/alerts/phone";

const SERVER = `https://${NTFY_HOST}`;
const TIMEOUT = 15_000;

export function ntfyClient(session: Session): Ntfy {
  return async (request) => {
    const url = request.method === "POST" ? `${SERVER}/` : `${SERVER}/${encodeURIComponent(request.topic)}/${encodeURIComponent(request.sequenceId)}`;
    let response: Response;
    try {
      response = await session.fetch(url, {
        method: request.method,
        // As JSON, a title in any language needs no header encoding.
        ...(request.method === "POST" ? { headers: { "content-type": "application/json" }, body: JSON.stringify(request.message) } : {}),
        credentials: "omit",
        bypassCustomProtocolHandlers: true,
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch {
      throw new Error("ntfy didn't answer");
    }
    await response.body?.cancel().catch(() => undefined);
    return response.status;
  };
}
