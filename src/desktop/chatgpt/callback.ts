// A listener for one browser transaction, only on the registered IPv4 loopback address.
import { createServer } from "node:http";

export async function listenForCode(redirect: URL, state: string, signal: AbortSignal, message: string) {
  signal.throwIfAborted();
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // A cancellation can arrive before the caller starts awaiting the callback.
  void code.catch(() => undefined);
  let consumed = false;
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("Referrer-Policy", "no-referrer");
    const target = request.url ?? "/";
    if (request.method !== "GET" || request.headers.host !== redirect.host || !target.startsWith("/") || target.startsWith("//")) {
      response.writeHead(404).end();
      return;
    }
    const url = new URL(target, redirect);
    if (url.origin !== redirect.origin || url.pathname !== redirect.pathname) {
      response.writeHead(404).end();
      return;
    }
    if (consumed || url.searchParams.getAll("state").length !== 1 || url.searchParams.get("state") !== state) {
      response.writeHead(400).end();
      return;
    }
    consumed = true;
    response.end(message);
    const returnedCode = url.searchParams.get("code");
    if (signal.aborted || url.searchParams.has("error") || !returnedCode || url.searchParams.getAll("code").length !== 1) {
      rejectCode(new Error("ChatGPT sign-in was not completed"));
    } else {
      resolveCode(returnedCode);
    }
  });
  const close = () => {
    signal.removeEventListener("abort", cancel);
    server.close();
    server.closeAllConnections();
  };
  const cancel = () => {
    consumed = true;
    rejectCode(new Error("ChatGPT sign-in ended"));
    close();
  };
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(redirect.port), "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  return { code, close };
}
