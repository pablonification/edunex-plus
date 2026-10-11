// Talks to EduNex's API (api-edunex.cognisia.id). Every answer is checked
// against a schema: a shape the app doesn't know is "EduNex changed
// something", never an empty screen.
import type { z } from "zod";
import { EngineError } from "../../errors";
import { NetworkError, type Transport } from "../../http/transport";

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
    let response;
    try {
      response = await this.transport.request({
        method: "GET",
        url: url.toString(),
        headers: { authorization: `Bearer ${this.token}`, accept: "application/json", "user-agent": this.userAgent },
        timeoutMs: TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof NetworkError) throw new EngineError("Offline", error.reason === "timeout" ? "EduNex didn't answer in time" : "EduNex is unreachable");
      throw error;
    }
    if (response.status === 401) throw new EngineError("Unauthorized", `EduNex refused ${path}`);
    if (response.status === 429 || response.status >= 500) throw new EngineError("Offline", `EduNex answered ${response.status}`);
    if (response.status >= 400) throw new EngineError("Failed", `EduNex answered ${response.status} for ${path}`);
    let body: unknown;
    try {
      body = JSON.parse(response.body);
    } catch {
      throw new EngineError("VendorChanged", `EduNex sent something other than data for ${path}`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new EngineError("VendorChanged", `${path}: ${issue?.path.join(".") || "(root)"} ${issue?.message ?? "unexpected"}`);
    }
    return parsed.data;
  }
}
