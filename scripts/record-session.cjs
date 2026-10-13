"use strict";

/**
 * Session recorder — a dev tool for building against real data.
 *
 * Opens Edunex and SIX ITB in two plain windows on a throwaway in-memory
 * session. The student signs in themselves and browses normally; the recorder
 * saves what the real sites request and receive, so the engine is built
 * against real responses instead of guessed ones.
 *
 * Never recorded: Microsoft / ITB SSO pages (only method + host + path),
 * Authorization / Cookie / Set-Cookie headers, CSRF form tokens, JWT-looking
 * strings, upload file contents. The Edunex login token never leaves the page:
 * only its shape (keys, expiry) is read. Nothing persists after quit — the
 * session is in-memory and the profile directory is deleted.
 *
 * Output: .scratch/recordings/<timestamp>/ (git-ignored)
 *   index.jsonl     one line per request (redacted URL, status, type, body file)
 *   timeline.jsonl  page navigations and load timings per window
 *   bodies/         response bodies (JSON / HTML / text only)
 *   notes.json      login token shape, cookie names + lifetimes
 *   summary.json    unique endpoints per host
 *
 * Run: npm run record
 * (shells that export ELECTRON_RUN_AS_NODE=1 need: env -u ELECTRON_RUN_AS_NODE npm run record)
 */

const { app, BrowserWindow, Menu, screen, session } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR =
  process.env.RECORDER_OUT ||
  path.resolve(__dirname, "..", ".scratch", "recordings", STAMP);
const BODY_DIR = path.join(OUT_DIR, "bodies");
const PARTITION = "edunex-plus-recorder"; // no "persist:" prefix → memory only
const SMOKE = process.env.RECORDER_SMOKE === "1";
/** "edunex", "six" or "edunex,six": drive the sites automatically instead of by hand. */
const AUTO = new Set(
  (process.env.RECORDER_AUTO || "").split(",").map((part) => part.trim()).filter(Boolean),
);
/** Read-only by default: change requests to the guarded hosts are blocked and logged. */
const ALLOW_WRITES = process.env.RECORDER_ALLOW_WRITES === "1";
const GUARDED_HOSTS = [
  /^api-edunex\.cognisia\.id$/,
  /^edunex\.itb\.ac\.id$/,
  /^six\.itb\.ac\.id$/,
  /\.blob\.core\.windows\.net$/,
];

const SITES = {
  edunex: { label: "Edunex", url: "https://sso-edunex.itb.ac.id/", side: "left" },
  six: {
    label: "SIX ITB",
    url: SMOKE ? "https://six.itb.ac.id/pub/kur2024" : "https://six.itb.ac.id/login",
    side: "right",
  },
};

/** Login hosts: only method + host + path are kept, never bodies or queries. */
const LOGIN_HOSTS = [
  /(^|\.)microsoftonline\.com$/,
  /(^|\.)microsoft\.com$/,
  /(^|\.)live\.com$/,
  /(^|\.)msauth\.net$/,
  /(^|\.)msftauth\.net$/,
  /(^|\.)office\.com$/,
  /^sso-edunex\.itb\.ac\.id$/,
  /^login\.itb\.ac\.id$/,
];
/** Hosts whose JSON / HTML bodies are worth keeping. */
const BODY_HOSTS = new Set(["api-edunex.cognisia.id", "edunex.itb.ac.id", "six.itb.ac.id"]);
const RECORDED_TYPES = new Set(["Document", "XHR", "Fetch"]);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const SECRET_KEY =
  /^(access_?token|refresh_?token|id_?token|token|_token|csrf_?token|password|passwd|secret|client_secret|authorization|cookie|otp|code_verifier|api_?key)$/i;
const SECRET_QUERY =
  /^(code|state|token|access_token|id_token|session_state|client_info|sig|signature|se|sp|sv|x-amz-[a-z-]+|x-goog-[a-z-]+)$/i;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;

let seq = 0;
let finishing = false;
/** Live recorders; finish() flushes entries whose completion event never came. */
const recorders = new Set();
/** Per-window network activity, used to wait until a page has finished loading. */
const recorderState = new Map();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-recorder-"));
app.setPath("userData", profileDir);

// ---------------------------------------------------------------- output

function ensureOut() {
  fs.mkdirSync(BODY_DIR, { recursive: true });
}

function appendLine(file, value) {
  fs.appendFileSync(path.join(OUT_DIR, file), `${JSON.stringify(value)}\n`);
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(OUT_DIR, file), `${JSON.stringify(value, null, 2)}\n`);
}

function log(message) {
  process.stdout.write(`[rec] ${message}\n`);
}

// ---------------------------------------------------------------- redaction

function isLoginHost(host) {
  return LOGIN_HOSTS.some((pattern) => pattern.test(host));
}

function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redactJson(inner);
    }
    return out;
  }
  if (typeof value === "string") return value.replace(JWT, "[redacted-jwt]");
  return value;
}

function redactHtml(html) {
  return html
    .replace(
      /(<input\b[^>]*\bname=["'][^"']*token[^"']*["'][^>]*\bvalue=["'])[^"']*(["'])/gi,
      "$1[redacted]$2",
    )
    .replace(
      /(<input\b[^>]*\bvalue=["'])[^"']*(["'][^>]*\bname=["'][^"']*token[^"']*["'])/gi,
      "$1[redacted]$2",
    )
    .replace(
      /(<meta\b[^>]*\bname=["']csrf[^"']*["'][^>]*\bcontent=["'])[^"']*(["'])/gi,
      "$1[redacted]$2",
    )
    .replace(JWT, "[redacted-jwt]");
}

/** Keeps path + safe query for body hosts; path only everywhere else. */
function describeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { host: "", path: "", query: null, url: "[unparsable]" };
  }
  const host = url.hostname;
  const keepQuery = BODY_HOSTS.has(host);
  const query = {};
  if (keepQuery) {
    for (const [key, value] of url.searchParams) {
      query[key] = SECRET_QUERY.test(key) ? "[redacted]" : value.replace(JWT, "[redacted-jwt]");
    }
  }
  const search = keepQuery && url.search
    ? `?${new URLSearchParams(query).toString()}`
    : "";
  return {
    host,
    path: url.pathname,
    query: keepQuery && url.search ? query : null,
    url: `${url.protocol}//${host}${url.pathname}${search}`,
  };
}

function headerValue(headers, name) {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return String(value);
  }
  return null;
}

function summarizeRequestBody(contentType, postData) {
  if (postData == null) return null;
  const type = (contentType || "").toLowerCase();
  if (type.includes("multipart/form-data")) {
    // Field names and file metadata only — never the file contents.
    const parts = [];
    for (const chunk of postData.split(/\r?\n--/)) {
      const name = /name="([^"]*)"/i.exec(chunk);
      if (!name) continue;
      const filename = /filename="([^"]*)"/i.exec(chunk);
      const partType = /content-type:\s*([^\r\n]+)/i.exec(chunk);
      parts.push({
        name: name[1],
        filename: filename ? filename[1] : null,
        contentType: partType ? partType[1].trim() : null,
        approxBytes: chunk.length,
      });
    }
    return { kind: "multipart", parts };
  }
  if (type.includes("application/json")) {
    try {
      return { kind: "json", value: redactJson(JSON.parse(postData)) };
    } catch {
      return { kind: "json-unparsable", bytes: postData.length };
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const value = {};
    for (const [key, inner] of new URLSearchParams(postData)) {
      value[key] = /token|password|passwd|secret/i.test(key) ? "[redacted]" : inner;
    }
    return { kind: "form", value };
  }
  return { kind: "other", contentType: contentType || null, bytes: postData.length };
}

function slug(text) {
  return text.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "root";
}

/** Same endpoint, different ids → one summary row. */
function endpointKey(method, host, pathname) {
  const normalized = pathname
    .replace(/mahasiswa:\d+(\+\d{4}-\d)?/g, (_m, term) => `mahasiswa:{nim}${term ? "+{term}" : ""}`)
    .replace(/\/\d+(?=\/|$)/g, "/{id}");
  return `${method} ${host}${normalized}`;
}

// ---------------------------------------------------------------- capture

function attachRecorder(contents, windowName) {
  const dbg = contents.debugger;
  try {
    dbg.attach("1.3");
  } catch (error) {
    log(`could not attach to ${windowName}: ${error.message}`);
    return;
  }

  const pending = new Map();
  let lastActivity = Date.now();
  recorderState.set(windowName, {
    inflight: () =>
      [...pending.values()].filter((entry) => entry.type !== "Document" && !entry.loginHost).length,
    lastActivity: () => lastActivity,
  });

  function finalize(entry) {
    pending.delete(entry.requestId);
    delete entry.requestId;
    delete entry.pausedBody;
    appendLine("index.jsonl", entry);
    const size = entry.bodyBytes != null ? ` ${Math.round(entry.bodyBytes / 1024)} KB` : "";
    const status = entry.failed ? `failed (${entry.failed})` : entry.status;
    log(`${windowName.padEnd(6)} ${entry.method} ${entry.host}${entry.path} → ${status}${size}`);
  }

  function startEntry(params) {
    const described = describeUrl(params.request.url);
    const loginHost = isLoginHost(described.host);
    const contentType = headerValue(params.request.headers, "content-type");
    const entry = {
      seq: ++seq,
      requestId: params.requestId,
      at: new Date().toISOString(),
      window: windowName,
      type: params.type,
      method: params.request.method,
      host: described.host,
      path: described.path,
      url: loginHost ? `https://${described.host}${described.path}` : described.url,
      query: loginHost ? null : described.query,
      loginHost,
      requestBody: null,
    };
    if (!loginHost && BODY_HOSTS.has(described.host) && params.request.hasPostData) {
      entry.requestBody = summarizeRequestBody(contentType, params.request.postData ?? null);
      if (params.request.postData == null) {
        void dbg
          .sendCommand("Network.getRequestPostData", { requestId: params.requestId })
          .then(({ postData }) => {
            entry.requestBody = summarizeRequestBody(contentType, postData);
          })
          .catch(() => {});
      }
    }
    pending.set(params.requestId, entry);
  }

  async function captureBody(entry, mimeType) {
    const textual = /json|html|text\/plain|javascript/i.test(mimeType || "");
    if (entry.loginHost || !BODY_HOSTS.has(entry.host) || !textual) return;
    if (entry.host === "edunex.itb.ac.id" && entry.type === "Document") return; // SPA shell
    if (entry.host === "six.itb.ac.id" && /^\/login/i.test(entry.path)) return;
    try {
      // A page that opens a new site process can't be read back through the
      // Network domain afterwards, so SIX pages are read while paused (below).
      let text = entry.pausedBody;
      if (text == null) {
        const { body, base64Encoded } = await dbg.sendCommand("Network.getResponseBody", {
          requestId: entry.requestId,
        });
        text = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
      }
      if (text.length > MAX_BODY_BYTES) {
        entry.bodyNote = `skipped: ${text.length} bytes`;
        return;
      }
      let saved;
      let ext;
      if (/json/i.test(mimeType)) {
        try {
          saved = JSON.stringify(redactJson(JSON.parse(text)), null, 2);
          ext = "json";
        } catch {
          saved = text.replace(JWT, "[redacted-jwt]");
          ext = "txt";
        }
      } else if (/html/i.test(mimeType)) {
        saved = redactHtml(text);
        ext = "html";
      } else {
        saved = text.replace(JWT, "[redacted-jwt]");
        ext = "txt";
      }
      const file = `${String(entry.seq).padStart(4, "0")}-${slug(entry.host)}-${entry.method}-${slug(entry.path)}.${ext}`;
      fs.writeFileSync(path.join(BODY_DIR, file), saved);
      entry.bodyFile = `bodies/${file}`;
      entry.bodyBytes = Buffer.byteLength(saved);
    } catch (error) {
      entry.bodyNote = `unavailable: ${error.message}`;
    }
  }

  /** Reads a SIX page body at the response stage, then always lets it through. */
  async function readPausedPage(params) {
    try {
      const entry = pending.get(params.networkId);
      const status = params.responseStatusCode ?? 0;
      if (entry && status >= 200 && status < 300 && !/^\/login/i.test(entry.path)) {
        const { body, base64Encoded } = await dbg.sendCommand("Fetch.getResponseBody", {
          requestId: params.requestId,
        });
        entry.pausedBody = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
      }
    } catch {
      // Fall back to the Network domain read in captureBody.
    } finally {
      try {
        await dbg.sendCommand("Fetch.continueResponse", { requestId: params.requestId });
      } catch {
        await dbg.sendCommand("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
      }
    }
  }

  dbg.on("message", (_event, method, params) => {
    if (method === "Fetch.requestPaused") {
      void readPausedPage(params);
      return;
    }
    lastActivity = Date.now();
    if (method === "Network.requestWillBeSent") {
      if (!RECORDED_TYPES.has(params.type)) return;
      if (params.request.url.includes("/socket.io/")) return;
      const previous = pending.get(params.requestId);
      if (previous && params.redirectResponse) {
        previous.status = params.redirectResponse.status;
        const location = headerValue(params.redirectResponse.headers, "location");
        if (location) {
          const target = describeUrl(new URL(location, params.redirectResponse.url).toString());
          previous.redirectTo = isLoginHost(target.host)
            ? `https://${target.host}${target.path}`
            : target.url;
        }
        finalize(previous);
      }
      startEntry(params);
      return;
    }

    const entry = pending.get(params.requestId);
    if (!entry) return;

    if (method === "Network.responseReceived") {
      entry.status = params.response.status;
      entry.mimeType = params.response.mimeType;
      entry.contentLength = headerValue(params.response.headers, "content-length");
      entry.contentDisposition = entry.loginHost
        ? null
        : headerValue(params.response.headers, "content-disposition");
      // The first page after a site switch never reports loadingFinished to
      // this session; its body was already read while paused, so finish now.
      if (entry.pausedBody != null) {
        pending.delete(params.requestId);
        void captureBody(entry, entry.mimeType).finally(() => finalize(entry));
      }
    } else if (method === "Network.loadingFinished") {
      void captureBody(entry, entry.mimeType).finally(() => finalize(entry));
    } else if (method === "Network.loadingFailed") {
      entry.failed = params.canceled ? "canceled" : params.errorText;
      finalize(entry);
    }
  });

  void dbg.sendCommand("Network.enable", {
    maxTotalBufferSize: 200 * 1024 * 1024,
    maxResourceBufferSize: 20 * 1024 * 1024,
    maxPostDataSize: 256 * 1024,
  });
  recorders.add({
    async flush() {
      for (const entry of [...pending.values()]) {
        entry.note = "completion event never arrived";
        await captureBody(entry, entry.mimeType).catch(() => {});
        finalize(entry);
      }
    },
  });
  contents.once("destroyed", () => {
    for (const entry of [...pending.values()]) {
      entry.note = "window closed before completion";
      finalize(entry);
    }
  });

  void dbg.sendCommand("Fetch.enable", {
    patterns: [
      { urlPattern: "https://six.itb.ac.id/*", resourceType: "Document", requestStage: "Response" },
    ],
  });

  const timeline = (event, url, extra = {}) => {
    const described = describeUrl(url || contents.getURL());
    appendLine("timeline.jsonl", {
      at: new Date().toISOString(),
      ms: Date.now(),
      window: windowName,
      event,
      host: described.host,
      path: described.path,
      ...extra,
    });
  };
  contents.on("did-start-navigation", (details) => {
    if (details.isMainFrame) timeline("start-navigation", details.url, { sameDocument: details.isSameDocument });
  });
  contents.on("did-navigate", (_event, url, httpResponseCode) => timeline("navigated", url, { status: httpResponseCode }));
  contents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (!isMainFrame) return;
    timeline("navigated-in-page", url);
    if (windowName === "edunex") void readEdunexAuthShape(contents);
  });
  contents.on("did-finish-load", () => {
    timeline("finished-load");
    if (windowName === "edunex") void readEdunexAuthShape(contents);
  });
  contents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) timeline("failed-load", url, { code, description });
  });
}

// ---------------------------------------------------------------- notes

const notes = { startedAt: new Date().toISOString(), edunexAuth: null, cookies: null };

/** Runs inside the Edunex page: returns the token's shape, never the token. */
const AUTH_SHAPE_SCRIPT = `(() => {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  let auth;
  try { auth = JSON.parse(raw); } catch { return { unparsable: true }; }
  const describe = (value) => Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  const shape = {};
  for (const [key, value] of Object.entries(auth)) shape[key] = describe(value);
  let jwt = null;
  try {
    const payload = JSON.parse(atob(String(auth.accessToken).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    jwt = { claimKeys: Object.keys(payload), iat: payload.iat ?? null, exp: payload.exp ?? null };
  } catch {}
  const accounts = auth.accounts;
  const list = Array.isArray(accounts) ? accounts : accounts && typeof accounts === "object" ? Object.values(accounts) : [];
  const first = list[0] && typeof list[0] === "object" ? list[0] : null;
  return {
    keys: shape,
    expirationDate: typeof auth.expirationDate === "string" ? auth.expirationDate : null,
    jwt,
    accounts: { container: describe(accounts), count: list.length, firstItemKeys: first ? Object.keys(first) : [] },
  };
})()`;

async function readEdunexAuthShape(contents) {
  if (notes.edunexAuth || contents.isDestroyed()) return;
  try {
    const host = new URL(contents.getURL()).hostname;
    if (host !== "edunex.itb.ac.id") return;
    const shape = await contents.executeJavaScript(AUTH_SHAPE_SCRIPT);
    if (shape) {
      notes.edunexAuth = { readAt: new Date().toISOString(), ...shape };
      writeJson("notes.json", notes);
      log("edunex sign-in detected (token shape noted, token not saved)");
    }
  } catch {
    // Page navigated away mid-read; the next load tries again.
  }
}

async function snapshotCookies() {
  const all = await session.fromPartition(PARTITION).cookies.get({});
  const interesting = all.filter((cookie) =>
    /(^|\.)itb\.ac\.id$|cognisia\.id$/.test(cookie.domain.replace(/^\./, "")),
  );
  notes.cookies = interesting.map((cookie) => ({
    domain: cookie.domain,
    name: cookie.name,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    session: cookie.session,
    expires: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : null,
  }));
}

// ---------------------------------------------------------------- summary

function writeSummary() {
  const indexFile = path.join(OUT_DIR, "index.jsonl");
  const rows = fs.existsSync(indexFile)
    ? fs.readFileSync(indexFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const endpoints = {};
  for (const row of rows) {
    if (row.loginHost) continue;
    const key = endpointKey(row.method, row.host, row.path);
    const bucket = (endpoints[key] ??= { count: 0, statuses: {}, queryKeys: new Set(), types: new Set(), sample: null });
    bucket.count += 1;
    bucket.statuses[row.status ?? row.failed ?? "?"] = (bucket.statuses[row.status ?? row.failed ?? "?"] || 0) + 1;
    for (const key2 of Object.keys(row.query || {})) bucket.queryKeys.add(key2);
    bucket.types.add(row.type);
    if (!bucket.sample && row.bodyFile) bucket.sample = row.bodyFile;
  }
  const summary = {
    recordedRequests: rows.length,
    loginHostRequests: rows.filter((row) => row.loginHost).length,
    endpoints: Object.fromEntries(
      Object.entries(endpoints)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, bucket]) => [key, {
          count: bucket.count,
          statuses: bucket.statuses,
          types: [...bucket.types],
          queryKeys: [...bucket.queryKeys],
          sample: bucket.sample,
        }]),
    ),
  };
  writeJson("summary.json", summary);
  return summary;
}

async function finish(reason) {
  if (finishing) return;
  finishing = true;
  log(`finishing (${reason})…`);
  for (const recorder of recorders) await recorder.flush();
  try {
    await snapshotCookies();
  } catch {
    // Session already gone; cookie notes stay empty.
  }
  notes.finishedAt = new Date().toISOString();
  writeJson("notes.json", notes);
  const summary = writeSummary();
  log(`saved ${summary.recordedRequests} requests, ${Object.keys(summary.endpoints).length} endpoints → ${OUT_DIR}`);
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Temp profile cleanup is best-effort.
  }
  app.exit(0);
}

// ---------------------------------------------------------------- automation

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Blocks every change request to Edunex, SIX and file storage; logs what was attempted. */
function installReadOnlyGuard() {
  if (ALLOW_WRITES) return;
  session.fromPartition(PARTITION).webRequest.onBeforeRequest((details, callback) => {
    if (["GET", "HEAD", "OPTIONS"].includes(details.method)) return callback({});
    let url;
    try {
      url = new URL(details.url);
    } catch {
      return callback({});
    }
    if (!GUARDED_HOSTS.some((pattern) => pattern.test(url.hostname))) return callback({});
    // Sign-in callbacks are not data changes.
    if (/^\/login/i.test(url.pathname) && url.hostname !== "api-edunex.cognisia.id") return callback({});
    const raw = details.uploadData?.[0]?.bytes ? details.uploadData[0].bytes.toString("utf8") : null;
    const guessedType = raw && /^\s*[[{]/.test(raw) ? "application/json" : "application/x-www-form-urlencoded";
    appendLine("blocked.jsonl", {
      at: new Date().toISOString(),
      method: details.method,
      host: url.hostname,
      path: url.pathname,
      query: BODY_HOSTS.has(url.hostname) ? describeUrl(details.url).query : null,
      body: raw ? summarizeRequestBody(guessedType, raw) : null,
    });
    log(`blocked ${details.method} ${url.hostname}${url.pathname} (read-only)`);
    callback({ cancel: true });
  });
}

async function waitForIdle(windowName, quietMs = 1500, maxMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const state = recorderState.get(windowName);
    if (state && state.inflight() === 0 && Date.now() - state.lastActivity() >= quietMs) return true;
    await sleep(250);
  }
  return false;
}

async function screenshot(window, name) {
  try {
    const image = await window.webContents.capturePage();
    const dir = path.join(OUT_DIR, "shots");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug(name)}.png`), image.resize({ width: 1200 }).toPNG());
  } catch {
    // Screenshots are a convenience only.
  }
}

const LINKS_SCRIPT = `[...new Set([...document.querySelectorAll("a[href]")].map((a) => a.href))]`;

async function pageLinks(contents, host) {
  try {
    const links = await contents.executeJavaScript(LINKS_SCRIPT);
    return links
      .map((link) => {
        try {
          const url = new URL(link);
          return url.hostname === host ? `${url.pathname}${url.search}` : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Never visited automatically, even though the guard would block any change.
const UNSAFE_ROUTE =
  /(edit|create|\/new\b|delete|remove|take|start|attempt|safe|logout|signout|settings|enrol|leave|kick|print|download|export|import|token|reader|hapus|batal|kirim|ambil|hadir|drop|withdraw|send|save|cetak|unduh|locale|kuesioner|\/aD\/)/i;

// ---- Edunex

const EDUNEX = "https://edunex.itb.ac.id";

async function edunexGo(window, route) {
  const contents = window.webContents;
  const routed = await contents
    .executeJavaScript(`(() => {
      const root = document.querySelector("#app");
      const router = root?.__vue__?.$router ?? root?.__vue_app__?.config?.globalProperties?.$router;
      if (!router) return false;
      router.push(${JSON.stringify(route)}).catch(() => {});
      return true;
    })()`)
    .catch(() => false);
  if (!routed) await contents.loadURL(`${EDUNEX}${route}`).catch(() => {});
  await sleep(600);
  await waitForIdle("edunex", 1800, 15_000);
}

async function autoTourEdunex() {
  const authFile = process.env.RECORDER_EDUNEX_AUTH;
  if (!authFile) throw new Error("RECORDER_EDUNEX_AUTH is not set");
  const authJson = fs.readFileSync(authFile, "utf8");
  JSON.parse(authJson);

  const window = openSite("edunex", null);
  const contents = window.webContents;
  await contents.loadURL(`${EDUNEX}/`).catch(() => {});
  await waitForIdle("edunex", 1500, 20_000);
  await contents.executeJavaScript(`localStorage.setItem("auth", ${JSON.stringify(authJson)}); true`);
  await contents.loadURL(`${EDUNEX}/`).catch(() => {});
  await waitForIdle("edunex", 2500, 30_000);
  if (/\/login/i.test(contents.getURL())) {
    log("edunex: saved login was not accepted by the site; stopping the tour");
    await screenshot(window, "edunex-login-rejected");
    return;
  }
  log("edunex: signed in with the saved login");

  const visited = new Set();
  const discovered = new Set();
  let pages = 0;
  const MAX_PAGES = 70;

  // Assignment "take" pages are the normal student view of a Task (the list
  // links there); exam start pages and everything else in UNSAFE_ROUTE stay out.
  const allowed = (route) => /^\/assignment\/take\/\d+$/.test(route) || !UNSAFE_ROUTE.test(route);

  async function visit(route, label) {
    if (pages >= MAX_PAGES || visited.has(route) || !allowed(route)) return [];
    visited.add(route);
    pages += 1;
    log(`edunex tour ${String(pages).padStart(2)}: ${route}`);
    await edunexGo(window, route);
    appendLine("timeline.jsonl", { at: new Date().toISOString(), window: "edunex", event: "tour", route, label });
    await screenshot(window, `edunex-${String(pages).padStart(2, "0")}-${route}`);
    const links = await pageLinks(contents, "edunex.itb.ac.id");
    for (const link of links) discovered.add(link);
    return links;
  }

  const pick = (links, pattern, limit) =>
    [...new Set(links.filter((link) => pattern.test(link) && allowed(link)))].slice(0, limit);

  // Second pass: explicit routes built from the first pass's recorded IDs.
  const extraFile = process.env.RECORDER_EDUNEX_ROUTES;
  if (extraFile) {
    for (const route of JSON.parse(fs.readFileSync(extraFile, "utf8"))) {
      const links = await visit(route, "planned");
      if (/^\/courses\/\d+\/preview$/.test(route)) {
        for (const sub of pick(links, /^\/courses\/\d+\/preview\/\d+/, 4)) await visit(sub, "course-module");
      }
    }
    writeJson("edunex-routes.json", { visited: [...visited], discovered: [...discovered].sort() });
    log(`edunex tour done: ${pages} pages`);
    return;
  }

  await visit("/", "home");
  await visit("/todo", "todo");
  const courseLinks = await visit("/courses", "courses");
  const assignmentLinks = await visit("/assignment", "assignments");
  await visit("/exam", "exams");
  const presenceLinks = await visit("/presence", "presence");
  await visit("/vicon", "vicon");
  await visit("/announcements", "announcements");

  for (const course of pick(courseLinks, /^\/courses\/\d+/, 10)) {
    const inner = await visit(course, "course");
    for (const sub of pick(inner, /^\/courses\/\d+\/.+/, 4)) await visit(sub, "course-sub");
  }
  for (const task of pick(assignmentLinks, /^\/assignment\/\d+/, 8)) await visit(task, "assignment");
  for (const presence of pick(presenceLinks, /^\/presence\/\d+\/\d+/, 8)) await visit(presence, "presence");

  writeJson("edunex-routes.json", { visited: [...visited], discovered: [...discovered].sort() });
  log(`edunex tour done: ${pages} pages`);
}

// ---- SIX

const SIX = "https://six.itb.ac.id";

/** The student signs in themselves (password + 2FA); the robot waits for SIX to load. */
async function waitForSixSignIn(contents, deadlineMs) {
  while (Date.now() < deadlineMs) {
    try {
      const url = new URL(contents.getURL());
      if (url.hostname === "six.itb.ac.id" && !/^\/login/i.test(url.pathname)) return true;
    } catch {
      // Mid-navigation; check again shortly.
    }
    await sleep(1000);
  }
  return false;
}

async function autoTourSix() {
  const window = openSite("six", `${SIX}/login/MS365`);
  const contents = window.webContents;
  window.focus();
  log("six: sign in yourself in the SIX window (password + 2FA) — the robot takes over after that");
  const signedIn = await waitForSixSignIn(contents, Date.now() + 10 * 60_000);
  if (!signedIn) {
    log("six: no sign-in within 10 minutes; stopping the tour");
    await screenshot(window, "six-sign-in-timeout");
    return;
  }
  await waitForIdle("six", 1500, 20_000);
  log("six: signed in");

  const visited = new Set();
  const discovered = new Set();
  let pages = 0;
  const MAX_PAGES = 60;

  async function visit(route, label) {
    if (pages >= MAX_PAGES || visited.has(route) || UNSAFE_ROUTE.test(route)) return [];
    visited.add(route);
    pages += 1;
    log(`six tour ${String(pages).padStart(2)}: ${route.replace(/mahasiswa:\d+/, "mahasiswa:{nim}")}`);
    await contents.loadURL(`${SIX}${route}`).catch(() => {});
    await waitForIdle("six", 1500, 15_000);
    await sleep(2000); // human pace: SIX sits behind a rate limiter
    appendLine("timeline.jsonl", { at: new Date().toISOString(), window: "six", event: "tour", route, label });
    await screenshot(window, `six-${String(pages).padStart(2, "0")}-${route}`);
    const links = await pageLinks(contents, "six.itb.ac.id");
    for (const link of links) discovered.add(link);
    return links;
  }

  const landing = `${new URL(contents.getURL()).pathname}${new URL(contents.getURL()).search}`;
  const first = await visit(landing, "landing");
  const all = [...first, ...(await pageLinks(contents, "six.itb.ac.id"))];
  const student = all.map((link) => /\/app\/mahasiswa:(\d+)(\+\d{4}-\d)?/.exec(link)).find(Boolean);
  if (!student) {
    log("six: could not find the student menu on the landing page");
  }
  const nim = student?.[1];
  const term = student?.[2] ?? null;

  // Known pages first (from the krs / six-auto-presence notes), then whatever the menus link to.
  const known = nim
    ? [
        `/app/mahasiswa:${nim}/statusmhs`,
        term ? `/app/mahasiswa:${nim}${term}/kelas/jadwal/mahasiswa` : null,
        `/app/mahasiswa:${nim}/kurikulum/struktur`,
        `/app/mahasiswa:${nim}/registrasi`,
      ].filter(Boolean)
    : [];
  for (const route of known) await visit(route, "known");

  const queue = [...discovered].filter((link) => link.startsWith("/app/"));
  while (queue.length > 0 && pages < MAX_PAGES) {
    const route = queue.shift();
    if (visited.has(route) || UNSAFE_ROUTE.test(route)) continue;
    const links = await visit(route, "menu");
    for (const link of links) {
      if (link.startsWith("/app/") && !visited.has(link) && !queue.includes(link)) queue.push(link);
    }
  }

  writeJson("six-routes.json", {
    visited: [...visited].map((route) => route.replace(/mahasiswa:\d+/g, "mahasiswa:{nim}")),
    discovered: [...discovered].map((route) => route.replace(/mahasiswa:\d+/g, "mahasiswa:{nim}")).sort(),
  });
  log(`six tour done: ${pages} pages`);
}

// ---------------------------------------------------------------- windows

function openSite(key, initialUrl = SITES[key].url) {
  const site = SITES[key];
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.floor(workArea.width / 2);
  const window = new BrowserWindow({
    x: workArea.x + (site.side === "left" ? 0 : width),
    y: workArea.y,
    width,
    height: workArea.height,
    title: `● REC — ${site.label}`,
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true },
  });
  window.on("page-title-updated", (event, title) => {
    event.preventDefault();
    window.setTitle(`● REC — ${site.label} — ${title}`);
  });
  attachRecorder(window.webContents, key);
  window.webContents.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true },
    },
  }));
  window.webContents.on("did-create-window", (child) => attachRecorder(child.webContents, `${key}+`));
  if (initialUrl) void window.loadURL(initialUrl);
  return window;
}

function buildMenu() {
  const focused = () => BrowserWindow.getFocusedWindow()?.webContents;
  return Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "Navigate",
      submenu: [
        { label: "Back", accelerator: "CmdOrCtrl+[", click: () => focused()?.navigationHistory.goBack() },
        { label: "Forward", accelerator: "CmdOrCtrl+]", click: () => focused()?.navigationHistory.goForward() },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => focused()?.reload() },
        { type: "separator" },
        { label: "Open Edunex window", click: () => openSite("edunex") },
        { label: "Open SIX ITB window", click: () => openSite("six") },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Recording",
      submenu: [
        { label: "Finish and save", accelerator: "CmdOrCtrl+Shift+S", click: () => void finish("menu") },
      ],
    },
  ]);
}

app.on("window-all-closed", () => void finish("windows closed"));
process.on("SIGINT", () => void finish("SIGINT"));
process.on("SIGTERM", () => void finish("SIGTERM"));

app.whenReady().then(() => {
  ensureOut();
  writeJson("notes.json", notes);
  Menu.setApplicationMenu(buildMenu());
  session.fromPartition(PARTITION).setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  installReadOnlyGuard();
  log(`recording to ${OUT_DIR}${ALLOW_WRITES ? "" : " (read-only: change requests are blocked)"}`);
  if (AUTO.size > 0) {
    void (async () => {
      try {
        if (AUTO.has("edunex")) await autoTourEdunex();
        if (AUTO.has("six")) await autoTourSix();
      } catch (error) {
        log(`automation stopped: ${error.message}`);
      }
      await finish("automatic tour done");
    })();
    return;
  }
  openSite("edunex");
  openSite("six");
  log("sign in yourself in both windows, browse, then close the windows (or ⌘⇧S) to save");
  if (SMOKE) {
    // Public pages only: a cross-site first load, then a same-site navigation.
    setTimeout(() => {
      const six = BrowserWindow.getAllWindows().find((window) => window.getTitle().includes("SIX"));
      void six?.loadURL("https://six.itb.ac.id/pub/kur2024/135");
    }, 5_000);
    setTimeout(() => void finish("smoke timeout"), 14_000);
  }
});
