// A pretend ntfy server for the phone channel: it keeps what's booked ahead
// (by topic and sequence ID, replaced and cancelled the way ntfy does it),
// what went out at once, and every request. Nothing goes to the real ntfy.sh.
import type { Ntfy, NtfyMessage, NtfyRequest } from "../../src/engine/alerts/phone";

export class PretendNtfy {
  /** Every request, in order. */
  readonly log: NtfyRequest[] = [];
  /** Waiting for its time, by "topic/sequence id". */
  readonly scheduled = new Map<string, NtfyMessage>();
  /** Sent at once, in order. */
  readonly sent: NtfyMessage[] = [];
  /** How it answers: as itself, not at all (offline), or 429 (too many messages). */
  answer: "ok" | "offline" | "busy" = "ok";
  private topics = 0;

  readonly send: Ntfy = async (request) => {
    this.log.push(request);
    if (this.answer === "offline") throw new Error("ntfy didn't answer");
    if (this.answer === "busy") return 429;
    if (request.method === "DELETE") return this.scheduled.delete(`${request.topic}/${request.sequenceId}`) ? 200 : 404;
    const { message } = request;
    if (message.delay) this.scheduled.set(`${message.topic}/${message.sequence_id}`, message);
    else this.sent.push(message);
    return 200;
  };

  /** Made-up topics, a new one each time, in the format the app makes them. */
  readonly newTopic = () => `edunex-pretendtopic${String(++this.topics).padStart(3, "0")}`;

  posts(): NtfyMessage[] {
    return this.log.flatMap((request) => (request.method === "POST" ? [request.message] : []));
  }

  deletes(): string[] {
    return this.log.flatMap((request) => (request.method === "DELETE" ? [request.sequenceId] : []));
  }

  /** What's booked for a topic, soonest first. */
  booked(topic: string): NtfyMessage[] {
    return [...this.scheduled.values()].filter((m) => m.topic === topic).sort((a, b) => Number(a.delay) - Number(b.delay));
  }
}
