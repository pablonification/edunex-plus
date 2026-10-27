// Talks to Edunex's API (api-edunex.cognisia.id). Every answer is checked
// against a schema: a shape the app doesn't know is "Edunex changed
// something", never an empty screen.
import type { z } from "zod";
import { EngineError } from "../../errors";
import { type Answer, type HttpResponse, NetworkError, type Transport } from "../../http/transport";

export const EDUNEX_API = "https://api-edunex.cognisia.id";
export const TIMEOUT_MS = 15_000;

export class EdunexClient {
  constructor(
    private readonly transport: Transport,
    private readonly token: string,
    private readonly userAgent: string,
  ) {}

  async get<S extends z.ZodType>(path: string, query: Record<string, string | number>, schema: S): Promise<z.infer<S>> {
    const url = new URL(path, EDUNEX_API);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let response: HttpResponse;
    try {
      response = await this.transport.request({
        method: "GET",
        url: url.toString(),
        headers: { authorization: `Bearer ${this.token}`, accept: "application/json", "user-agent": this.userAgent },
        timeoutMs: TIMEOUT_MS,
        check: (answer) => read(answer, schema),
      });
    } catch (error) {
      if (error instanceof NetworkError)
        throw new EngineError("Offline", error.reason === "timeout" ? "Edunex didn't answer in time" : "Edunex is unreachable", true);
      throw error;
    }
    return read({ path, status: response.status, body: response.body }, schema);
  }
}

/** An answer as the app takes it: by its status, then its body against `schema`. An EngineError when either doesn't fit. */
function read<S extends z.ZodType>({ path, status, body }: Answer, schema: S): z.infer<S> {
  if (status === 401) throw new EngineError("Unauthorized", `Edunex refused ${path}`);
  if (status === 429 || status >= 500) throw new EngineError("Offline", `Edunex answered ${status}`);
  if (status >= 400) throw new EngineError("Failed", `Edunex answered ${status} for ${path}`);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new EngineError("VendorChanged", `Edunex sent something other than data for ${path}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EngineError("VendorChanged", `${path}: ${issue?.path.join(".") || "(root)"} ${issue?.message ?? "unexpected"}`);
  }
  return parsed.data;
}
